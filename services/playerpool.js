const db = require('../db');
const { getClient } = require('./warcraftlogs');
const { resolveClass } = require('../data/classes');

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
async function buildPoolFromWCL(guilds, serverSlug, serverRegion, gameVersion) {
  const wcl = getClient();
  if (!wcl) return [];

  const pool = [];
  const seen = new Set();

  for (const guild of guilds) {
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
      }
    } catch (err) {
      console.error(`Failed to fetch guild ${guild.name}:`, err.message);
    }
  }

  return pool;
}

/**
 * Build the player pool for a league.
 * Uses WCL if configured, otherwise falls back to seed data.
 */
async function buildPlayerPool(league) {
  const guilds = league.guilds || [];
  const serverSlug = (league.server || '').toLowerCase().replace(/\s/g, '-');
  const serverRegion = league.region || 'us';
  const gameVersion = league.game_version || 'retail';

  const wcl = getClient();
  if (wcl && guilds.length > 0) {
    return buildPoolFromWCL(guilds, serverSlug, serverRegion, gameVersion);
  }

  // Fallback: build from seed data
  if (guilds.length > 0) {
    return buildPoolFromSeed(guilds);
  }

  return [];
}

module.exports = {
  buildPlayerPool,
  buildPoolFromSeed,
  buildPoolFromWCL,
  normalizeSeedPlayer,
  normalizeWCLPlayer,
};
