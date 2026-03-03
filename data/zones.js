// Raid zones by game version, keyed by WCL zone ID
const ZONES = {
  classic: [
    { id: 1000, name: 'Molten Core' },
    { id: 1001, name: "Onyxia's Lair" },
    { id: 1002, name: 'Blackwing Lair' },
    { id: 1003, name: "Zul'Gurub" },
    { id: 1004, name: "Temple of Ahn'Qiraj" },
    { id: 1005, name: "Ruins of Ahn'Qiraj" },
    { id: 1006, name: 'Naxxramas' },
  ],
  retail: [
    { id: 44, name: 'Manaforge Omega' },
    { id: 42, name: 'Liberation of Undermine' },
    { id: 40, name: 'Blackrock Depths' },
    { id: 38, name: "Nerub'ar Palace" },
  ],
};

function getZonesForVersion(gameVersion) {
  return ZONES[gameVersion] || ZONES.retail;
}

module.exports = { ZONES, getZonesForVersion };
