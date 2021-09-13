// jshint esversion: 6
var axios = require('axios');
var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
var session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const short = require('short-uuid');


var router = express.Router();

router.use(session({
  genid: function(req) {
    return uuidv4(); 
  },
  secret: 'funny secret :)'
}));

router.use(defaultSession);

var username = process.env.MONGO_USER;
var password = process.env.MONGO_PASSWORD;

const uri = `mongodb+srv://${username}:${password}@cluster0.qrezy.mongodb.net?retryWrites=true&w=majority`;

MongoClient.connect(uri)
.then((client) => {
	console.log("Connected to Database");
	const leaguesDB = client.db("wowdraft");
	const players = client.db("proplayers");

	router.get('/leagues', function(req, res, next) {
		leaguesDB.collection("leagues").find().toArray()
		.then((leagues) =>  {
			res.render('leagues', { title: 'All Leagues', leagues: JSON.stringify(leagues), user_session_auth: req.session.loggedin, user_session_name: req.session.username});
		});
	});

	router.get('/leagues/:leagueID', function(req, res, next) {
		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			var canMakeTeam = true;
			var organizer = false;

			for(var manager in league.managers) {
				if(league.managers[manager].name == req.session.username) {
					canMakeTeam = false;
				}
			}

			if(!req.session.loggedin) {
				canMakeTeam = false;
			}

			if(league.admin.name == req.session.username) {
				organizer = true;
			}

			res.render('league', { title: league.name, league: JSON.stringify(league), organizer: organizer, canMakeTeam: canMakeTeam, user_session_auth: req.session.loggedin, user_session_name: req.session.username});
		})
		.catch((err) => {
			res.redirect("/404");
		});
	});

	router.get('/leagues/:leagueID/teams', function(req, res, next) {
		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			res.render('league_teams', { title: league.name, league: JSON.stringify(league), user_session_auth: req.session.loggedin, user_session_name: req.session.username});
		})
		.catch((err) => {
			console.log(err);
			res.redirect("/404");
		});
	});


	router.get('/leagues/:leagueID/newTeam', function(req, res, next) {
		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			res.render('create_team', { title: league.name, leagueID: req.params.leagueID, user_session_auth: req.session.loggedin, user_session_name: req.session.username});
		})
		.catch((err) => {
			res.redirect('/404');
		});
	});


	router.get('/leagues/:leagueID/start', function(req, res, next) {
 		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			var pick_order = [];
			var	pick_index = 0;

			// check if ur the organizer
			if((!league.admin.name == req.session.username) || league.teams.length < 2) {
				res.redirect('/403');
			}

			for(var x=0; x<parseInt(league.rounds);x++) {
				for(var y=0; y<league.teams.length;y++) {
					pick_order.push(y);
				}
			}

			var draft = {
				pick_order: pick_order,
				pick_index: 0,
				picks: [],
				inProgress: true,
				started: true,
			};

			leaguesDB.collection("leagues").updateOne({code: req.params.leagueID}, { $set: { status: "In Progress", draft: draft }})
			.then((update_result) => {
				// success!
				res.redirect(`/leagues/${req.params.leagueID}/`);
			})
			.catch((update_err) => {
				console.log(update_err);
			});

		})
		.catch((err) => {
			res.redirect('/404');
		});
	});

	router.get('/api/proplayers/:league/:tag/:page', function(req, res, next) {
		var { league, page, tag } = req.params;

		leaguesDB.collection("leagues").findOne({code: req.params.league})
		.then((league) =>  {
			var faction = 0;
			if(league.faction == "Horde") { faction = 1; }

			players.collection(tag).find({drafted: {$nin: [league]}, faction: faction}).skip(parseInt(page*10)).limit(10).toArray()
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

	router.get('/api/proplayer/:league/:tag/:name/', function(req, res, next) {
		var { league, name, tag } = req.params;

		leaguesDB.collection("leagues").findOne({code: req.params.league})
		.then((league) =>  {
			var faction = 0;
			if(league.faction == "Horde") { faction = 1; }

			players.collection(tag).find({drafted: {$nin: [league]}, faction: faction, name: { $regex: `${name}`, $options : 'i'}}).limit(10).toArray()
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


	router.get('/api/proplayer/guild/:league/:tag/:guild/:page', function(req, res, next) {
		var { league, guild, tag, page } = req.params;

		leaguesDB.collection("leagues").findOne({code: req.params.league})
		.then((league) =>  {
			var faction = 0;
			if(league.faction == "Horde") { faction = 1; }

			players.collection(tag).find({drafted: {$nin: [league]}, faction: faction, guild: { $regex: `${guild}`, $options : 'i'}}).skip(parseInt(page*10)).limit(10).toArray()
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
		})
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




	router.post('/api/leagues/:leagueID/activity_report', function(req, res, next) {
		var activity = req.body;

		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			if(!league.activity_reports) {
				league.activity_reports = [];
			}

			league.activity_reports.push({time: new Date().getTime(), data: req.body.data});
			
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
			var new_team = req.body;

			leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
			.then((league) => {
				var hasTeamAlready = false;
				var hasUniqueName = true;


				if(league.status != "Setting Up") {
					res.redirect('/405');
				}


				for(var manager in league.managers) {
					if(league.managers[manager].name == req.session.username) {
						hasTeamAlready = true;
					}
				}

				for(var team in league.teams) {
					if(league.teams[team].name == new_team.name) {
						hasUniqueName = false;
					}
				}

				if(!hasUniqueName || hasTeamAlready) {
					res.redirect('/405');
					return;
				}

				new_team.id = short.generate();
				new_team.drafted_players = [];
				new_team.roles_drafted = {
					dps: 0,
					healers: 0,
					tanks: 0
				};

				league.teams.push(new_team);
				league.managers.push({
					"name": req.session.username,
					"team": league.teams.length-1
				});

				leaguesDB.collection("leagues").updateOne({code: req.params.leagueID}, { $set: { teams: league.teams, managers: league.managers }})
				.then((update_result) => {
					// success!
					res.redirect(`/leagues/${req.params.leagueID}/`);
				})
				.catch((update_err) => {
					console.log(update_err);
				});

			})
			.catch((league_error) => {
				console.log("league doesn't exist");
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

			// draft is over
			if(league.draft.started && !league.draft.inProgress) {
				res.redirect("/403");
				return;
			}

			players.collection(tag).findOne({_id: playerID})
			.then((player) => {

				var current_team = league.draft.pick_order[league.draft.pick_index];

				if(league.managers[current_team].name != req.session.username) {
					res.redirect("/403");
					return;
				}

				var mini_player = { 
					id: playerID, name: player.name, class: player.class, guild: player.guild, spec: player.rankings[0].spec, role: tag};

				league.draft.picks.push({
					team: league.teams[current_team],
					manager: league.managers[current_team],
					player: mini_player,
				});

				league.teams[current_team].drafted_players.push(mini_player);

				league.teams[current_team].roles_drafted[tag]++;

				player.drafted.push(leagueID);

				players.collection(tag).updateOne({_id: playerID}, { $set: { drafted: player.drafted}})
				.then((p_update_res) => {
					console.log("Player updated successfully");
				})
				.catch((p_err) => {
					console.log("player update error", p_err);
				});

				league.draft.pick_index++;

				if(league.draft.pick_index == league.draft.pick_order.length) {
					// draft is over!
					console.log("DRAFT IS OVER!!!");
					league.draft.inProgress = false;
					league.status = "Completed";
				}

				leaguesDB.collection("leagues").updateOne({code: leagueID}, { $set: { draft: league.draft, teams: league.teams, status: league.status }})
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


	router.get('/leagues/:leagueID/proplayers', function(req, res, next) {
		leaguesDB.collection("leagues").findOne({code: req.params.leagueID})
		.then((league) =>  {
			var current_team = league.draft.pick_order[league.draft.pick_index];

			var onClock = false;

			if(league.draft) {

				if(league.draft.inProgress) {
				// should store an actual onClock variable here rather than calculating it
					if(league.managers[current_team].name == req.session.username) {
						onClock = true;
					}
				}
			}

			res.render('proplayers', { 
				title: league.name, 
				leagueID: req.params.leagueID, 
				onClock:onClock, 
				user_session_auth: req.session.loggedin, 
				user_session_name: req.session.username});
		})
		.catch((err) => {
			res.redirect('/404');
		});
	});


	router.post('/api/leagues/create', function(req, res, next) {
		if(req.session.loggedin) {
			var new_league = req.body;
			new_league.code = uuidv4();
			new_league.admin = {name: req.session.username};
			new_league.teams = [];
			new_league.managers = [];
			new_league.status = "Setting Up";
			new_league.draft = {
				pick_order: [0],
				pick_index: 0,
				picks: [],
				inProgress: false,
				started: false,
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




var clientId = process.env.CLIENTID;


var clientSecret = process.env.CLIENTSECRET;
var port = 3000;

router.get('/auth', function(req, res, next) {
	const { code } = req.query;

	if (code) {
		const params = new URLSearchParams();
		params.append('client_id', clientId);
		params.append('client_secret', clientSecret);
		params.append('code', code);
		params.append('grant_type', 'authorization_code');
		params.append('redirect_uri', 'https://wowdraft.herokuapp.com/auth');
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
				res.redirect('/404');
			});
		})
		.catch(err => {
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
