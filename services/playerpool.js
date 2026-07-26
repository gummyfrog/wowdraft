const db = require('../db');
const { getClient } = require('./warcraftlogs');
const { resolveClass } = require('../data/classes');

/**
 * Update pool_status on a league document for progress tracking.
 */
async function updatePoolStatus(leagueCode, status) {
  await db.leagues().updateOne(
    { code: leagueCode },
    { $set: { pool_status: status } }
  );
}

/**
 * Normalize a seed player (from proplayers DB) into player_pool format.
 */
function normalizeSeedPlayer(player) {
  return {
    name: player.name,
    class: player.class,
    guild: player.guild,
    tag: player.tag,
    faction: player.faction,
    drafted: [],
    active: true,
    avgParse: player.avgParse || null,
    avgDps: player.avgDps || null,
    avgSpeed: player.avgSpeed || null,
    rankings: player.rankings || [],
  };
}

/**
 * Normalize a WCL guild member into player_pool format.
 */
function normalizeWCLPlayer(member, guildName, faction) {
  const classInfo = resolveClass(member.classID);
  return {
    name: member.name,
    class: classInfo.name,
    guild: guildName,
    tag: classInfo.defaultTag,
    tags: classInfo.tags,
    faction: faction,
    drafted: [],
    active: true,
    avgParse: null,
    avgDps: null,
    avgSpeed: null,
    rankings: [{ spec: classInfo.specs[0], rankPercent: 0, encounter_data: { encounter: { name: 'Unknown' } } }],
  };
}

/**
 * Build player pool from seed proplayers DB.
 * Fetches players whose guild matches one of the selected guilds.
 */
async function buildPoolFromSeed(guilds) {
  const guildNames = guilds.map(g => g.name);
  const pool = [];

  for (const tag of ['dps', 'healers', 'tanks']) {
    const query = {
      guild: { $in: guildNames },
    };

    const players = await db.players(tag).find(query).toArray();
    for (const p of players) {
      pool.push(normalizeSeedPlayer(p));
    }
  }

  return pool;
}

/**
 * Build player pool from WCL guild rosters.
 * Fetches member lists from WCL API for each guild.
 */
async function buildPoolFromWCL(guilds, serverSlug, serverRegion, gameVersion, leagueCode) {
  const wcl = getClient();
  if (!wcl) return [];

  const pool = [];
  const seen = new Set();

  for (let gi = 0; gi < guilds.length; gi++) {
    const guild = guilds[gi];
    if (leagueCode) {
      await updatePoolStatus(leagueCode, {
        state: 'building', step: 'rosters', progress: gi, total: guilds.length,
        message: 'Fetching guild rosters...',
      });
    }
    try {
      const guildData = await wcl.getGuildMembers(
        guild.name,
        serverSlug,
        serverRegion,
        gameVersion
      );

      if (guildData && guildData.members && guildData.members.data) {
        for (const member of guildData.members.data) {
          if (seen.has(member.name)) continue;
          seen.add(member.name);
          pool.push(normalizeWCLPlayer(member, guild.name, guild.faction));
        }
      } else {
        console.warn(`Guild ${guild.name}: no members returned from WCL`);
      }
    } catch (err) {
      console.error(`Failed to fetch guild ${guild.name}:`, err.message);
    }
  }

  return pool;
}

/**
 * Batch-fetch character rankings and populate avgParse/avgDps on pool players.
 * Uses GraphQL aliases to fetch BATCH_SIZE characters per API call.
 */
async function enrichPoolWithRankings(pool, serverSlug, serverRegion, gameVersion, raids, leagueCode) {
  const wcl = getClient();
  if (!wcl || pool.length === 0) return;

  const BATCH_SIZE = 10;
  const zoneID = (raids && raids.length > 0) ? raids[0].id : null;
  const difficulty = 4; // Heroic — most common guild raiding difficulty
  const options = zoneID ? { zoneID, difficulty } : { difficulty };

  for (let i = 0; i < pool.length; i += BATCH_SIZE) {
    const batch = pool.slice(i, i + BATCH_SIZE);
    const names = batch.map(p => p.name);

    if (leagueCode) {
      await updatePoolStatus(leagueCode, {
        state: 'building', step: 'enriching', progress: i, total: pool.length,
        message: 'Fetching player rankings...',
      });
    }

    try {
      const results = await wcl.batchGetCharacterRankings(
        names, serverSlug, serverRegion, gameVersion, options
      );

      for (const player of batch) {
        const charData = results[player.name];
        if (!charData || !charData.zoneRankings) continue;

        const zr = charData.zoneRankings;

        // Use WCL's pre-computed average parse when available
        if (zr.bestPerformanceAverage != null) {
          player.avgParse = Math.round(zr.bestPerformanceAverage * 10) / 10;
        }

        // Average DPS from individual boss rankings (WCL doesn't provide a top-level field)
        const rankings = zr.rankings;
        if (Array.isArray(rankings)) {
          let dpsSum = 0, count = 0;
          for (const r of rankings) {
            if (r.totalKills > 0 && r.bestAmount > 0) {
              dpsSum += r.bestAmount;
              count++;
            }
          }
          if (count > 0) {
            player.avgDps = Math.round(dpsSum / count);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to enrich batch starting at ${i}:`, err.message);
    }

    // Brief pause between batches to avoid rate limits
    if (i + BATCH_SIZE < pool.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Build the player pool for a league.
 * Uses WCL if configured, otherwise falls back to seed data.
 * When league.code is present, updates pool_status in DB for progress tracking
 * and writes the final pool directly to the league document.
 */
async function buildPlayerPool(league) {
  const guilds = league.guilds || [];
  const serverSlug = (league.server || '').toLowerCase().replace(/\s/g, '-');
  const serverRegion = league.region || 'us';
  const gameVersion = league.game_version || 'retail';
  const leagueCode = league.code || null;

  try {
    let pool;
    const wcl = getClient();
    if (wcl && guilds.length > 0) {
      pool = await buildPoolFromWCL(guilds, serverSlug, serverRegion, gameVersion, leagueCode);
      await enrichPoolWithRankings(pool, serverSlug, serverRegion, gameVersion, league.raids, leagueCode);
    } else if (guilds.length > 0) {
      pool = await buildPoolFromSeed(guilds);
    } else {
      pool = [];
    }

    // Mark players with no ranking data as inactive
    var activeCount = 0;
    for (var pi = 0; pi < pool.length; pi++) {
      if (pool[pi].avgParse != null || pool[pi].avgDps != null) {
        activeCount++;
      } else {
        pool[pi].active = false;
      }
    }
    console.log(`[Pool] ${activeCount} active (have logs), ${pool.length - activeCount} inactive (no logs) of ${pool.length} total`);

    // Validation — count only active players
    const rounds = league.rounds || 10;
    const reqs = league.requirements || {};
    if (activeCount === 0) {
      if (leagueCode) {
        await updatePoolStatus(leagueCode, { state: 'error', message: 'No active raiders found. ' + pool.length + ' players were found in the guild rosters but none have raid logs for the selected zone.' });
      }
      return pool;
    }
    var minPlayers = rounds * 2;
    if (activeCount < minPlayers) {
      if (leagueCode) {
        await updatePoolStatus(leagueCode, { state: 'error', message: 'Not enough active raiders. Found ' + activeCount + ' with logs but need at least ' + minPlayers + ' (' + rounds + ' rounds × 2 teams). ' + (pool.length - activeCount) + ' other players had no raid logs.' });
      }
      return pool;
    }

    // Per-role coverage check (active players only)
    var warnings = [];
    var roleCounts = { tanks: 0, healers: 0, dps: 0 };
    for (var i = 0; i < pool.length; i++) {
      var p = pool[i];
      if (p.active === false) continue;
      var playerTags = p.tags || (p.tag ? [p.tag] : []);
      for (var j = 0; j < playerTags.length; j++) {
        var t = playerTags[j];
        if (roleCounts[t] !== undefined) roleCounts[t]++;
      }
    }
    if (reqs.tanks > 0 && roleCounts.tanks < reqs.tanks * 2) {
      warnings.push('Only ' + roleCounts.tanks + ' active tank-capable players found (need ' + (reqs.tanks * 2) + ')');
    }
    if (reqs.healers > 0 && roleCounts.healers < reqs.healers * 2) {
      warnings.push('Only ' + roleCounts.healers + ' active healer-capable players found (need ' + (reqs.healers * 2) + ')');
    }
    if (reqs.dps > 0 && roleCounts.dps < reqs.dps * 2) {
      warnings.push('Only ' + roleCounts.dps + ' active DPS-capable players found (need ' + (reqs.dps * 2) + ')');
    }
    if (warnings.length > 0) {
      if (leagueCode) {
        await updatePoolStatus(leagueCode, { state: 'error', message: 'Not enough active raiders to draft. ' + warnings.join('. ') + '. (' + (pool.length - activeCount) + ' players had no raid logs.)' });
      }
      return pool;
    }

    // Success — save pool and set done status with summary
    if (leagueCode) {
      var inactiveCount = pool.length - activeCount;
      await db.leagues().updateOne(
        { code: leagueCode },
        { $set: {
          player_pool: pool,
          pool_status: { state: 'done', active: activeCount, inactive: inactiveCount, total: pool.length },
        } }
      );
      console.log(`Pool build complete for ${leagueCode}: ${activeCount} active, ${inactiveCount} inactive of ${pool.length} total`);
    }

    return pool;
  } catch (err) {
    console.error('Pool building failed:', err.message);
    if (leagueCode) {
      await updatePoolStatus(leagueCode, { state: 'error', message: 'Pool building failed: ' + err.message });
    }
    return [];
  }
}

module.exports = {
  buildPlayerPool,
  buildPoolFromSeed,
  buildPoolFromWCL,
  enrichPoolWithRankings,
  normalizeSeedPlayer,
  normalizeWCLPlayer,
};
