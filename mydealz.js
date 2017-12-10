const Feed = require('feed');
const Promise = require('promise');
const winston = require('winston');
const FeedParser = require('feedparser');
const loadUrl = require('./loadUrl.js');
const cheerio = require('cheerio');
const request = require('request');
const when = require('when');
const _ = require('underscore');

const logger = new winston.Logger({
  transports: [new winston.transports.Console({level: 'verbose'})]
});

const FEED_URL = 'http://www.mydealz.de/rssx/VRlA-Zy0Q_hyATe7GzlGN54hgHJntRAC8TouAZ9p_PA';

function loadFeedItems (url) {
  return new Promise(function (resolve, reject) {
    var feed = {
      items: []
    };

    var feedparser = new FeedParser()
      .on('error', function (error) {
        logger.log('error', 'Error parsing feed %s. Reason %s', url, error);
        reject(error);
      })
      .on('meta', function (meta) {
        feed.meta = meta;
      })
      .on('readable', function () {
        var stream = this;
        var item;

        while (item = stream.read()) {
          feed.items.push(item);
        }
      })
      .on('end', function () {
        logger.log('verbose', 'Loaded %d feed items.', feed.items.length);
        resolve(feed);
      });

    // Don't cache the stream.
    request(url)
      .on('error', e => reject(e))
      .on('response', function (res) {
        var stream = this; // `this` is `req`, which is a stream

        if (res.statusCode !== 200) {
          this.emit('error', new Error('Bad status code'));
        } else {
          stream.pipe(feedparser);
        }
      });
  });
}

function filterFeedItems (feed) {
  // https://www.npmjs.com/package/feedparser#list-of-article-properties
  return when.settle(feed.items.map(item => loadUrl(item.link)))
    .then(descriptors => {
      return descriptors
        .filter(descriptor => {
          if (descriptor.state === 'fulfilled') {
            logger.log('info', 'Status %s: %s', descriptor.state, descriptor.value.url);
            return true;
          } else {
            logger.log('error', 'Status %s: %s', descriptor.state, descriptor.reason);
            return false;
          }
        })
        .map(descriptor => {
          const res = descriptor.value;
          const $ = cheerio.load(res.body);
          res.links = $('article a')
            .toArray()
            .map(a => a.attribs.href)
            .filter(href => typeof href === 'string')
            .filter(href => href.includes('mydealz.de/gruppe/reisen-urlaub') || href.includes('mydealz.de/gruppe/fluege'));
          return res;
        })
        .filter(res => {
          const isTravelItem = res.links.length > 0;
          logger.log('info', 'Travel item? %s: %s', isTravelItem, res.url);
          return isTravelItem;
        })
        .map(res => _.find(feed.items, item => item.link === res.url));
    });
}

const mydealzFeed = function (req, res) {
  loadFeedItems(FEED_URL)
  .then(feed => {
    // https://www.npmjs.com/package/feed
    feed.meta.updated = feed.meta.date;
    var filteredFeed = new Feed(feed.meta);

    filterFeedItems(feed)
    .then(items => {
      items.forEach(function (item) {
        item.content = item.description || item.summary;
        filteredFeed.addItem(item);
      });
      res.header('Content-Type', 'application/rss+xml');
      res.status(200).send(filteredFeed.atom1());
    });
  })
  // Development errors. Otherwise error is swallowed.
  .catch(e => {
    logger.error(e);
    res.error(500).send('Feed not available.');
  });
};

module.exports = mydealzFeed;
