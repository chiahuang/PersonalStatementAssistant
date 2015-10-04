/**
 * Copyright 2014 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'),
  app = express(),
  errorhandler = require('errorhandler'),
  bluemix = require('./config/bluemix'),
  watson = require('watson-developer-cloud'),
  extend = require('util')._extend,
  fs = require('fs'),
  dummy_text = fs.readFileSync('mobydick.txt');


// Bootstrap application settings
require('./config/express')(app);

// if bluemix credentials exists, then override local
var credentials = extend({
    version: 'v2',
    url: 'https://gateway.watsonplatform.net/personality-insights/api',
    username: 'c1554254-f4e5-46be-976d-3970dffb0cf4',
    password: '4HiLYUAizzk4'
}, bluemix.getServiceCreds('personality_insights')); // VCAP_SERVICES

var personalityInsights = new watson.personality_insights(credentials);

var credentialsBackup = {
  url: 'https://stream.watsonplatform.net/text-to-speech/api',
  version: 'v1',
  username: '0dc306f4-623a-43ee-979f-e8cd20ee4478',
  password: 'DVCD3k826ZIW',
  use_vcap_services: true   
};

var credentials2 = extend(credentialsBackup, bluemix.getServiceCreds('text_to_speech'));
// Create the service wrapper
var textToSpeech = watson.text_to_speech(credentials2);
var authorization = watson.authorization(credentials2);

app.use(express.static('./public'));

// render index page
app.get('/', function(req, res) {
  res.render('index', { content: dummy_text });
});

app.post('/', function(req, res) {

  var AYLIENTextAPI = require('aylien_textapi');
  var textapi = new AYLIENTextAPI({
    application_id: "c0daeb83",
    application_key: "fb5f0cb037770c5d9ad43e1bda001c73"
  });

  textapi.summarize({
  title: 'Personal Statement',
  text: req.body.text,
  sentences_number: 5
  }, function(error, response) {
    if (error === null) {
      response.sentences.forEach(function(s) {
        console.log(s);
      });
    }
  });

  personalityInsights.profile(req.body, function(err, profile) {
    if (err) {
      if (err.message){
        console.log(credentials);
        err = { error: err.message };
      }
      return res.status(err.code || 500).json(err || 'Error processing the request');
    }
    else
      return res.json(profile);
  });
});

// Get token from Watson using your credentials
app.get('/token', function(req, res) {
  authorization.getToken({url: credentials.url}, function(err, token) {
    if (err) {
      console.log('error:', err);
      res.status(err.code);
    }

    res.send(token);
  });
});

app.get('/synthesize', function(req, res) {
  var transcript = textToSpeech.synthesize(req.query);
  transcript.on('response', function(response) {
    if (req.query.download) {
      response.headers['content-disposition'] = 'attachment; filename=transcript.ogg';
    }
  });
  transcript.on('error', function(error) {
    console.log('Synthesize error: ', error)
  });
  transcript.pipe(res);
});


// Add error handling in dev
if (!process.env.VCAP_SERVICES) {
  app.use(errorhandler());
}

var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);