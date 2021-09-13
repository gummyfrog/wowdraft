// jshint esversion: 6

var { GraphQLClient, request, gql } = require('graphql-request');
var axios = require("axios").default;
var fs = require('fs');
var json = require("jsonfile");
var Emitter = require('events');

class guild_fetcher extends Emitter {

	constructor(_grob_guilds, _name) {
		super();

		this.name = _name;
		this.guild_ids = _grob_guilds.data;
		console.log(this.guild_ids.length, "Guilds Indexed");
		this.in_queue = 0;
		this.done = 0;

		// this.players = [{guild_id:604955, group: "dps", name: "Windpipe"}, {guild_id: 481889, group:"healers", name:"Sydthakyd"}];
		this.player_data = {};
		this.players = [];
		this.team = "";
		// loop over the guilds that these players run in

		this.options = {
			method: 'POST',
			url: 'https://www.warcraftlogs.com/api/v2/client/',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NDU0MWQ0ZS01Y2I0LTQwZjUtYjY0NC0zYThkZWI3ZjNhYmQiLCJqdGkiOiJjOTk3OGUyNWVlM2NmM2ZiODI4MDFmN2FmNWMwOTMxMDBhN2Y4NTAzMGI4ZjhiODk3YThhMjg3MjUxM2ZlNGJjZmE2YTMxNjU2ODhmZGM0NiIsImlhdCI6MTYzMDg4OTk5NywibmJmIjoxNjMwODg5OTk3LCJleHAiOjE2NDEyNTc5OTcsInN1YiI6IiIsInNjb3BlcyI6WyJ2aWV3LXVzZXItcHJvZmlsZSIsInZpZXctcHJpdmF0ZS1yZXBvcnRzIl19.PUgYIo4nW5nhTRLMAejlLcyaZXtqSzxPdqMkgQW3PBF5DF9oIC_QkC3I7HbtQsBKdQwET_AoO6fDyymdJCTNoPBacBMYPccqIvACDeCeL5w9cN0Nt5c6Frce0RJVpGjdbyLGokKiwPwSE6W--vjk4b3CtvwKzTGYGUef6P993HAauEkZu2IPjZNNCjHy7IvRpl1kWXvGlOffH6V7_CS4hM4ZKz_eKdcxi0FraFuRJPLVvCGCRqbNOzoURl5LpKQNJeG9XQteWPNiXbZlTtGmROTTJVNplG5M_1JKKD41FnZQaUexJLbF_CDbUnw0KWFrwTQz6Czh2aFfeg4f96xKUhSc8fIWi9g4L5vlfqSOxLBPVwyYCECXE0-yaWk7_vzIWJlL_a3j1YrESpyJzYqdvSbW-7xu3hXDp2K0PaErrvQtBdVOLQmYM9TweQsA0s5agGXCEDIW3TW38QdcpnD1qq5RgtXCmsscmql9Qr_euClTJ27Dzj4xQe88tzO7lwe3GfkCYXI9aSBxF2IqbtjHXNP9Ooj6TEys-p3T18QRKJ81yBA5IXCnHxXR9nJtqHgiV7fz-sKMPsElVBEZErTjcELIquhMQjmvyVl3XksLB73VbGW_Vn8d6ViJUYlAJxDp9QsVtKD-JJU3UZuZjV2H-Zq45awKffd3mkum-5quPx4'
			},
		};
	}

	start(players, team, team_id) {
		this.players = players;
		this.team = team;
		this.team_id = team_id;
		for(var x=0; x<this.players.length;x++) {
			var player = this.players[x];
			this.call_guild(player);
		}
	}


	get_guild_id_from_name(name) {
		for(var guild in this.guild_ids) {

			guild = this.guild_ids[guild];

			if(guild.name == name) {
				return guild.id;
			}
		}

		return "not found...";
	}

	call_guild(player_info, queued=false) {

		var guild_id = player_info.guild_id;
		console.log("Lookin' for " + player_info.name + " in " + guild_id);

		this.options.data = {	
		query:`query {
		  reportData {
		    reports(limit:5 guildID:${guild_id}) {
		      data {
		      	startTime
		        rankings
		      }
		    }
		  }
		}
		`};

	  	axios.request(this.options).then((response) => {
		    var reports = response.data.data.reportData.reports.data;
		    var now = new Date();
		    now.setDate(now.getDate()-7);
		    now.setHours(0, 0, 0, 0);

		    var oneWeekAgo = (now);

		    reports = reports.filter((a) => {
		    	return a.startTime > oneWeekAgo;
		    });


		    console.log("Found " + reports.length + " potential reports for " +player_info.name);

		    // for each report
		    for(var x=0;x<reports.length;x++) {

		    	// look for our drafted player in the rankings
		    	this.findPlayerInRankings(player_info, reports[x].rankings.data);
		    }

		    this.done++;
		    // jank as all fuck

		    if(this.done == this.players.length) {
		    	var total = 0;

		    	for(var k=0;k<this.players.length;k++) {
		    		var player = this.players[k];
		    		console.log(player);
		    		if(!this.player_data[player.name]) {
		    			this.player_data[player.name] = {
		    				name: player.name,
		    				status: "Absent.",
		    				points: 0,
		    			};
		    		} else {
		    			this.player_data[player.name].status = 
		    			`Participated in ${this.player_data[player.name].encounters.length} encounter(s)!`;

		    			total += this.player_data[player.name].points.total;
		    			delete this.player_data[player.name].rankings;
		    		}
		    	}

		    	var obj = {
		    		team: this.team,
		    		total_points: Math.round(total),
		    		team_id: this.team_id,
		    		players: this.player_data
		    	};

				this.emit("done", obj);
				this.players = [];
				this.done = 0;
				this.in_queue = 0;
				this.team = "";
				this.name = "";
				this.team_id = "";
		    }

		    // to get around rate limiting
		    if(queued) {
		      this.in_queue--;
		    }

		}).catch((error) => {
			console.log(error);
			if(error.response.data.status == 429) {
				console.log(" X Rate Limited");

				if(!queued) { this.in_queue++; }
				console.log(" > Retry " + (60*1000 + (5000*this.in_queue))/1000 + "s from now.");
	      		setTimeout(()=>this.call_guild(player_info, true), 60*1000 + (5000*this.in_queue));
	    	} else {
	    		console.log(error);
	    	}
		});
	}


	findPlayerInRankings(player, fights) {
		for(var y=0;y<fights.length;y++) {
			var targetGroup = fights[y].roles[player.group].characters;

			var found = false;

			for(var index in targetGroup) {
				var char = targetGroup[index];
				if(char.name == player.name) {
					// console.log(player.name + " was present for this fight!");
					found = true;
					if(!this.player_data[player.name]) {
						this.player_data[player.name] = {name: player.name, rankings: [], encounters: []};
					}

					fights[y].amount = char.amount;
					fights[y].rankPercent = char.rankPercent;
					fights[y].bracketPercent = char.bracketPercent;
					fights[y].best = char.best;

					delete fights[y].roles;

					this.player_data[char.name].encounters.push({
						id: fights[y].encounter.id,
						name: fights[y].encounter.name,
						dps: char.amount,
						parse: char.rankPercent,
					});

					this.player_data[char.name].rankings.push(fights[y]);

					this.averageParse(this.player_data);
					this.awardPoints(this.player_data);
				}
			}

			if(!found) {
				// console.log(player.name + " was not present for this fight.");
			}
		}
	}


	averageParse(players) {
		for(var player in players) {
			var playerdata = players[player];
			var dpstotal = 0;
			var parseTotal = 0;
			var bracketTotal = 0;
			var executionTotal = 0;
			var speedTotal = 0;
			var length = playerdata.rankings.length;

			for(var i=0;i<length;i++) {
				var ranking = playerdata.rankings[i];
				dpstotal += ranking.amount;
				parseTotal += ranking.rankPercent;
				bracketTotal += ranking.bracketPercent;
				executionTotal += ranking.execution.rankPercent;
				speedTotal += ranking.speed.rankPercent;
			}

			players[player].avgDps = Math.round(dpstotal/length);
			players[player].avgParse = Math.round(parseTotal/length);
			players[player].avgBracketParse = Math.round(bracketTotal/length);
			players[player].avgExecution = Math.round(executionTotal/length);
			players[player].avgSpeed = Math.round(speedTotal/length);
		}
	}

	awardPoints(players) {
		for(var player in players) {
			var player_data = players[player];

			var rankings = player_data.rankings;

			var distribution = {
				bosses_downed: 0,
				dps: 0,
				parse: 0,
				new_best: 0,
				speedy_clear: 0,
				precise_execution: 0,
				total: 0,
			};

			for(var r=0;r<rankings.length;r++) {
				// console.log(rankings[r]);
				var fight = rankings[r];

				if(fight.kill == 1) {
					distribution.bosses_downed += 2;
				}

				if(fight.execution.rankPercent>70) {
					distribution.precise_execution+= 5;
				}

				if(fight.speed.rankPercent>70) {
					distribution.speedy_clear+=5;
				}

				if(fight.best == "-") {
					distribution.new_best+=10;
				}
			}

			distribution.parse += player_data.avgParse;
			distribution.dps += player_data.avgDps/10;

			players[player].points = distribution;

			for(var point_type in distribution) {
				if(point_type != "total") {
					distribution.total += distribution[point_type];
				}
			}	
		}
	}
}

var grob_guilds = json.readFileSync("all_grob_guilds.json");

function formatPlayers(players) {
	var searchables = [];
	var fetcher = new guild_fetcher(grob_guilds);

	for(var i=0;i<players.length;i++) {
		var player = players[i];
		var required_info = {
			guild_id: fetcher.get_guild_id_from_name(player.guild),
			group: player.role,
			name: player.name
		};

		searchables.push(required_info);
	}

	return searchables;
}

axios.get("http://localhost:3000/api/leagues/fea9e2f9-a1cc-49bf-8764-a65fdbd4e17c/teams")
.then((res) => {
	var teams_done = 0;
	var processed = [];
	for(var x=0; x<res.data.length;x++)	{
		var searchables = formatPlayers(res.data[x].drafted_players);
		var fetcher = new guild_fetcher(grob_guilds, "fetcher1");
		fetcher.start(searchables, res.data[x].name, res.data[x].id);
		fetcher.on("done", (data) => {
			console.log(data);
			processed.push(data);
			teams_done++;

			if(teams_done == res.data.length) {
				console.log("Activity Report Done");
				axios.post("http://localhost:3000/api/leagues/fea9e2f9-a1cc-49bf-8764-a65fdbd4e17c/activity_report", {
					data: processed
				})
				.then((res) => {
					console.log(res);
				})
				.catch((err) => {
					console.log(err);
				});
			}
		});
	}
})
.catch((err) => {
	console.log(err);
});



