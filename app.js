var express = require('express');
var Feed = require('feed');
var Promise = require('promise');
var winston = require('winston');
var FeedParser = require('feedparser');
var loadUrl = require('./loadUrl.js');
var mydealzFeed = require('./mydealz.js');
var app = express();
const WEB_URL = process.env.WEB_URL || 'rss-demux.herokuapp.com';

var logger = new winston.Logger({
  transports: [new winston.transports.Console({level: 'verbose'})]
});

const FEED_URLS = ['https://www.fly4free.com/feed/',
  'http://www.exbir.de/index.php?format=feed&type=rss',
  'https://feeds.feedburner.com/secretflying/moo',
  WEB_URL + '/mydealz'];

const KEYWORD_STREAMS = [
  {
    name: 'München',
    keywords: ['München', 'Munich', 'MUC', 'Memmingen', 'FMM']
  },
  {
    name: 'San Francisco',
    keywords: ['San Francisco', 'SFO', 'Oakland', 'OAK', 'San Jose', 'SJC']
  },
  {
    name: 'Nahe München',
    keywords: ['Salzburg', 'SZG', 'Friedrichshafen', 'FDH', 'Nürnberg', 'Nuremberg', 'NUE']
  },
  {
    name: 'Düsseldorf',
    keywords: ['Düsseldorf', 'DUS', 'Weeze', 'NRN', 'Bonn', 'Köln', 'CGN']
  }
];

function loadFeedItems (url, regex) {
  return new Promise(function (resolve, reject) {
    var feedparser = new FeedParser();

    feedparser.on('error', function (error) {
      logger.log('error', 'Error parsing feed %s. Reason %s', url, error);
      // Ignore when a single feed cannot be parsed, otherwise this will take down all other feeds too.
      resolve([]);
    });

    var items = [];

    feedparser.on('readable', function () {
      var stream = this;
      var item;

      // https://www.npmjs.com/package/feedparser#list-of-article-properties
      while (item = stream.read()) {
        var text = [item.title, item.description, item.summary].join(' ');
        if (regex.test(text)) {
          logger.log('verbose', 'Item matched: %s', item.title);
          items.push(item);
        } else {
          logger.log('verbose', 'Item not matched: %s', item.title);
        }
      }
    });

    feedparser.on('end', function () {
      logger.log('verbose', 'Resolving with %d items.', items.length);
      resolve(items);
    });

    loadUrl(url, {resultType: 'stream'})
    .then(res => {
      res.body.pipe(feedparser);
    })
    .catch(e => resolve([]));
  });
}

app.get('/api/filter-static/:index', function (req, res) {
  var index = req.params.index;
  var stream = KEYWORD_STREAMS[parseInt(index)];
  var regex = new RegExp(stream.keywords.join('|'), 'i');
  logger.log('verbose', 'Created regex %s.', regex);
  var promise = Promise.all(FEED_URLS.map(feedUrl => loadFeedItems(feedUrl, regex)));
  // This will never reject.
  promise
  .then(promiseResults => {
    var items = promiseResults.reduce((a, b) => a.concat(b));
    logger.info('Reveiced filtered items ', items.map(item => item.title));
    // https://www.npmjs.com/package/feed
    var feed = new Feed({
      title: stream.name,
      // TODO This should be the timestamp of the latest feed.
      updated: new Date()
    });
    items.forEach(function (item) {
      item.content = item.description || item.summary;
      feed.addItem(item);
    });
    res.header('Content-Type', 'application/rss+xml');
    res.send(feed.atom1());
  })
  // Development errors. Otherwise error is swallowed.
  .catch(e => logger.error(e));
});

app.get('/mydealz', mydealzFeed);

var port = parseInt(process.env.PORT) || 3000;

app.listen(port, function () {
  winston.log('Example app listening on port 3000!');
});
