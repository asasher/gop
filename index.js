var fs = require('fs');
var swig = require('swig');
var http = require('http');
var url = require('url');
var fbg = require('fbgraph');

var conf = {
	client_id: process.env.FB_CLIENT_ID,
	redirect_uri: 'http://gopapp.herokuapp.com/',
	port: process.env.PORT || 8888,
	permissions: ['public_profile', 'email', 'user_friends']
}

var template = fs.readFileSync('index.html', 'utf-8');
var fbAuthUrl = 'https://graph.facebook.com/oauth/authorize?client_id=' + conf.client_id + '&redirect_uri=' + conf.redirect_uri + '&scope=' + conf.permissions.join(',');
var landingView = swig.render(template, {locals: {link: fbAuthUrl}});

function doFBStuff(err, fbRes) {
	if(err) {
        console.log(err);
    }
    else{
        if(fbRes.access_token) {
			console.log("Got Access Token");
            fbg.setAccessToken(fbRes.access_token);
			fbg.get('me/friends', function(err, res) {
				if (err) console.log(err);
				else console.log(res);
			});         	  
        }
    }	
}

http.createServer(function(req, res) {
	var query = url.parse(req.url).query;
	var ok = false;
	
	res.writeHead(200, {"Content-Type": "text/html"});
	 
	if (query) {
		var code = query.code;
		ok = true;
		res.write('all done.');			
	} else {
		res.write(landingView);			
	}
	
	res.end();
		
	if (ok) {
		console.log('Got code. Time to work for a living.');
		fbg.authorize ({
			"client_id": fbg.client_id,
			"redirect_uri": fbg.redirect_uri,
			"client_secret": fbg.client_secret,
			"code": code
		}, function(err, fbRes) {
			doFBStuff(err, fbRes);		
		});				
	} else {
		console.log('Got no code.');
	}	
}).listen(conf.port);

console.log('Server is listening on port ' + conf.port);
