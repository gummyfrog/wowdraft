// Rounding helpers for display-facing detail values.
function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Each category exposes evaluate() -> { points, detail }.
// compute() stays as a thin points-only wrapper so the public contract is unchanged.
const CATEGORIES = [
  {
    name: 'parse',
    title: 'Parser',
    evaluate(player, _old, _all) {
      const parses = Object.values(player.encounters || {})
        .map(e => e.rankPercent)
        .filter(p => p != null);
      if (parses.length === 0) return { points: 0, detail: { avg: null } };
      const avg = parses.reduce((a, b) => a + b, 0) / parses.length;
      const detail = { avg: round1(avg) };
      if (avg >= 99) return { points: 10, detail };
      if (avg >= 95) return { points: 8, detail };
      if (avg >= 90) return { points: 6, detail };
      if (avg >= 75) return { points: 4, detail };
      if (avg >= 50) return { points: 2, detail };
      return { points: 1, detail };
    },
  },
  {
    name: 'dps',
    title: 'High DPS',
    evaluate(player, _old, allPlayers) {
      const amounts = Object.values(player.encounters || {})
        .map(e => e.bestAmount)
        .filter(a => a != null);
      if (amounts.length === 0) return { points: 0, detail: { avg: null, percentile: null } };
      const myAvg = amounts.reduce((a, b) => a + b, 0) / amounts.length;

      const allAvgs = allPlayers.map(p => {
        const amts = Object.values(p.encounters || {})
          .map(e => e.bestAmount)
          .filter(a => a != null);
        return amts.length > 0 ? amts.reduce((a, b) => a + b, 0) / amts.length : 0;
      }).filter(a => a > 0);

      if (allAvgs.length === 0) return { points: 0, detail: { avg: Math.round(myAvg), percentile: null } };
      allAvgs.sort((a, b) => b - a);
      const rank = allAvgs.indexOf(myAvg);
      const percentile = 1 - (rank / allAvgs.length);
      const detail = { avg: Math.round(myAvg), percentile: round2(percentile) };

      if (percentile >= 0.95) return { points: 8, detail };
      if (percentile >= 0.80) return { points: 6, detail };
      if (percentile >= 0.60) return { points: 4, detail };
      if (percentile >= 0.40) return { points: 2, detail };
      return { points: 1, detail };
    },
  },
  {
    name: 'bosses_down',
    title: 'Boss Killer',
    evaluate(player, old, _all) {
      let newKills = 0;
      for (const [boss, data] of Object.entries(player.encounters || {})) {
        const oldKills = (old.encounters && old.encounters[boss]) ? old.encounters[boss].totalKills || 0 : 0;
        const currentKills = data.totalKills || 0;
        newKills += Math.max(0, currentKills - oldKills);
      }
      return { points: Math.min(10, newKills * 2), detail: { new_kills: newKills } };
    },
  },
  {
    name: 'speedy_clear',
    title: 'Speed Clearer',
    evaluate(player, _old, allPlayers) {
      let speedWins = 0;
      const bosses = Object.keys(player.encounters || {});
      for (const boss of bosses) {
        const myTime = player.encounters[boss].fastestKill;
        if (!myTime) continue;
        const allTimes = allPlayers
          .filter(p => p.encounters && p.encounters[boss] && p.encounters[boss].fastestKill)
          .map(p => p.encounters[boss].fastestKill);
        if (allTimes.length > 0 && myTime <= Math.min(...allTimes)) {
          speedWins++;
        }
      }
      return { points: Math.min(8, speedWins * 2), detail: { fastest_bosses: speedWins } };
    },
  },
  {
    name: 'new_best',
    title: 'Record Setter',
    evaluate(player, old, _all) {
      let improvements = 0;
      for (const [boss, data] of Object.entries(player.encounters || {})) {
        const oldData = (old.encounters && old.encounters[boss]) || {};
        if (data.rankPercent > (oldData.rankPercent || 0)) improvements++;
        if (data.bestAmount > (oldData.bestAmount || 0)) improvements++;
      }
      return { points: Math.min(8, improvements), detail: { improvements } };
    },
  },
  {
    name: 'consistency',
    title: 'Surgically Precise',
    evaluate(player, _old, _all) {
      const encounters = Object.values(player.encounters || {});
      if (encounters.length === 0) return { points: 0, detail: { ratio: null } };

      const ratios = encounters
        .filter(e => e.rankPercent && e.medianPercent && e.rankPercent > 0)
        .map(e => e.medianPercent / e.rankPercent);

      if (ratios.length === 0) return { points: 0, detail: { ratio: null } };
      const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      const detail = { ratio: round2(avgRatio) };

      if (avgRatio >= 0.95) return { points: 6, detail };
      if (avgRatio >= 0.85) return { points: 4, detail };
      if (avgRatio >= 0.70) return { points: 2, detail };
      return { points: 1, detail };
    },
  },
  {
    name: 'all_stars',
    title: 'All-Star',
    evaluate(player, _old, _all) {
      const as = player.zoneAllStars;
      if (!as || !as.possiblePoints || as.possiblePoints <= 0) {
        return { points: 0, detail: { points: as ? as.points || 0 : null, possible: as ? as.possiblePoints || 0 : null } };
      }
      const ratio = as.points / as.possiblePoints;
      const detail = { points: Math.round(as.points), possible: Math.round(as.possiblePoints) };
      if (ratio >= 0.80) return { points: 6, detail };
      if (ratio >= 0.60) return { points: 4, detail };
      if (ratio >= 0.40) return { points: 2, detail };
      if (ratio > 0) return { points: 1, detail };
      return { points: 0, detail };
    },
  },
];

for (const cat of CATEGORIES) {
  cat.compute = function (player, old, all) {
    return cat.evaluate(player, old, all).points;
  };
}

// Returns the frozen points contract plus a `details` object keyed the same way,
// exposing the inputs behind each category score.
function scorePlayer(newSnapshot, oldSnapshot, allPlayerSnapshots) {
  const points = { total: 0 };
  const details = {};
  for (const cat of CATEGORIES) {
    const { points: pts, detail } = cat.evaluate(newSnapshot, oldSnapshot || {}, allPlayerSnapshots);
    points[cat.name] = pts;
    points.total += pts;
    details[cat.name] = detail;
  }
  points.details = details;
  return points;
}

function getTitle(points) {
  const { total, details, ...categories } = points;
  if (Object.keys(categories).length === 0) return '';
  const best = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  const cat = CATEGORIES.find(c => c.name === best[0]);
  return cat ? cat.title : '';
}

module.exports = { scorePlayer, getTitle, CATEGORIES };
