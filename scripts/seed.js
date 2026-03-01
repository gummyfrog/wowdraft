require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';

// ---------------------------------------------------------------------------
// Character Names — WoW-flavored fantasy names
// ---------------------------------------------------------------------------
const NAMES = [
  // Classic / lore-inspired
  'Arthaslol', 'Thrallmain', 'Sylvannas', 'Jainaproud', 'Medivhx',
  'Illidank', 'Guldan', 'Kaelthas', 'Garroshh', 'Saurfangs',
  'Voljinx', 'Cairnebh', 'Tyrande', 'Malfurionx', 'Anduinw',
  'Bolvarr', 'Tirionfd', 'Uther', 'Mograine', 'Alexandros',
  // Edgy / PvP vibes
  'Stabsworth', 'Critmaster', 'Ganksalot', 'Oneshot', 'Permaban',
  'Zugzug', 'Pwntrain', 'Facemelt', 'Dotweave', 'Stunlockd',
  'Globaled', 'Rektangle', 'Outplayed', 'Cleaveland', 'Bladefury',
  // Fantasy names
  'Thandril', 'Korvash', 'Aelindra', 'Morvaine', 'Duskblade',
  'Ashenveil', 'Frosthelm', 'Ironforge', 'Stormrage', 'Shadowmend',
  'Lightweavr', 'Moonfire', 'Sunwalker', 'Spiritcall', 'Earthgrip',
  'Bloodfangz', 'Nightstalq', 'Fireheart', 'Icevein', 'Thunderaxe',
  'Runeblade', 'Felweaver', 'Darkpact', 'Soulrend', 'Lifetap',
  'Manaburnz', 'Arcblast', 'Frostbolt', 'Pyroclasm', 'Flamestrkr',
  // RP / creative
  'Windrunner', 'Bronzebeard', 'Hellscream', 'Doomhammer', 'Proudmore',
  'Ravencrest', 'Lightbringr', 'Deathwhispr', 'Shadowsong', 'Starbreeze',
  'Oakenward', 'Thornmantle', 'Ironbark', 'Deeproot', 'Swiftarrow',
  'Trueshot', 'Silentblade', 'Warpath', 'Berserka', 'Furypants',
  // Funny / meme
  'Legolaz', 'Gandolf', 'Narutoxd', 'Sephirothx', 'Chucknorriz',
  'Leeroyjenk', 'Mankrik', 'Mankriks', 'Noobslayer', 'Bankalt',
  'Bufffood', 'Worldbuffed', 'Parsegod', 'Meterpadder', 'Logsnipr',
  'Buffcapped', 'Consumeking', 'Flaskboi', 'Elixirman', 'Sapperchad',
  // Healer-y
  'Holylight', 'Rejuvbot', 'Chainhealz', 'Healbot', 'Dispelquik',
  'Renewspam', 'Innervait', 'Tranquility', 'Cleansing', 'Purifying',
  'Mendwound', 'Prayerheal', 'Bindinghl', 'Flashhealr', 'Greathealr',
  // Tank-y
  'Shieldwall', 'Laststand', 'Shieldblock', 'Facetank', 'Aggromagne',
  'Tauntbot', 'Sunderking', 'Bigshield', 'Ironhide', 'Thiccskin',
  'Defcapped', 'Bulwarkk', 'Unbreakble', 'Bastionne', 'Rampartx',
  // More fillers
  'Tempestx', 'Volcanix', 'Cyclonez', 'Tornadoqt', 'Earthquakex',
  'Tsunamix', 'Blizzardx', 'Avalanche', 'Infernox', 'Meteorx',
  'Cometfall', 'Stardust', 'Nebulax', 'Eclipsex', 'Solstice',
  'Equinoxx', 'Aurorabor', 'Twilightx', 'Dawnchasr', 'Duskfall',
  'Noonblade', 'Midknight', 'Highnoone', 'Sundropx', 'Moonrisex',
  'Starfallx', 'Nightfyre', 'Daybringr', 'Gloomveil', 'Brightswd',
  'Felguardx', 'Voidzoney', 'Summonlord', 'Impmaster', 'Fearlock',
  'Corruptx', 'Drainlifex', 'Curseweave', 'Banishx', 'Demonbolt',
  'Scorchx', 'Combustx', 'Ignitev', 'Livingbomb', 'Blastwave',
  'Flamecannx', 'Dragonbrth', 'Polymorph', 'Blinkstep', 'Evocatex',
  'Ambushx', 'Cheapshot', 'Sinistrstk', 'Evisceratx', 'Backstabx',
  'Kickbotz', 'Vanishqt', 'Cloakshdw', 'Blindside', 'Gouge',
  'Aimedshot', 'Multishot', 'Steadyshot', 'Rapidfire', 'Viperstng',
  'Arcaneshot', 'Serpentst', 'Scattersh', 'Feathermac', 'Beastlord',
  'Thunderclp', 'Whirlwindx', 'Executex', 'Mortalstrk', 'Overpower',
  'Heroicstrk', 'Bloodthst', 'Rampagex', 'Rendbleed', 'Slamjam',
  'Starfirex', 'Wrathx', 'Hurricanex', 'Entanglrts', 'Clawmangle',
  'Maulgrizz', 'Ripshred', 'Tigersfury', 'Ravagex', 'Savagerip',
  'Lightngblt', 'Chainlight', 'Lavaburst', 'Earthshock', 'Flameshok',
  'Frostshok', 'Windfury', 'Stormstrik', 'Lavalachx', 'Totembro',
  'Smitespam', 'Mindblastx', 'Shadowwordx', 'Devouringx', 'Mindflayqt',
  'Vampiricx', 'Powrinfuse', 'Innerfirez', 'Penancex', 'Lightwellx',
  // Extra
  'Grommash', 'Rexxarx', 'Zuljinx', 'Hakkarx', 'Ragnarox',
  'Onyxiax', 'Nefarianx', 'Kelthuzadx', 'Cthunx', 'Sapphironx',
  'Patchwerk', 'Loathebx', 'Vaelastrsz', 'Chromaggusx', 'Huhuranx',
  'Blessingx', 'Judgementx', 'Consecratx', 'Hammerx', 'Avengershld',
  'Holyshockx', 'Layonhandx', 'Divineshld', 'Bubblehrth', 'Retbull',
];

// ---------------------------------------------------------------------------
// Guild names by faction
// ---------------------------------------------------------------------------
const ALLIANCE_GUILDS = [
  'APES', 'Progress', 'Salad Bakers', 'Dreamstate', 'Nihilum',
  'Method', 'Paragon', 'Ensidia', 'Vodka', 'Midwinter',
];

const HORDE_GUILDS = [
  'Grizzly', 'Fusion', 'Classic Guild', 'Spirit', 'BEEF',
  'Warlords of Draenor', 'Vanguard', 'Bonk', 'Death and Taxes', 'Ascent',
];

// ---------------------------------------------------------------------------
// Bosses
// ---------------------------------------------------------------------------
const BOSSES = [
  'Ragnaros', 'Onyxia', 'Nefarian', 'Chromaggus', "C'Thun",
  'Twin Emperors', "Kel'Thuzad", 'Sapphiron', 'Loatheb', 'Patchwerk',
  'Ouro', 'Huhuran', 'Vaelastrasz',
];

// ---------------------------------------------------------------------------
// Class / spec / role / faction data
// ---------------------------------------------------------------------------
const CLASS_SPECS = {
  dps: [
    { cls: 'Warrior',  specs: ['Arms', 'Fury'],                          factions: [0, 1] },
    { cls: 'Rogue',    specs: ['Combat', 'Assassination'],               factions: [0, 1] },
    { cls: 'Mage',     specs: ['Fire', 'Frost', 'Arcane'],               factions: [0, 1] },
    { cls: 'Warlock',  specs: ['Destruction', 'Affliction'],             factions: [0, 1] },
    { cls: 'Hunter',   specs: ['Marksmanship', 'Beast Mastery', 'Survival'], factions: [0, 1] },
    { cls: 'Druid',    specs: ['Balance'],                               factions: [0, 1] },
    { cls: 'Shaman',   specs: ['Elemental', 'Enhancement'],             factions: [1] },
    { cls: 'Priest',   specs: ['Shadow'],                                factions: [0, 1] },
    { cls: 'Paladin',  specs: ['Retribution'],                           factions: [0] },
  ],
  healers: [
    { cls: 'Priest',   specs: ['Holy', 'Discipline'],                    factions: [0, 1] },
    { cls: 'Druid',    specs: ['Restoration'],                           factions: [0, 1] },
    { cls: 'Shaman',   specs: ['Restoration'],                           factions: [1] },
    { cls: 'Paladin',  specs: ['Holy'],                                  factions: [0] },
  ],
  tanks: [
    { cls: 'Warrior',  specs: ['Protection'],                            factions: [0, 1] },
    { cls: 'Druid',    specs: ['Feral'],                                 factions: [0, 1] },
    { cls: 'Paladin',  specs: ['Protection'],                            factions: [0] },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a random integer between min (inclusive) and max (inclusive). */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Shuffle array in-place (Fisher-Yates). */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a value from a rough normal distribution centered on `mean`
 * with spread `stddev`, clamped to [lo, hi].
 */
function normalish(mean, stddev, lo, hi) {
  // Box-Muller approximation (sum-of-uniforms shortcut)
  let u = 0;
  for (let i = 0; i < 6; i++) u += Math.random();
  u = (u - 3) / 3; // roughly N(0,1)
  let v = mean + u * stddev;
  return Math.round(Math.max(lo, Math.min(hi, v)) * 10) / 10;
}

/** Generate 3-6 random encounter rankings for a given spec list. */
function generateRankings(specs) {
  const count = randInt(3, 6);
  const bosses = shuffle([...BOSSES]).slice(0, count);
  return bosses.map((boss) => ({
    spec: pick(specs),
    rankPercent: normalish(72, 18, 5, 100),
    encounter_data: {
      encounter: { name: boss },
    },
  }));
}

// ---------------------------------------------------------------------------
// Player generation
// ---------------------------------------------------------------------------

/**
 * Build players for a given tag (dps | healers | tanks).
 * Returns an array of player documents.
 */
function generatePlayers(tag, count, namePool) {
  const players = [];
  const entries = CLASS_SPECS[tag];

  for (let i = 0; i < count; i++) {
    // Pick a random class/spec entry that still has valid factions
    const entry = pick(entries);
    const faction = pick(entry.factions);
    const guild = faction === 0 ? pick(ALLIANCE_GUILDS) : pick(HORDE_GUILDS);

    // Grab a unique name from the pool (or generate a fallback)
    const name = namePool.length > 0
      ? namePool.pop()
      : `Hero${randInt(1000, 9999)}`;

    const rankings = generateRankings(entry.specs);

    // avgDps varies by role — healers/tanks typically have lower raw DPS
    let dpsCenter, dpsSpread;
    if (tag === 'dps') {
      dpsCenter = 1200; dpsSpread = 400;
    } else if (tag === 'healers') {
      dpsCenter = 600;  dpsSpread = 200;
    } else {
      dpsCenter = 500;  dpsSpread = 150;
    }

    players.push({
      name,
      class: entry.cls,
      guild,
      tag,
      faction,
      drafted: [],
      avgParse: normalish(70, 16, 10, 100),
      avgDps: normalish(dpsCenter, dpsSpread, 100, 3000),
      avgSpeed: normalish(68, 18, 5, 100),
      rankings,
    });
  }

  return players;
}

// ---------------------------------------------------------------------------
// Sample league builder
// ---------------------------------------------------------------------------

function buildDemoLeague(dpsPlayers, healerPlayers, tankPlayers) {
  // Pick players for two teams
  const team1Players = [
    ...dpsPlayers.slice(0, 5).map(p => ({ id: p.name, name: p.name, class: p.class.toLowerCase(), guild: p.guild, spec: p.rankings[0].spec, role: 'dps' })),
    ...healerPlayers.slice(0, 2).map(p => ({ id: p.name, name: p.name, class: p.class.toLowerCase(), guild: p.guild, spec: p.rankings[0].spec, role: 'healers' })),
    ...tankPlayers.slice(0, 2).map(p => ({ id: p.name, name: p.name, class: p.class.toLowerCase(), guild: p.guild, spec: p.rankings[0].spec, role: 'tanks' })),
  ];

  const team2Players = [
    ...dpsPlayers.slice(5, 10).map(p => ({ id: p.name, name: p.name, class: p.class.toLowerCase(), guild: p.guild, spec: p.rankings[0].spec, role: 'dps' })),
    ...healerPlayers.slice(2, 4).map(p => ({ id: p.name, name: p.name, class: p.class.toLowerCase(), guild: p.guild, spec: p.rankings[0].spec, role: 'healers' })),
    ...tankPlayers.slice(2, 4).map(p => ({ id: p.name, name: p.name, class: p.class.toLowerCase(), guild: p.guild, spec: p.rankings[0].spec, role: 'tanks' })),
  ];

  const team3Players = [
    ...dpsPlayers.slice(10, 15).map(p => ({ id: p.name, name: p.name, class: p.class.toLowerCase(), guild: p.guild, spec: p.rankings[0].spec, role: 'dps' })),
    ...healerPlayers.slice(4, 6).map(p => ({ id: p.name, name: p.name, class: p.class.toLowerCase(), guild: p.guild, spec: p.rankings[0].spec, role: 'healers' })),
    ...tankPlayers.slice(4, 6).map(p => ({ id: p.name, name: p.name, class: p.class.toLowerCase(), guild: p.guild, spec: p.rankings[0].spec, role: 'tanks' })),
  ];

  const teams = [
    {
      id: 'team_horde',
      name: 'Lok\'tar Legion',
      manager: 'Guest#1234',
      icon: 'horde',
      color2: '#8b0000',
      motto: 'Victory or death!',
      drafted_players: team1Players,
      roles_drafted: { dps: 5, healers: 2, tanks: 2 },
    },
    {
      id: 'team_alliance',
      name: 'Stormwind Knights',
      manager: 'Guest#5678',
      icon: 'alliance',
      color2: '#0070FF',
      motto: 'For the Alliance!',
      drafted_players: team2Players,
      roles_drafted: { dps: 5, healers: 2, tanks: 2 },
    },
    {
      id: 'team_neutral',
      name: 'Steamwheedle Sharks',
      manager: 'Guest#9999',
      icon: 'neutral',
      color2: '#FFD700',
      motto: 'Time is money, friend!',
      drafted_players: team3Players,
      roles_drafted: { dps: 5, healers: 2, tanks: 2 },
    },
  ];

  // Generate mock scoring data for reports
  function mockPlayerScores(players) {
    const scores = {};
    for (const p of players) {
      const parse = randInt(0, 10);
      const dps = randInt(0, 8);
      const bosses_down = randInt(0, 10);
      const speedy_clear = randInt(0, 8);
      const new_best = randInt(0, 8);
      const consistency = randInt(0, 6);
      const total = parse + dps + bosses_down + speedy_clear + new_best + consistency;
      scores[p.name] = {
        points: { total, parse, dps, bosses_down, speedy_clear, new_best, consistency },
        title: total > 20 ? 'Parser' : total > 10 ? 'Boss Killer' : '',
      };
    }
    return scores;
  }

  // Generate 2 weeks of mock reports
  const report1Teams = teams.map(t => {
    const players = mockPlayerScores(t.drafted_players);
    const total_points = Object.values(players).reduce((sum, p) => sum + p.points.total, 0);
    return { team_id: t.id, team_name: t.name, total_points, players };
  });

  const report2Teams = teams.map(t => {
    const players = mockPlayerScores(t.drafted_players);
    const total_points = Object.values(players).reduce((sum, p) => sum + p.points.total, 0);
    return { team_id: t.id, team_name: t.name, total_points, players };
  });

  // Mock matchup results
  const week1Matchups = [
    {
      home: 'team_horde', away: 'team_alliance',
      homeScore: report1Teams[0].total_points,
      awayScore: report1Teams[1].total_points,
      winner: report1Teams[0].total_points >= report1Teams[1].total_points ? 'team_horde' : 'team_alliance',
      loser: report1Teams[0].total_points >= report1Teams[1].total_points ? 'team_alliance' : 'team_horde',
    },
    { bye: 'team_neutral' },
  ];

  const week2Matchups = [
    {
      home: 'team_alliance', away: 'team_neutral',
      homeScore: report2Teams[1].total_points,
      awayScore: report2Teams[2].total_points,
      winner: report2Teams[1].total_points >= report2Teams[2].total_points ? 'team_alliance' : 'team_neutral',
      loser: report2Teams[1].total_points >= report2Teams[2].total_points ? 'team_neutral' : 'team_alliance',
    },
    { bye: 'team_horde' },
  ];

  // Compute standings from matchup results
  const standings = {
    'team_horde': { wins: 0, losses: 0 },
    'team_alliance': { wins: 0, losses: 0 },
    'team_neutral': { wins: 0, losses: 0 },
  };
  for (const m of [...week1Matchups, ...week2Matchups]) {
    if (m.winner) standings[m.winner].wins++;
    if (m.loser) standings[m.loser].losses++;
    if (m.bye) standings[m.bye].wins++;
  }

  const activityReports = [
    {
      time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      week: 1,
      data: report1Teams,
      matchups: week1Matchups,
    },
    {
      time: new Date(),
      week: 2,
      data: report2Teams,
      matchups: week2Matchups,
    },
  ];

  // Generate schedule for remaining weeks
  const schedule = [
    { week: 1, matchups: [{ home: 'team_horde', away: 'team_alliance' }, { bye: 'team_neutral' }] },
    { week: 2, matchups: [{ home: 'team_alliance', away: 'team_neutral' }, { bye: 'team_horde' }] },
    { week: 3, matchups: [{ home: 'team_neutral', away: 'team_horde' }, { bye: 'team_alliance' }] },
    { week: 4, matchups: [{ home: 'team_horde', away: 'team_alliance' }, { bye: 'team_neutral' }] },
    { week: 5, matchups: [{ home: 'team_alliance', away: 'team_neutral' }, { bye: 'team_horde' }] },
    { week: 6, matchups: [{ home: 'team_neutral', away: 'team_horde' }, { bye: 'team_alliance' }] },
    { week: 7, matchups: [{ home: 'team_horde', away: 'team_alliance' }, { bye: 'team_neutral' }] },
    { week: 8, matchups: [{ home: 'team_alliance', away: 'team_neutral' }, { bye: 'team_horde' }] },
  ];

  // Build player_pool from all Horde players (since demo is Horde faction)
  const playerPool = [];
  const allPlayers = [...dpsPlayers, ...healerPlayers, ...tankPlayers];
  const demoGuilds = ['Grizzly', 'Fusion', 'Classic Guild', 'Spirit', 'BEEF',
    'Warlords of Draenor', 'Vanguard', 'Bonk', 'Death and Taxes', 'Ascent'];
  for (const p of allPlayers) {
    if (p.faction === 1 && demoGuilds.includes(p.guild)) {
      playerPool.push({
        name: p.name,
        class: p.class,
        guild: p.guild,
        tag: p.tag,
        faction: p.faction,
        drafted: [],
        active: true,
        avgParse: p.avgParse,
        avgDps: p.avgDps,
        avgSpeed: p.avgSpeed,
        rankings: p.rankings,
      });
    }
  }

  // Mark drafted players in the pool
  for (const team of teams) {
    for (const dp of team.drafted_players) {
      const poolPlayer = playerPool.find(p => p.name === dp.name);
      if (poolPlayer) poolPlayer.drafted.push('demo');
    }
  }

  return {
    code: 'demo',
    name: 'Azeroth Championship',
    description: 'A demo league showcasing WoWDraft features',
    icon: 'banner_Orc.png',
    color1: '#8b0000',
    color2: '#1a1a2e',
    faction: 'Horde',
    server: 'Faerlina',
    region: 'us',
    game_version: 'classic',
    style: 'Standard',
    status: 'Active',
    rounds: 9,
    report_day: 'Wednesday',
    start_date: '2024-01-15',
    season_length: 8,
    admin: { name: 'Guest#1234' },
    requirements: { dps: 5, healers: 2, tanks: 2 },
    guilds: [
      { name: 'Grizzly' },
      { name: 'Fusion' },
      { name: 'Classic Guild' },
    ],
    raids: [
      { id: 1000, name: 'Molten Core' },
      { id: 1002, name: 'Blackwing Lair' },
      { id: 1006, name: 'Naxxramas' },
    ],
    teams,
    draft: { pick_order: [0], pick_index: 0, picks: [], status: 2 },
    schedule,
    standings,
    activity_reports: activityReports,
    player_snapshots: {},
    player_pool: playerPool,
  };
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('Connected to MongoDB');

  const playersDB = client.db('proplayers');
  const leaguesDB = client.db('wowdraft');

  // Clear existing data
  await Promise.all([
    playersDB.collection('dps').deleteMany({}),
    playersDB.collection('healers').deleteMany({}),
    playersDB.collection('tanks').deleteMany({}),
    leaguesDB.collection('leagues').deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // Build a shuffled name pool so every player gets a unique name
  const namePool = shuffle([...NAMES]);

  // Generate players
  const dpsPlayers     = generatePlayers('dps',     150, namePool);
  const healerPlayers  = generatePlayers('healers',  80, namePool);
  const tankPlayers    = generatePlayers('tanks',    60, namePool);

  // Insert players
  await playersDB.collection('dps').insertMany(dpsPlayers);
  await playersDB.collection('healers').insertMany(healerPlayers);
  await playersDB.collection('tanks').insertMany(tankPlayers);

  // Build and insert sample league with mock season data
  const demoLeague = buildDemoLeague(dpsPlayers, healerPlayers, tankPlayers);
  await leaguesDB.collection('leagues').insertOne(demoLeague);

  console.log('\nSeed complete!');
  console.log(`  DPS:     ${dpsPlayers.length} players`);
  console.log(`  Healers: ${healerPlayers.length} players`);
  console.log(`  Tanks:   ${tankPlayers.length} players`);
  console.log(`  Total:   ${dpsPlayers.length + healerPlayers.length + tankPlayers.length} players`);
  console.log(`  Sample league: "${demoLeague.name}" (code: demo, status: ${demoLeague.status})`);
  console.log(`  Teams: ${demoLeague.teams.length} teams with drafted players`);
  console.log(`  Reports: ${demoLeague.activity_reports.length} mock activity reports`);

  // Print a few sample players
  console.log('\n--- Sample DPS player ---');
  console.log(JSON.stringify(dpsPlayers[0], null, 2));
  console.log('\n--- Sample Healer ---');
  console.log(JSON.stringify(healerPlayers[0], null, 2));
  console.log('\n--- Sample Tank ---');
  console.log(JSON.stringify(tankPlayers[0], null, 2));

  await client.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
