var fs = require('fs');
var http = require('http');
var url = require('url');
var swig = require('swig');
var fbg = require('fbgraph');
var MongoClient = require('mongodb').MongoClient;

var logs = [];
function log(msg) {
	console.log(msg);
	logs.push(msg);	
}

var CONF = {
	CLIENT_ID: process.env.FB_CLIENT_ID,
	CLIENT_SECRET: process.env.FB_CLIENT_SECRET,
	REDIRECT_URI: 'http://gopapp.herokuapp.com',
	PORT: process.env.PORT || 8888,
	PERMISSIONS: ['public_profile', 'email', 'user_friends'],
	VIEW_PATH: 'app.html',
	MONGODB_URL: process.env.MONGODB_URL
}

var server = http.createServer(handleRequest);
server.listen(CONF.PORT);
log('Server is listening on port ' + CONF.PORT);
	
function handleRequest(req,res) {
	log('got request');
	
	var query = url.parse(req.url, true).query;
	 
	if (!query || !query.code) {
		var authUrl = fbg.getOauthUrl({
			client_id: CONF.CLIENT_ID,
			redirect_uri: CONF.REDIRECT_URI,
			scope: CONF.PERMISSIONS.join(',')
		});
		
		log('redirecting to facebook to get permissions', authUrl);
		res.writeHead(302, {
			Location: authUrl
		});
		res.end();
		return;
	}
	
	log('got code', query.code);
	
	fbg.authorize({
		client_id: CONF.CLIENT_ID,
		redirect_uri: CONF.REDIRECT_URI,
		client_secret: CONF.CLIENT_SECRET,
		code: query.code
	}, function(err, fbRes) {
		log('response from facebook', fbRes);
		
		if (fbRes || fbRes.error) {
			renderView(res, {text: '_ No Luck _', textClass : 'bad', logs: logs});			
		} else {
			log('connecting to mongo', CONF.MONGODB_URL);			
			MongoClient.connect(CONF.MONGODB_URL, function(err, db) {
				if (err) return log(err);
				
				log('connected to mongodb');
				db.close();
				
				renderView(res, {text: '!!! All Done !!!', textClass: 'good', logs: logs});
			});			
		}			
	});
}

function renderView(res, data) {
	res.writeHead(200, {
		'Content-Type': 'text/html'
	});
	res.write(swig.render(fs.readFileSync(CONF.VIEW_PATH, 'utf-8'), { locals: data }));
	res.end(function() {
		log('done processing request');
	});	
}