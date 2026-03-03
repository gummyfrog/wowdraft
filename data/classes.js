// WCL class IDs → name + default role
// tags: all roles this class can fill (used for draft filtering)
// defaultTag: primary role shown by default
const WCL_CLASSES = {
  1: { name: 'Warrior', defaultTag: 'dps', tags: ['dps', 'tanks'], specs: ['Arms', 'Fury', 'Protection'] },
  2: { name: 'Paladin', defaultTag: 'healers', tags: ['healers', 'dps', 'tanks'], specs: ['Holy', 'Protection', 'Retribution'] },
  3: { name: 'Hunter', defaultTag: 'dps', tags: ['dps'], specs: ['Beast Mastery', 'Marksmanship', 'Survival'] },
  4: { name: 'Rogue', defaultTag: 'dps', tags: ['dps'], specs: ['Assassination', 'Combat', 'Subtlety'] },
  5: { name: 'Priest', defaultTag: 'healers', tags: ['healers', 'dps'], specs: ['Discipline', 'Holy', 'Shadow'] },
  6: { name: 'Death Knight', defaultTag: 'dps', tags: ['dps', 'tanks'], specs: ['Blood', 'Frost', 'Unholy'] },
  7: { name: 'Shaman', defaultTag: 'healers', tags: ['healers', 'dps'], specs: ['Elemental', 'Enhancement', 'Restoration'] },
  8: { name: 'Mage', defaultTag: 'dps', tags: ['dps'], specs: ['Arcane', 'Fire', 'Frost'] },
  9: { name: 'Warlock', defaultTag: 'dps', tags: ['dps'], specs: ['Affliction', 'Demonology', 'Destruction'] },
  10: { name: 'Monk', defaultTag: 'healers', tags: ['healers', 'dps', 'tanks'], specs: ['Brewmaster', 'Mistweaver', 'Windwalker'] },
  11: { name: 'Druid', defaultTag: 'dps', tags: ['dps', 'healers', 'tanks'], specs: ['Balance', 'Feral', 'Guardian', 'Restoration'] },
  12: { name: 'Demon Hunter', defaultTag: 'dps', tags: ['dps', 'tanks'], specs: ['Havoc', 'Vengeance'] },
  13: { name: 'Evoker', defaultTag: 'dps', tags: ['dps', 'healers'], specs: ['Devastation', 'Preservation', 'Augmentation'] },
};

function resolveClass(classID) {
  return WCL_CLASSES[classID] || { name: 'Unknown', defaultTag: 'dps', tags: ['dps'], specs: ['Unknown'] };
}

module.exports = { WCL_CLASSES, resolveClass };
