const { getClient, GAME_VERSIONS } = require('./warcraftlogs');

const TTL = 4 * 60 * 60 * 1000; // 4 hours
const cache = new Map();

function cached(key, fetchFn) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.value;

  const promise = fetchFn().then(data => {
    cache.set(key, { value: Promise.resolve(data), expiry: Date.now() + TTL });
    return data;
  }).catch(err => {
    cache.delete(key);
    throw err;
  });

  cache.set(key, { value: promise, expiry: Date.now() + TTL });
  return promise;
}

function getGameVersions() {
  return GAME_VERSIONS;
}

async function getRegions(gameVersion) {
  const wcl = getClient();
  if (!wcl) return null;
  return cached(`regions:${gameVersion}`, () => wcl.getRegions(gameVersion));
}

async function getServers(regionId, gameVersion) {
  const wcl = getClient();
  if (!wcl) return null;
  return cached(`servers:${regionId}:${gameVersion}`, () => wcl.getServers(regionId, gameVersion));
}

async function getExpansions(gameVersion) {
  const wcl = getClient();
  if (!wcl) return null;
  return cached(`expansions:${gameVersion}`, () => wcl.getExpansions(gameVersion));
}

async function getZones(expansionId, gameVersion) {
  const wcl = getClient();
  if (!wcl) return null;
  return cached(`zones:${expansionId}:${gameVersion}`, () => wcl.getZones(expansionId, gameVersion));
}

module.exports = { getGameVersions, getRegions, getServers, getExpansions, getZones };
