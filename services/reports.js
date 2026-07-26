const { getClient } = require('./warcraftlogs');
const { scorePlayer, getTitle } = require('./scoring');
const db = require('../db');
const { postReport } = require('./discord');

async function fetchPlayerSnapshot(playerName, serverSlug, serverRegion, gameVersion, options = {}) {
  const wcl = getClient();
  if (!wcl) return null;
  if (!options.zoneID) return null;

  try {
    const character = await wcl.getCharacterRankings(
      playerName, serverSlug, serverRegion, gameVersion, options
    );

    if (!character || !character.zoneRankings) return null;

    const zoneData = character.zoneRankings;

    // Transform WCL zoneRankings.rankings into our snapshot format
    const encounters = {};
    const rankings = zoneData.rankings;

    if (Array.isArray(rankings)) {
      for (const ranking of rankings) {
        const bossName = ranking.encounter ? ranking.encounter.name : `Boss_${ranking.encounterID}`;
        encounters[bossName] = {
          rankPercent: ranking.rankPercent || 0,
          medianPercent: ranking.medianPercent || 0,
          bestAmount: ranking.bestAmount || 0,
          totalKills: ranking.totalKills || 0,
          fastestKill: ranking.fastestKill || 0,
        };
      }
    }

    // Extract zone-level All-Star data
    let zoneAllStars = null;
    if (Array.isArray(zoneData.allStars) && zoneData.allStars.length > 0) {
      const as = zoneData.allStars[0];
      zoneAllStars = {
        points: as.points || 0,
        possiblePoints: as.possiblePoints || 0,
        rankPercent: as.rankPercent || 0,
        spec: as.spec || '',
      };
    }

    return { encounters, zoneAllStars };
  } catch (err) {
    console.error(`Failed to fetch WCL data for ${playerName}:`, err.message);
    return null;
  }
}

const EMPTY_POINTS = { total: 0, parse: 0, dps: 0, bosses_down: 0, speedy_clear: 0, new_best: 0, consistency: 0, all_stars: 0 };

// Builds one weekly activity_reports entry for a drafted player:
// { points, title, details }. 'No Pick' slots stay bare (zero points, no title/details).
function buildPlayerEntry(playerName, newSnapshots, oldSnapshots, allNewSnapshots) {
  if (playerName === 'No Pick') {
    return { points: { ...EMPTY_POINTS } };
  }

  const newSnap = newSnapshots[playerName] || { encounters: {} };
  const oldSnap = oldSnapshots[playerName] || {};
  const { details, ...points } = scorePlayer(newSnap, oldSnap, allNewSnapshots);

  return { points, title: getTitle(points), details };
}

async function generateReport(leagueCode) {
  const league = await db.leagues().findOne({ code: leagueCode });
  if (!league || league.status !== 'Active') {
    throw new Error(`League ${leagueCode} is not in Active status`);
  }

  const serverSlug = (league.server || '').toLowerCase().replace(/\s/g, '-');
  const serverRegion = league.region || 'us';
  const gameVersion = league.game_version || 'retail';
  const oldSnapshots = league.player_snapshots || {};
  const allDraftedPlayers = [];

  // Collect all drafted players across all teams
  for (const team of league.teams) {
    for (const player of team.drafted_players) {
      if (player.name && player.name !== 'No Pick') {
        allDraftedPlayers.push({ ...player, teamId: team.id });
      }
    }
  }

  // Build WCL query options from league settings
  const wclOptions = { difficulty: 4 }; // Heroic by default
  if (league.raids && league.raids.length > 0) {
    // Use the first selected zone ID for scoping
    // WCL zoneRankings takes a single zoneID
    wclOptions.zoneID = league.raids[0].id;
  }

  // Mark progress on the league document so clients can poll
  const totalPlayers = allDraftedPlayers.length;
  await db.leagues().updateOne(
    { code: leagueCode },
    { $set: { report_status: { state: 'generating', progress: 0, total: totalPlayers } } }
  );

  // Fetch fresh snapshots from WCL for each player
  const newSnapshots = {};
  let fetched = 0;
  for (const player of allDraftedPlayers) {
    const snapshot = await fetchPlayerSnapshot(
      player.name, serverSlug, serverRegion, gameVersion, wclOptions
    );
    if (snapshot) {
      newSnapshots[player.name] = snapshot;
    } else {
      // Player has no new data — use old snapshot or empty
      newSnapshots[player.name] = oldSnapshots[player.name] || { encounters: {}, zoneAllStars: null };
    }
    fetched++;
    await db.leagues().updateOne(
      { code: leagueCode },
      { $set: { 'report_status.progress': fetched } }
    );
    // Rate limit: 1 request per second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Score each player
  const allNewSnapshots = Object.values(newSnapshots);
  const teamReportData = [];

  for (const team of league.teams) {
    const playerScores = {};
    let teamTotal = 0;

    for (const player of team.drafted_players) {
      const entry = buildPlayerEntry(player.name, newSnapshots, oldSnapshots, allNewSnapshots);
      playerScores[player.name] = entry;
      teamTotal += entry.points.total;
    }

    teamReportData.push({
      team_id: team.id,
      team_name: team.name,
      total_points: teamTotal,
      players: playerScores,
    });
  }

  // Resolve head-to-head matchup for current week
  const currentWeek = (league.activity_reports || []).length;
  let matchupResult = null;

  if (league.schedule && league.schedule[currentWeek]) {
    const weekSchedule = league.schedule[currentWeek];
    matchupResult = resolveMatchups(weekSchedule, teamReportData);
  }

  // Build report
  const report = {
    time: new Date(),
    week: currentWeek + 1,
    data: teamReportData,
    matchups: matchupResult,
  };

  // Update league
  const updateFields = {
    player_snapshots: newSnapshots,
  };

  if (matchupResult) {
    // Update W/L records
    const standings = league.standings || {};
    for (const result of matchupResult) {
      if (result.winner) {
        if (!standings[result.winner]) standings[result.winner] = { wins: 0, losses: 0 };
        standings[result.winner].wins++;
      }
      if (result.loser) {
        if (!standings[result.loser]) standings[result.loser] = { wins: 0, losses: 0 };
        standings[result.loser].losses++;
      }
      if (result.bye) {
        if (!standings[result.bye]) standings[result.bye] = { wins: 0, losses: 0 };
        standings[result.bye].wins++;
      }
    }
    updateFields.standings = standings;
  }

  // Use $set for non-array fields and $push for array
  await db.leagues().updateOne(
    { code: leagueCode },
    {
      $set: { player_snapshots: newSnapshots, standings: updateFields.standings || league.standings || {}, report_status: null },
      $push: { activity_reports: report },
    }
  );

  // Fire-and-forget: webhook delivery must never delay or fail report generation.
  postReport(league, report).catch(() => {});

  return report;
}

function resolveMatchups(weekSchedule, teamReportData) {
  const results = [];

  for (const matchup of weekSchedule.matchups) {
    if (matchup.bye) {
      results.push({ bye: matchup.bye });
      continue;
    }

    const homeData = teamReportData.find(t => t.team_id === matchup.home);
    const awayData = teamReportData.find(t => t.team_id === matchup.away);

    if (!homeData || !awayData) continue;

    const result = {
      home: matchup.home,
      away: matchup.away,
      homeScore: homeData.total_points,
      awayScore: awayData.total_points,
    };

    if (homeData.total_points > awayData.total_points) {
      result.winner = matchup.home;
      result.loser = matchup.away;
    } else if (awayData.total_points > homeData.total_points) {
      result.winner = matchup.away;
      result.loser = matchup.home;
    } else {
      // Tie — both get a win
      result.winner = null;
      result.loser = null;
      result.tie = true;
    }

    results.push(result);
  }

  return results;
}

module.exports = { generateReport, fetchPlayerSnapshot, resolveMatchups, buildPlayerEntry };
