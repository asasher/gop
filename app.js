var fs = require('fs');
var http = require('http');
var url = require('url');
var swig = require('swig');
var fbg = require('fbgraph');
var MongoClient = require('mongodb').MongoClient;
var express = require('express');
var _ = require('lodash');

var CONF = {
	CLIENT_ID: process.env.FB_CLIENT_ID,
	CLIENT_SECRET: process.env.FB_CLIENT_SECRET,
	REDIRECT_URI: 'http://gopapp.herokuapp.com/join',
	PORT: process.env.PORT || 8888,
	PERMISSIONS: ['public_profile', 'email', 'user_friends'],
	VIEW_PATH: 'app.html',
	MONGODB_URL: process.env.MONGODB_URL
}

var app = express();

app.engine('html', swig.renderFile);

app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.set('view cache', false);
swig.setDefaults({ cache: false });
app.listen(CONF.PORT);
console.log('Server is listening on port ' + CONF.PORT);

app.get('/', function (req, res) {
	res.render('hello', { text: 'HELLO', textClass: 'good'});
});

app.get('/join', function(req, res) {
	console.log('got request');
	if (!req.query || !req.query.code) {
		var authUrl = fbg.getOauthUrl({
			client_id: CONF.CLIENT_ID,
			redirect_uri: CONF.REDIRECT_URI,
			scope: CONF.PERMISSIONS.join(',')
		});
		
		console.log('redirecting to facebook to get permissions', authUrl);
		res.redirect(authUrl);
		return;
	}
	
	console.log('got code', req.query.code);
	
	fbg.authorize({
		client_id: CONF.CLIENT_ID,
		redirect_uri: CONF.REDIRECT_URI,
		client_secret: CONF.CLIENT_SECRET,
		code: req.query.code
	}, function(err, fbRes) {
		console.log('response from facebook', fbRes);
		
		if(err) {
			console.log(err);
			res.render('hello', {text: '_ No Luck _', textClass : 'bad', data: JSON.stringify(err, null, 4)});
		}
		else if (!fbRes || fbRes.error) {
			console.log(fbRes.error)
			res.render('hello',{text: '_ No Luck _', textClass : 'bad', data: JSON.stringify(fbRes, null, 4)});			
		} else {
			fbg.batch([
					{
						method: 'GET',
						relative_url: 'me?fields=id,name,email,birthday'
					},
					{
						method: 'GET',
						relative_url: 'me/friends?offset=0&limit=5000'
					}
				], 
				function(err, fbRes) {
					var parsed = fbRes.map(function(elem) {
						return JSON.parse(elem.body);
					});
					
					var user = parsed[0];
					var friendship = {
						id : user.id,
						friends: _.map(parsed[1].data, function(elem) {
							return elem.id;
						})
					};
					
					res.render('hello', {text: '!!! All Done !!!', textClass: 'good', data: JSON.stringify([user, friendship], null, 4)});
										
					// console.log('connecting to mongo', CONF.MONGODB_URL);
					// MongoClient.connect(CONF.MONGODB_URL, function(err, db) {
					// 	if (err) {
					// 		console.log(err);
					// 		res.render('hello', {text: '!!! DB ERROR !!!', textClass: 'bad', data: JSON.stringify(err, null, 4)});
					// 		return;
					// 	}
						
					// 	console.log('connected to mongodb');
						
					// 	var users = db.collection('users');
					// 	var friendships = db.collection('friendships');
						
					// 	users.createIndex({ "id": 1 }, { unique: true })
					// 		.then(function() {
					// 			return friendships.createIndex({"id": 1}, {unique: true});							
					// 		})
					// 		.then(function() {
					// 			return users.update(_.pluck(user, 'id'), _.omit(user, 'id'), {upsert: true}); 
					// 		})
					// 		.then(function() {
					// 			return friendships.update(_.pluck(friendship, 'id'), _.omit(friendship, 'id'), {upsert: true});
					// 		})
					// 		.then(function() {
					// 			db.close();
					// 		})
					// 		.then(function() {
					// 			res.render('hello', {text: '!!! All Done !!!', textClass: 'good', data: JSON.stringify([user, friendship], null, 4)});								
					// 		});
					// });					
				});		
		}			
	});	
});