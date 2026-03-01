const CATEGORIES = [
  {
    name: 'parse',
    title: 'Parser',
    compute(player, _old, _all) {
      const parses = Object.values(player.encounters || {})
        .map(e => e.rankPercent)
        .filter(p => p != null);
      if (parses.length === 0) return 0;
      const avg = parses.reduce((a, b) => a + b, 0) / parses.length;
      if (avg >= 99) return 10;
      if (avg >= 95) return 8;
      if (avg >= 90) return 6;
      if (avg >= 75) return 4;
      if (avg >= 50) return 2;
      return 1;
    },
  },
  {
    name: 'dps',
    title: 'High DPS',
    compute(player, _old, allPlayers) {
      const amounts = Object.values(player.encounters || {})
        .map(e => e.bestAmount)
        .filter(a => a != null);
      if (amounts.length === 0) return 0;
      const myAvg = amounts.reduce((a, b) => a + b, 0) / amounts.length;

      const allAvgs = allPlayers.map(p => {
        const amts = Object.values(p.encounters || {})
          .map(e => e.bestAmount)
          .filter(a => a != null);
        return amts.length > 0 ? amts.reduce((a, b) => a + b, 0) / amts.length : 0;
      }).filter(a => a > 0);

      if (allAvgs.length === 0) return 0;
      allAvgs.sort((a, b) => b - a);
      const rank = allAvgs.indexOf(myAvg);
      const percentile = 1 - (rank / allAvgs.length);

      if (percentile >= 0.95) return 8;
      if (percentile >= 0.80) return 6;
      if (percentile >= 0.60) return 4;
      if (percentile >= 0.40) return 2;
      return 1;
    },
  },
  {
    name: 'bosses_down',
    title: 'Boss Killer',
    compute(player, old, _all) {
      let newKills = 0;
      for (const [boss, data] of Object.entries(player.encounters || {})) {
        const oldKills = (old.encounters && old.encounters[boss]) ? old.encounters[boss].totalKills || 0 : 0;
        const currentKills = data.totalKills || 0;
        newKills += Math.max(0, currentKills - oldKills);
      }
      return Math.min(10, newKills * 2);
    },
  },
  {
    name: 'speedy_clear',
    title: 'Speed Clearer',
    compute(player, _old, allPlayers) {
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
      return Math.min(8, speedWins * 2);
    },
  },
  {
    name: 'new_best',
    title: 'Record Setter',
    compute(player, old, _all) {
      let improvements = 0;
      for (const [boss, data] of Object.entries(player.encounters || {})) {
        const oldData = (old.encounters && old.encounters[boss]) || {};
        if (data.rankPercent > (oldData.rankPercent || 0)) improvements++;
        if (data.bestAmount > (oldData.bestAmount || 0)) improvements++;
      }
      return Math.min(8, improvements);
    },
  },
  {
    name: 'consistency',
    title: 'Surgically Precise',
    compute(player, _old, _all) {
      const encounters = Object.values(player.encounters || {});
      if (encounters.length === 0) return 0;

      const ratios = encounters
        .filter(e => e.bestAmount && e.medianPerformance && e.bestAmount > 0)
        .map(e => e.medianPerformance / e.bestAmount);

      if (ratios.length === 0) return 0;
      const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

      if (avgRatio >= 0.95) return 6;
      if (avgRatio >= 0.90) return 4;
      if (avgRatio >= 0.80) return 2;
      return 1;
    },
  },
];

function scorePlayer(newSnapshot, oldSnapshot, allPlayerSnapshots) {
  const points = { total: 0 };
  for (const cat of CATEGORIES) {
    const pts = cat.compute(newSnapshot, oldSnapshot || {}, allPlayerSnapshots);
    points[cat.name] = pts;
    points.total += pts;
  }
  return points;
}

function getTitle(points) {
  const { total, ...categories } = points;
  if (Object.keys(categories).length === 0) return '';
  const best = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  const cat = CATEGORIES.find(c => c.name === best[0]);
  return cat ? cat.title : '';
}

module.exports = { scorePlayer, getTitle, CATEGORIES };
