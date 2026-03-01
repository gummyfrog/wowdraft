const { expect } = require('chai');
const { ZONES, getZonesForVersion } = require('../data/zones');
const { WCL_CLASSES, resolveClass } = require('../data/classes');

describe('Zone Data', function () {
  it('should have classic and retail zones', function () {
    expect(ZONES.classic).to.be.an('array').with.length.greaterThan(0);
    expect(ZONES.retail).to.be.an('array').with.length.greaterThan(0);
  });

  it('each zone should have id and name', function () {
    for (const zones of Object.values(ZONES)) {
      for (const zone of zones) {
        expect(zone).to.have.property('id');
        expect(zone).to.have.property('name');
      }
    }
  });

  it('getZonesForVersion should return correct zones', function () {
    expect(getZonesForVersion('classic')).to.equal(ZONES.classic);
    expect(getZonesForVersion('retail')).to.equal(ZONES.retail);
    expect(getZonesForVersion('unknown')).to.equal(ZONES.retail);
  });
});

describe('Class Data', function () {
  it('should have entries for class IDs 1-13', function () {
    for (let i = 1; i <= 13; i++) {
      expect(WCL_CLASSES[i]).to.have.property('name');
      expect(WCL_CLASSES[i]).to.have.property('defaultTag');
      expect(WCL_CLASSES[i]).to.have.property('specs');
    }
  });

  it('resolveClass should return class info', function () {
    const warrior = resolveClass(1);
    expect(warrior.name).to.equal('Warrior');
    expect(warrior.defaultTag).to.equal('dps');
  });

  it('resolveClass should handle unknown IDs', function () {
    const unknown = resolveClass(999);
    expect(unknown.name).to.equal('Unknown');
  });
});
