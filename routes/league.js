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

		var team = {
			id: short.generate(),
			name: team_body.name || 'Unnamed Team',
			motto: team_body.motto || '',
			icon: team_body.icon || 'icon1',
			color2: team_body.color2 || '#555',
			banner_shape: team_body.banner_shape || 'pointed',
			banner_pattern: team_body.banner_pattern || 'solid',
			banner_bg: team_body.banner_bg || team_body.color2 || '#555',
			banner_accent: team_body.banner_accent || '#FFD100',
			banner_emblem: team_body.banner_emblem || 'shield-alt',
		banner_emblem_color: team_body.banner_emblem_color || '#ffffff',
			drafted_players: [],
			roles_drafted: {
				dps: 0,
				healers: 0,
				tanks: 0,
			},
			manager: this.whoami,
		};

		this.league.teams.push(team);
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
		var teamIndex = this.currentTeamIndex();
		if(teamIndex == null || !this.league.teams[teamIndex]) {
			return false;
		}
		if(this.league.teams[teamIndex].manager == this.whoami) {
			return true;
		}
		return false;
	}

	currentTeamIndex() {
		if(!this.league.draft || !this.league.draft.pick_order) return null;
		var index = this.league.draft.pick_order[this.league.draft.pick_index];
		return index !== undefined ? index : null;
	}

	currentTeamInfo() {
		var index = this.currentTeamIndex();
		return index != null ? this.league.teams[index] : null;
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

		mini_player.role = mini_player.role.toLowerCase();
		mini_player.class = mini_player.class.toLowerCase();

		console.log(mini_player);

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
			this.league.status = "Drafted";
			return true;
		} 

		return false;
	}



	getRankings() {

	}

	addRankingsReport() {

	}

	startSeason(options = {}) {
		if (!this.loggedin || !this.sessionIsAdmin() || this.league.status !== 'Drafted') {
			return false;
		}

		const seasonLength = options.season_length || 8;
		const teams = this.league.teams;

		// Generate round-robin schedule
		this.league.schedule = this.generateRoundRobin(teams, seasonLength);
		this.league.season_length = seasonLength;
		this.league.status = 'Active';
		this.league.standings = {};
		this.league.player_snapshots = {};
		this.league.activity_reports = [];

		// Initialize standings for all teams
		for (const team of teams) {
			this.league.standings[team.id] = { wins: 0, losses: 0 };
		}

		return true;
	}

	generateRoundRobin(teams, weeks) {
		const schedule = [];
		const teamIds = teams.map(t => t.id);
		const n = teamIds.length;

		// If odd number of teams, add a "BYE" placeholder
		const ids = [...teamIds];
		if (n % 2 !== 0) ids.push('BYE');
		const total = ids.length;
		const half = total / 2;

		for (let week = 0; week < weeks; week++) {
			const round = week % (total - 1);
			const matchups = [];

			// Standard round-robin rotation
			const rotated = [ids[0]];
			for (let i = 1; i < total; i++) {
				rotated.push(ids[((i - 1 + round) % (total - 1)) + 1]);
			}

			for (let i = 0; i < half; i++) {
				const home = rotated[i];
				const away = rotated[total - 1 - i];

				if (home === 'BYE') {
					matchups.push({ bye: away });
				} else if (away === 'BYE') {
					matchups.push({ bye: home });
				} else {
					matchups.push({ home, away });
				}
			}

			schedule.push({ week: week + 1, matchups });
		}

		return schedule;
	}

	getTeams() {

	}
}

module.exports = league_interpret;