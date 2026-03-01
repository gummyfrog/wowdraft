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
// Sample league
// ---------------------------------------------------------------------------

const SAMPLE_LEAGUE = {
  code: 'demo',
  name: 'Azeroth Championship',
  description: 'A demo league for testing',
  icon: 'banner_Orc.png',
  color1: '#8b0000',
  color2: '#1a1a2e',
  faction: 'Horde',
  server: 'Faerlina',
  style: 'Standard',
  status: 'Setting Up',
  rounds: 9,
  report_day: 'Wednesday',
  start_date: '2024-01-15',
  admin: { name: 'Guest#1234' },
  requirements: { dps: 5, healers: 2, tanks: 2 },
  teams: [],
  draft: { pick_order: [0], pick_index: 0, picks: [], status: 0 },
  activity_reports: [],
};

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

  // Insert sample league
  await leaguesDB.collection('leagues').insertOne(SAMPLE_LEAGUE);

  console.log('\nSeed complete!');
  console.log(`  DPS:     ${dpsPlayers.length} players`);
  console.log(`  Healers: ${healerPlayers.length} players`);
  console.log(`  Tanks:   ${tankPlayers.length} players`);
  console.log(`  Total:   ${dpsPlayers.length + healerPlayers.length + tankPlayers.length} players`);
  console.log(`  Sample league: "Azeroth Championship" (code: demo)`);

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
