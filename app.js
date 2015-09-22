var fs = require('fs');
var http = require('http');
var url = require('url');
var fbg = require('fbgraph');
var MongoClient = require('mongodb').MongoClient;

var CONF = {
	CLIENT_ID: process.env.FB_CLIENT_ID,
	CLIENT_SECRET: process.env.FB_CLIENT_SECRET,
	REDIRECT_URI: 'http://gopapp.herokuapp.com/',
	PORT: process.env.PORT || 8888,
	PERMISSIONS: ['public_profile', 'email', 'user_friends'],
	VIEW_PATH: 'app.html',
	MONGODB_URL: process.env.MONGODB_URL
}

var server = http.createServer(handleRequest);
server.listen(CONF.PORT);
console.log('Server is listening on port ' + CONF.PORT);
	
function handleRequest(req,res) {
	console.log('got request');
	
	var query = url.parse(req.url, true).query;
	
	console.log(query, query.code);
	 
	if (!query || !query.code) {
		var authUrl = fbg.getOauthUrl({
			client_id: CONF.CLIENT_ID,
			redirect_uri: CONF.REDIRECT_URI,
			scope: CONF.PERMISSIONS.join(',')
		});
		
		console.log('redirecting to facebook to get permissions');
		res.writeHead(302, {
			"Location": authUrl
		});
		res.end();
		return;
	}
	
	console.log('got code', query.code);
	
	fbg.authorize({
		client_id: CONF.CLIENT_ID,
		redirect_uri: CONF.REDIRECT_URI,
		client_secret: CONF.CLIENT_SECRET,
		code: query.code
	}, function(err, fbRes) {
		console.log('response from facebook', fbRes);
		
		MongoClient.connect(url, function(err, db) {
			if (err) return console.log(err);
			
			console.log("connected to mongodb");
			db.close();
			
			res.writeHead(200, {
				"Content-Type": "text/html"
			});
			res.write(fs.readFileSync(CONF.VIEW_PATH, 'utf-8'));
			res.end(function() {
				console.log('done processing request');
			});
		});	
	});
}