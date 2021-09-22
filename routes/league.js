const short = require('short-uuid');


class league_interpret {
	constructor(league_info, session) {
		this.league = league_info;
		this.whoami = "";
		this.loggedin = false;
		this.identify(session);
	}

	create() {

	}

	identify(session) {
		if(session.loggedin) {
			this.whoami = session.username;
			this.loggedin = true;
		}
	}

	canMakeTeam() {
		// make an enum for status
		if(!this.loggedin || this.league.status != "Setting Up") { return false; }

		for(var x=0; x< this.league.teams.length; x++) {
			if(this.league.teams[x].manager == this.whoami) {
				return false;
			}
		}

		return true;
	}

	sessionIsAdmin() {
		if(this.league.admin.name == this.whoami) {
			return true;
		}
		return false;
	}

	addTeam(team_body) {
		if(!this.canMakeTeam()) { return false; }

		// db is taintable, fix later w/ struct
		team_body.id = short.generate();
		team_body.drafted_players = [];
		team_body.roles_drafted = {
			dps: 0,
			healers: 0,
			tanks: 0,
		};
		team_body.manager = this.whoami;

		this.league.teams.push(team_body);
	}

	startDraft() {
		if(!this.loggedin || !this.sessionIsAdmin() || this.league.teams.length < 2) {
			return false;
		}

		var pick_order = [];


		for(var x=0; x<this.league.rounds;x++) {
			for(var y=0; y<this.league.teams.length;y++) {
				pick_order.push(y);
			}
		}

		// status enum:
		// 0 = unstarted
		// 1 = in progress
		// 2 = complete
		var draft = {
			pick_order: pick_order,
			pick_index: 0,
			picks: [],
			status: 1,
		};


		this.league.status = "In Progress";
		this.league.draft = draft;
	}

	isCurrentTeamManager() {
		if(this.league.teams[this.currentTeamIndex()].manager == this.whoami) {
			return true;
		}
		return false;
	}

	currentTeamIndex() {
		return this.league.draft.pick_order[this.league.draft.pick_index];
	}

	currentTeamInfo() {
		return this.league.teams[this.currentTeamIndex()];
	}

	skip() {
		if(this.league.draft.status != 1 || !this.sessionIsAdmin()) { return false; }
		var team_index = this.currentTeamIndex();
		var mini_player = { 
			id: "nonexisto", 
			name: "No Pick", 
			class: "", guild: "", spec: "", role: ""
		};

		this.league.draft.picks.push({
			team: this.currentTeamInfo(),
			player: mini_player,
		});


		this.league.teams[team_index].drafted_players.push(mini_player);
		this.league.draft.pick_index++;

		this.isDraftComplete();
		// also update the player's draft info, but outside of this. avoid passing connections

	}


	playerIsDraftedForLeague(player) {
		return player.drafted.includes(this.league.code);
	}

	makeMiniPlayer(player) {
		return({ 
			id: player.id, 
			name: player.name, 
			class: player.class, 
			guild: player.guild, 
			spec: player.rankings[0].spec, 
			role: player.tag
		});
	}


	draftPlayer(player) {
		if(!this.isCurrentTeamManager() || this.playerIsDraftedForLeague(player)) { return false; }
		var team_index = this.currentTeamIndex();
		var mini_player = this.makeMiniPlayer(player);

		this.league.draft.picks.push({
			team: this.currentTeamInfo(),
			player: mini_player,
		});


		this.league.teams[team_index].drafted_players.push(mini_player);
		this.league.teams[team_index].roles_drafted[mini_player.role]++;

		this.league.draft.pick_index++;
		this.isDraftComplete();
		return true;
		// also update the player's draft info, but outside of this. avoid passing connections
	}

	isDraftComplete() {
		// check if completion logic has already been performed
		if(this.league.draft.status == 2) {
			return true;
		}

		if(this.league.draft.pick_index == this.league.draft.pick_order.length) {
			// yes, draft is over!
			this.league.draft.status = 2;
			this.league.status = "Completed";
			return true;
		} 

		return false;
	}



	getRankings() {

	}

	addRankingsReport() {

	}

	getTeams() {

	}
}

module.exports = league_interpret;