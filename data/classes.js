// WCL class IDs → name + default role
const WCL_CLASSES = {
  1: { name: 'Warrior', defaultTag: 'dps', specs: ['Arms', 'Fury', 'Protection'] },
  2: { name: 'Paladin', defaultTag: 'healers', specs: ['Holy', 'Protection', 'Retribution'] },
  3: { name: 'Hunter', defaultTag: 'dps', specs: ['Beast Mastery', 'Marksmanship', 'Survival'] },
  4: { name: 'Rogue', defaultTag: 'dps', specs: ['Assassination', 'Combat', 'Subtlety'] },
  5: { name: 'Priest', defaultTag: 'healers', specs: ['Discipline', 'Holy', 'Shadow'] },
  6: { name: 'Death Knight', defaultTag: 'dps', specs: ['Blood', 'Frost', 'Unholy'] },
  7: { name: 'Shaman', defaultTag: 'healers', specs: ['Elemental', 'Enhancement', 'Restoration'] },
  8: { name: 'Mage', defaultTag: 'dps', specs: ['Arcane', 'Fire', 'Frost'] },
  9: { name: 'Warlock', defaultTag: 'dps', specs: ['Affliction', 'Demonology', 'Destruction'] },
  10: { name: 'Monk', defaultTag: 'healers', specs: ['Brewmaster', 'Mistweaver', 'Windwalker'] },
  11: { name: 'Druid', defaultTag: 'dps', specs: ['Balance', 'Feral', 'Guardian', 'Restoration'] },
  12: { name: 'Demon Hunter', defaultTag: 'dps', specs: ['Havoc', 'Vengeance'] },
  13: { name: 'Evoker', defaultTag: 'dps', specs: ['Devastation', 'Preservation', 'Augmentation'] },
};

function resolveClass(classID) {
  return WCL_CLASSES[classID] || { name: 'Unknown', defaultTag: 'dps', specs: ['Unknown'] };
}

module.exports = { WCL_CLASSES, resolveClass };
