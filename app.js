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
console.log('Server is listening on ', CONF.PORT);

app.get('/', function (req, res) {
	if (req.query.dummy) {
		var dummies = _.range(50);
		var people = dummies.map(function(i) {
			return {
				_id:i,
				name: 'Lorem Ipsum',
				email: 'lorem@ipsum.com',
				friends: _.sample(dummies, _.random(25, 50))
			}
		});			
		var graph = getGraph(people);
		res.render('hello', {data: JSON.stringify(graph, null, 4)});
	} else {
		MongoClient.connect(CONF.MONGODB_URL, function(err, db) {
			if (err) {		
				res.render('error', {err: JSON.stringify(err, null, 4)});
				return;
			}
			
			var people = db.collection('people');
			
			people.find()
				.toArray()
				.then(function(dbRes) {
					var graph = getGraph(dbRes);			
					res.render('hello', {data: JSON.stringify(graph, null, 4)});								
				}, function(err) {
					res.render('error', {err: JSON.stringify(err, null, 4)});				
				});		
		});		
	}		
});

function getGraph(people) {
	var indices = {};
	var graph = {
		nodes : [],
		links : []
	};
	people.map(function(person, index) {
		indices[person._id] = 2*index;
		graph.nodes.push({ id: person._id });
		graph.nodes.push({ dummy: true });
		graph.links.push({
			source: 2*index,
			target: 2*index + 1,
			text: person.name + '\n(' + person.email + ')',
			dummy: true
		})									
	});				
	people.map(function(person, index) {
		person.friends.map(function(friend) {
			graph.links.push({
				source: indices[person._id],
				target: indices[friend]
			});						
		});
	});		
	
	return graph;		
}

app.get('/join', function(req, res) {
	if (!req.query || !req.query.code) {
		var authUrl = fbg.getOauthUrl({
			client_id: CONF.CLIENT_ID,
			redirect_uri: CONF.REDIRECT_URI,
			scope: CONF.PERMISSIONS.join(',')
		});
		res.redirect(authUrl);
		return;
	}
	
	fbg.authorize({
		client_id: CONF.CLIENT_ID,
		redirect_uri: CONF.REDIRECT_URI,
		client_secret: CONF.CLIENT_SECRET,
		code: req.query.code
	}, function(err, fbRes) {
		if(err) {		
			res.render('error', {err: JSON.stringify(err, null, 4)});
		}
		else if (!fbRes || fbRes.error) {		
			res.render('error', {err: JSON.stringify(fbRes.error, null, 4)});			
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
					
					var person = parsed[0];
					person.friends = _.map(parsed[1].data, function(elem) {
							return elem.id;
					});										
				
					MongoClient.connect(CONF.MONGODB_URL, function(err, db) {
						if (err) {
						
							res.render('error', {err: JSON.stringify(err, null, 4)});
							return;
						}
						
						var people = db.collection('people');
						
						people.update({_id: person.id}, _.omit(person, 'id'), {upsert: true})
							.then(function() {
								db.close();
							})
							.then(function() {
								res.redirect('/');								
							}, function(err) {
								res.render('error', {err: JSON.stringify(err, null, 4)});								
							});
					});					
				});		
		}			
	});	
});
 