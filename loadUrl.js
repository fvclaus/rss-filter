var request = require('request');
var winston = require('winston');
var memoize = require('lodash.memoize');
var Cache = require('./Cache.js');
var Readable = require('stream').Readable;

var logger = new winston.Logger({
  transports: [new winston.transports.Console()]
});

memoize.Cache = Cache;

// Due to the implementation of memoize, we cannot cannot extend Cache to return a stream,
// because that would only for values already in the cache. Decorate the function instead.
function convertStringToStream (func) {
  return function () {
    var args = arguments;
    // Wrap promise.
    return new Promise(function (resolve, reject) {
      func.apply(this, args)
        .then(result => {
          var stream = new Readable();
          stream.push(result);
          stream.push(null); // Indicates the end of the stream.
          resolve(stream);
        })
        .catch(e => reject(e));
    });
  };
}

// https://lodash.com/docs/#memoize
var loadUrl = convertStringToStream(memoize(function (url) {
  logger.log('info', 'Downloading %s.', url);
  return new Promise((resolve, reject) => {
    request({
      url: url,
      method: 'GET',
      callback: function (error, res, body) {
        const statusCode = (res && res.statusCode) || -1;
        if (statusCode !== 200) {
          error = new Error('Request failed with code ' + statusCode + '.');
        }

        if (error) {
          logger.log('error', 'Could not load url %s. Reason: %s', url, error);
          reject(error);
        } else {
          logger.log('info', 'Downloaded %s successfully.', url);
          // We could cache the IncomingHttpMessage, but it cannot be cloned easily.
          // Therefore, only the first consumer could read the response.
          resolve(body);
        }
      }
    });
  });
}));

module.exports = loadUrl;
