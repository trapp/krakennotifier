
/**
 * Module dependencies.
 */

var express = require('express');
var expressValidator = require('express-validator');
var routes = require('./routes');
var subscription = require('./routes/subscription');
var http = require('http');
var path = require('path');
var lessMiddleware = require('less-middleware');
var tracker = require('./tracker.js');
var config = require('./config.js');
var app = express();

subscription.inject(tracker);

// all environments
app.set('port', process.env.PORT || config.port);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(expressValidator());
app.use(app.router);
app.use(lessMiddleware({
    src: path.join(__dirname, 'less'),
    dest: path.join(__dirname, 'public'),
    //once: true,
    force: true,
    compress: true
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/components', express.static(__dirname + '/bower_components'));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/subscribe', subscription.subscribe);
app.post('/subscribe', subscription.subscribe);
app.get('/unsubscribe', subscription.unsubscribe);
app.post('/unsubscribe', subscription.unsubscribe);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

tracker.start();
