var request = require('request');
var winston = require('winston');
var memoize = require('lodash.memoize');
var Cache = require('./Cache.js');
var Readable = require('stream').Readable;

var logger = new winston.Logger({
  transports: [new winston.transports.Console()]
});

memoize.Cache = Cache;

// We probably don't want to have a RFC-7234 compatible cache client that checks
// for No-Cache or Private directives. Also many feeds set the Max-Age and Expires
// to zero or now respectivley. So caching them wouldn't work.

// Due to the implementation of memoize, we cannot cannot extend Cache to return a stream,
// because that would only for values already in the cache. Decorate the function instead.
function convertString (func) {
  return function (url, userOpts) {
    const opts = userOpts || {};
    const resultType = opts.resultType || 'string';
    // Wrap promise.
    return func.apply(this, [url])
      .then(result => {
        if (resultType === 'stream') {
          var stream = new Readable();
          stream.push(result.body);
          stream.push(null); // Indicates the end of the stream.
          return {url: result.url, body: stream};
        } else if (resultType === 'string') {
          return result;
        } else {
          throw new Error('Unknown result type ' + resultType + '.');
        }
      });
  };
}

// https://lodash.com/docs/#memoize
var loadUrl = convertString(memoize(function (url) {
  logger.log('info', 'Downloading %s.', url);
  return new Promise((resolve, reject) => {
    request({
      url: url,
      method: 'GET',
      callback: function (error, res, body) {
        const statusCode = (res && res.statusCode) || -1;
        if (!error && statusCode !== 200) {
          error = new Error('Request failed with code ' + statusCode + '.');
        }

        if (error) {
          logger.log('error', 'Could not load url %s. Reason: %s', url, error);
          reject(error);
        } else {
          logger.log('info', 'Downloaded %s successfully.', url);
          // We could cache the IncomingHttpMessage, but it cannot be cloned easily.
          // Therefore, only the first consumer could read the response.
          resolve({url: url, body: body});
        }
      }
    });
  });
}));

module.exports = loadUrl;
