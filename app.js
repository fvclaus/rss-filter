var express = require('express');
var request = require('request');
var Feed = require('feed');
var app = express();

// respond with "hello world" when a GET request is made to the homepage
app.get('/convert', function (req, res) {
  var url = req.query.url;
  console.log('GET ' + url);
  request
    .get(url)
    .on('response', function (urlResponse) {
      var error;

      const statusCode = urlResponse.statusCode;
      if (statusCode !== 200) {
        error = new Error('Request failed with code ' + statusCode + '.');
      }

      const contentType = urlResponse.headers['content-type'];
      if (!contentType.startsWith('application/json')) {
        error = new Error('Content type of response is ' + contentType + ', not application/json.');
      }

      if (error) {
        console.error(error.message);
        urlResponse.destroy(error);
        return;
      }

      urlResponse.setEncoding('utf8');
      var rawData = '';
      urlResponse.on('data', function (chunk) { rawData += chunk; });
      urlResponse.on('end', function () {
        try {
          var data = JSON.parse(rawData);
          console.log('Response: ' + data);
          var feed = new Feed({
            title: url,
            updated: new Date()
          });
          data.forEach(function (data) {
        // var dataAsXml = new xml.Builder().buildObject({root: parsedData});
            feed.addItem({
              description: JSON.stringify(data),
              date: new Date()
            });
          });

          // console.log('Converted response: ' + parsedDataAsXml);
          // res.set('Content-Type', 'text/xml');
          // res.send(parsedDataAsXml.replace(/\r?\n|\r/g, ''));
          res.send(feed.atom1());
        } catch (e) {
          console.error(e.message);
        }
      });
    }).on('error', (e) => {
      console.error('Got error: ' + e.message);
      res.status(500).send('Could not GET url ' + url + ': ' + e.message);
    });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
