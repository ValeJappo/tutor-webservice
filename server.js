/*

 This file is part of the Toolforge Node.js tutorial

 Copyright (C) 2018 Srishti Sethi and contributors

 This program is free software: you can redistribute it and/or modify it
 under the terms of the GNU General Public License as published by the Free
 Software Foundation, either version 3 of the License, or (at your option)
 any later version.

 This program is distributed in the hope that it will be useful, but WITHOUT
 ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 more details.

 You should have received a copy of the GNU General Public License along
 with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

var express = require( "express" );
var session = require( "express-session" );
var passport = require( "passport" );
var MediaWikiStrategy = require( "passport-mediawiki-oauth" ).OAuthStrategy;
var config = require( "./config" );
var https = require("https");
const { exec } = require("child_process");
const bodyParser = require("body-parser");
const url = require('url');

var app = express();
var router = express.Router();

function searchParams(req){
	const current_url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl)
	const search_params = current_url.searchParams;
	return search_params;
}

const wikis = ['it', 'test'];

var mentors = null
https.get('https://it.wikipedia.org/w/api.php?action=query&format=json&prop=links&titles=Progetto:Coordinamento/Accoglienza/Growth&plnamespace=2&pllimit=500', res => {
       let data = [];
       const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';

        res.on('data', chunk => {
        	data.push(chunk);
        });

       	res.on('end', () => {
		mentors=data.toString();
		console.log(mentors);
	});
});

app.set( "views", __dirname + "/public/views" );
app.set( "view engine", "ejs" );
app.use( express.static(__dirname + "/public/views") );

app.use(bodyParser.urlencoded({
   extended: false
}));

app.use( session({ secret: "OAuth Session",
	saveUninitialized: true,
	resave: true,
}) );

app.use(passport.initialize());
app.use(passport.session());

app.use( "/", router );

passport.use(
	new MediaWikiStrategy({
		consumerKey: config.consumer_key,
		consumerSecret: config.consumer_secret
	},
	function ( token, tokenSecret, profile, done ) {
		profile.oauth = {
			consumer_key: config.consumer_key,
			consumer_secret: config.consumer_secret,
			token: token,
			token_secret: tokenSecret
		};
		return done( null, profile );
	}
	) );

passport.serializeUser(	function ( user, done ) {
	done( null, user );
});

passport.deserializeUser( function ( obj, done ) {
	done( null, obj );
});

router.get( "/", function ( req, res ) {
	try{
		var isMentor=mentors.toString().includes("\"Utente:"+req.session.user.displayName.toString()+"\"");
	} catch (e) {
		if (e instanceof TypeError || e instanceof ReferenceError){ 
			var isMentor=false;
		} else { throw (e); }
	}
	if (!searchParams(req).has("wiki")){
		if (wikis.includes(searchParams(req).get("wiki"))){
			res.render( "home", {
				user: req && req.session && req.session.user,
				tutor: isMentor,
				url: req.baseUrl,
				wiki: searchParams(req).get("wiki")
			} );
		}
	}

	res.render( "index", {
			user: req && req.session && req.session.user,
			tutor: isMentor,
			url: req.baseUrl
	} );
});

router.get( "reassign", function ( req, res ) {
	if (searchParams(req).has("wiki")){
		if (wikis.includes(searchParams(req).get("wiki"))){
			try{
					var isMentor=mentors.toString().includes("\"Utente:"+req.session.user.displayName.toString()+"\"");
			} catch (e) {
					if (e instanceof TypeError || e instanceof ReferenceError){
							var isMentor=false;
					}else { throw (e); }
			}

			if(!(req && req.session && req.session.user)){
				res.redirect( req.baseUrl + "/oauth-callback" );
			} else if (req && req.session && req.session.user) {
					res.render( "reassign", {
						user: req && req.session && req.session.user,
							tutor: isMentor,
							url: req.baseUrl,
							wiki: searchParams(req).get("wiki")
					} );
			}
		}
	}
});

router.post( "reassign", function ( req, res ) {
	try{
				var isMentor=mentors.toString().includes("\"Utente:"+req.session.user.displayName.toString()+"\"");
		} catch (e) {
				if (e instanceof TypeError || e instanceof ReferenceError){
						var isMentor=false;
				} else { throw (e); }
		}

	if (req && req.session && req.session.user && isMentor){
		exec("cd && sh reassign.sh \""+req.body.wiki+"\" \""+req.session.user.displayName+"\" \""+req.body.target+"\"")
		res.send("ok");
	} else {  res.status(403).send("Accesso negato. Permessi insufficienti."); }
} );

router.get( "/login", function ( req, res ) {
	res.redirect( req.baseUrl + "/oauth-callback" );
} );
 
router.get( "/oauth-callback", function( req, res, next ) {
	passport.authenticate( "mediawiki", function( err, user ) {
		if ( err ) {
			return next( err );
		}

		if ( !user ) {
			return res.redirect( req.baseUrl + "/login" );
		}

		req.logIn( user, function( err ) {
			if ( err ) {
				return next( err );
			}
			req.session.user = user;
			res.redirect( req.baseUrl + "/" );
		} );
	} )( req, res, next );
} );

router.get( "/logout" , function ( req, res ) {
	delete req.session.user;
	res.redirect( req.baseUrl + "/" );
} );

app.listen( process.env.PORT || 5000, function () {
	console.log( "Node.js app listening on port 5000!" );
} );
