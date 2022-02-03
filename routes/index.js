// jshint esversion: 6
var axios = require('axios');
var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
var session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const short = require('short-uuid');
const LeagueLogic = require('./league.js');
var router = express.Router();
var clientId = process.env.CLIENTID;
var clientSecret = process.env.CLIENTSECRET;
var port = 3000;
var username = process.env.MONGO_USER;
var password = process.env.MONGO_PASSWORD;
const uri = `mongodb+srv://${username}:${password}@cluster0.qrezy.mongodb.net?retryWrites=true&w=majority`;

router.use(session({
  genid: function(req) {
    return uuidv4(); 
  },
  resave: true,
  saveUninitialized: true,
  secret: process.env.CLIENTSECRET
}));

router.use(defaultSession);

MongoClient.connect(uri)
.then((client) => {
	console.log("Connected to Database");
	const leaguesDB = client.db("wowdraft");
	const players = client.db("proplayers");



	if(process.env.NODE_ENV=="debug") {
		router.get('/admin', function(req, res, next) {
			console.log(req.session);
			if(req.session.loggedin && req.session.username == "monarlisarrr#8207") {

				leaguesDB.collection("leagues").find().toArray()
				.then((leagues) =>  {
					res.render('admin', { 
						title: 'All Leagues ADMIN MODE', 
						leagues: JSON.stringify(leagues), 
						user_session_auth: req.session.loggedin, 
						user_session_name: req.session.username
					});
				});
			} else {
				res.redirect("/");
			}
		});

		router.get('/admin/leagues/delete/:leagueID', function(req, res, next) {
			if(req.session.loggedin && req.session.username == "monarlisarrr#8207") {
				leaguesDB.collection("leagues").deleteOne({code: req.params.leagueID})

				.then(res.redirect("/admin"));
			} else {
				res.redirect("/");
			}
		});

		router.get('/admin/flush', function(req, res, next) {
			if(req.session.loggedin && req.session.username == "monarlisarrr#8207") {
				console.log("flushing");
				players.collection("dps").drop();
				players.collection("healers").drop();
				players.collection("tanks").drop();

				res.redirect("/admin");
			}
		});

	}


	// All Leagues Page
	router.get('/leagues', function(req, res, next) {
		leaguesDB.collection("leagues").find().toArray()
		.then((leagues) =>  {
			res.render('leagues', { 
				title: 'All Leagues', 
				leagues: JSON.stringify(leagues), 
				user_session_auth: req.session.loggedin, 
				user_session_name: req.session.username
			});
		});
	});

	// League Home Page
	router.get('/leagues/:leagueID', function(req, res, next) {
		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {

			var leaguelogic = new LeagueLogic(league, req.session);

			res.render('league', { 
				title: league.name, 
				league: JSON.stringify(league), 
				organizer: leaguelogic.sessionIsAdmin(), 
				canMakeTeam: leaguelogic.canMakeTeam(), 
				user_session_auth: req.session.loggedin, 
				user_session_name: req.session.username
			});
		})
		.catch((err) => {
			res.redirect("/404");
		});
	});

	// League Teams Page
	router.get('/leagues/:leagueID/teams', function(req, res, next) {
		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			res.render('league_teams', { 
				title: league.name, 
				league: JSON.stringify(league), 
				user_session_auth: req.session.loggedin, 
				user_session_name: req.session.username
			});
		})
		.catch((err) => {
			console.log(err);
			res.redirect("/404");
		});
	});

	// Team Creation Form
	router.get('/leagues/:leagueID/newTeam', function(req, res, next) {
		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			res.render('create_team', { 
				title: league.name, 
				leagueID: req.params.leagueID, 
				user_session_auth: req.session.loggedin, 
				user_session_name: req.session.username
			});
		})
		.catch((err) => {
			res.redirect('/404');
		});
	});


	router.get('/leagues/:leagueID/rankings', function(req, res, next) {
		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			res.render('league_rankings', { title: league.name, league: JSON.stringify(league), user_session_auth: req.session.loggedin, user_session_name: req.session.username});
		})
		.catch((err) => {
			console.log(err);
			res.redirect("/404");
		});
	});

	router.get('/leagues/:leagueID/start', function(req, res, next) {
 		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			var leaguelogic = new LeagueLogic(league, req.session);

			leaguelogic.startDraft();

			leaguesDB.collection("leagues").updateOne({code: req.params.leagueID}, {$set: leaguelogic.league})
			.then((update_result) => {
				res.redirect(`/leagues/${req.params.leagueID}/`);
			})
			.catch((update_err) => {
				console.log(update_err);
				res.redirect('/404');
			});
		})
		.catch((err) => {
			res.redirect('/404');
		});
	});


	router.get('/leagues/:leagueID/skip', function(req, res, next) {
		var leagueID = req.params.leagueID;

		leaguesDB.collection("leagues").findOne({code: leagueID})
		.then((league) =>  {

			var leaguelogic = new LeagueLogic(league, req.session);
			leaguelogic.skip();

			leaguesDB.collection("leagues").updateOne({code: leagueID}, {$set: leaguelogic.league})
			.then((update_result) => {
				res.redirect(`/leagues/${req.params.leagueID}/`);
			})
			.catch((update_err) => {
				console.log(update_err);
			});
		})
		.catch((err) => {
			conosle.log(err);
			res.redirect("/403");
		});
	});

	router.get('/leagues/:leagueID/proplayers', function(req, res, next) {
		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {

			var leaguelogic = new LeagueLogic(league, req.session);

			res.render('proplayers', { 
				title: league.name, 
				leagueID: req.params.leagueID, 
				onClock:leaguelogic.isCurrentTeamManager(), 
				user_session_auth: req.session.loggedin, 
				user_session_name: req.session.username});
		})
		.catch((err) => {
			res.redirect('/404');
		});
	});



	router.get('/api/proplayers/:leagueID/:tag/:page', function(req, res, next) {
		var { leagueID, tag, page } = req.params;

		leaguesDB.collection("leagues").findOne({code: leagueID})
		.then((league) =>  {
			var faction = 0;
			if(league.faction == "Horde") { faction = 1; }

			players.collection(tag).find({
				drafted: { $nin: [leagueID] }, 
				faction: faction
			}).skip(parseInt(page*10)).limit(10).toArray()
			.then((proplayers) =>  {
				res.json(proplayers);
			})
			.catch((err) => {
				res.json(err);
			});
		})
		.catch((err) => {
			console.log(err);
			res.json(err);
		});
	});

	router.get('/api/proplayer/:leagueID/:tag/:name/', function(req, res, next) {
		var { leagueID, tag, name } = req.params;

		leaguesDB.collection("leagues").findOne({code: leagueID})
		.then((league) =>  {
			var faction = 0;
			if(league.faction == "Horde") { faction = 1; }

			players.collection(tag).find({
				drafted: {$nin: [leagueID]}, 
				faction: faction, 
				name: { 
					$regex: `${name}`, 
					$options : 'i'}
				}).limit(10).toArray()
			.then((proplayers) =>  {
				res.json(proplayers);
			})
			.catch((err) => {
				res.json(err);
			});
		})
		.catch((err) => {
			console.log(err);
			res.json(err);
		});
	});


	router.get('/api/proplayer/guild/:leagueID/:tag/:guild/:page', function(req, res, next) {
		var { leagueID, tag, guild, page } = req.params;

		leaguesDB.collection("leagues").findOne({code: leagueID})
		.then((league) =>  {
			var faction = 0;
			if(league.faction == "Horde") { faction = 1; }

			players.collection(tag).find({drafted: {$nin: [leagueID]}, faction: faction, guild: { $regex: `${guild}`, $options : 'i'}}).skip(parseInt(page*10)).limit(10).toArray()
			.then((proplayers) =>  {
				res.json(proplayers);
			})
			.catch((err) => {
				console.log(err);
				res.json(err);
			});
		})
		.catch((err) => {
			console.log(err);
			res.json(err);
		});
	});

	router.get('/api/leagues/:leagueID', function(req, res, next) {
		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			res.json(league);
		})
		.catch((err) => {
			res.redirect("/404");
		});
	});

	router.get('/api/leagues/:leagueID/teams', function(req, res, next) {
		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			res.json(league.teams);
		})
		.catch((err) => {
			res.redirect("/404");
		});
	});


	router.post('/api/leagues/:leagueID/activity_report', function(req, res, next) {
		var activity = req.body;

		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			if(!league.activity_reports) {
				league.activity_reports = [];
			}

			league.activity_reports.push({time: new Date(), data: req.body.data});
			
			leaguesDB.collection("leagues").updateOne({code: req.params.leagueID}, { $set: { activity_reports: league.activity_reports}})
			.then((update_result) => {
				res.json({msg: "Accepted"});
			})
			.catch((update_err) => {
				res.json({err: err});
			});
		})
		.catch((err) => {
			res.json({err: err});
		});
	});

	router.get('/api/leagues/:leagueID/draftInfo', function(req, res, next) {
		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			res.json(league.draft);
		})
		.catch((err) => {
			res.redirect("/404");
		});
	});

	router.post('/api/leagues/:leagueID/newTeam', function(req, res, next) { 
		if(req.session.loggedin) {
			console.log("attempting to add a new team to " + req.params.leagueID);
			var team_body = req.body;

			leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
			.then((league) => {
				var leaguelogic = new LeagueLogic(league, req.session);

				leaguelogic.addTeam(team_body);

				leaguesDB.collection("leagues").updateOne({code: req.params.leagueID}, {$set: leaguelogic.league})
				.then((update_result) => {	
					res.redirect(`/leagues/${req.params.leagueID}/`);
				})
				.catch((update_err) => {
					console.log(update_err);
				});
			})
			.catch((league_error) => {
				console.log(league_error);
				console.log("league doesn't exist");
				res.redirect("/404");
			});
		} else {
			res.redirect("/403");
		}
	});

	router.post('/api/leagues/:leagueID/draftPlayer', function(req, res, next) {

		var leagueID = req.params.leagueID;
		var tag = req.body.tag.toLowerCase();
		var playerID = new ObjectId(req.body.player_id);

		leaguesDB.collection("leagues").findOne({code: leagueID})
		.then((league) =>  {
			players.collection(tag).findOne({_id: playerID})
			.then((player) => {
				var leaguelogic = new LeagueLogic(league, req.session);

				// draft player, if successful go ahead and tell the db the player was
				// league'd
				if(leaguelogic.draftPlayer(player)) {
					player.drafted.push(leagueID);
					
					players.collection(tag).updateOne({_id: playerID}, { $set: { drafted: player.drafted}})
					.then((p_update_res) => {
						console.log("Player updated successfully");
					})
					.catch((p_err) => {
						console.log("player update error", p_err);
					});
				}

				leaguesDB.collection("leagues").updateOne({code: leagueID}, {$set: leaguelogic.league})
				.then((update_result) => {
					res.redirect(`/leagues/${req.params.leagueID}/`);
				})
				.catch((update_err) => {
					console.log(update_err);
				});
			});
		})
		.catch((err) => {
			console.log("league err", err);
		});
	});

	router.post('/api/leagues/create', function(req, res, next) {
		if(req.session.loggedin) {
			// move to leaguelogic lol
			var new_league = req.body;
			console.log(req.body)
			new_league.code = short.generate();
			new_league.admin = {name: req.session.username};
			new_league.teams = [];
			new_league.status = "Setting Up";
			new_league.draft = {
				pick_order: [0],
				pick_index: 0,
				picks: [],
				status: 0,
			};

			new_league.requirements = {
				dps: 5,
				healers: 2,
				tanks: 2
			};

			leaguesDB.collection("leagues").insertOne(new_league)
			.then(mongoResult => {
				res.redirect("/leagues");
			})
			.catch((err) => {
				res.redirect("/403");
			});
		} else {
			res.redirect("/403");
		}
	});
})

.catch((err) => {
	console.log(err);
	console.log("MONGODB Server Error");
});


router.get('/', function(req, res, next) {
	res.redirect("/leagues");
});


router.get('/proplayers', function(req, res, next) {
	res.render('proplayers', { title: 'Homepage', user_session_auth: req.session.loggedin, user_session_name: req.session.username});
});


router.get('/login', function(req, res, next) {
	res.render('login', { title: 'Login', user_session_auth: req.session.loggedin, user_session_name: req.session.username});
});


router.get('/logout', function(req, res, next) {
	req.session.loggedin = false;
	req.session.username = null;
	res.redirect("/");
});

router.get('/leagues/create', function(req, res, next) {
	res.render('create_league', { title: 'League Creation', user_session_auth: req.session.loggedin, user_session_name: req.session.username});
});

router.get('/404', function(req, res, next) {
	res.render('404page', { title: 'Oops!', user_session_auth: req.session.loggedin, user_session_name: req.session.username});
});

router.get('/403', function(req, res, next) {
	res.render('403page', { title: 'Oops!', user_session_auth: req.session.loggedin, user_session_name: req.session.username});
});


router.get('/auth', function(req, res, next) {
	const { code } = req.query;

	if (code) {
		const params = new URLSearchParams();
		params.append('client_id', clientId);
		params.append('client_secret', clientSecret);
		params.append('code', code);
		params.append('grant_type', 'authorization_code');

		if(process.env.NODE_ENV != "production") {
			params.append('redirect_uri', 'http://localhost:3000/auth');
		} else {
			params.append('redirect_uri', 'https://wowdraft.herokuapp.com/auth');
		}

		params.append('scope', 'identify');

		axios.post("https://discord.com/api/oauth2/token", params, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			}
		})
		.then(authentication_result => {
			axios.get('https://discord.com/api/users/@me', {
				headers: {
					authorization: `${authentication_result.data.token_type} ${authentication_result.data.access_token}`,
				},
			})
			.then((user_result)=> {
				user_result = user_result.data;
				req.session.loggedin = true;
				req.session.username = user_result.username + "#" + user_result.discriminator;
				res.redirect("/");
			})
			.catch((user_err) => {
				console.log("user error");
				console.log(user_err)
				res.redirect('/404');
			});
		})
		.catch(err => {
			console.log(err)
			res.redirect('/404');
		});
	}
});

function defaultSession(req, res, next) {
	if(!req.session.loggedin) {
		req.session.loggedin = false;
	}
	next();
}

module.exports = router;
