const { expect } = require('chai');
const wclCache = require('../services/wcl-cache');

describe('WCL Cache Service', function () {
  describe('getGameVersions', function () {
    it('should return an array of game versions', function () {
      const versions = wclCache.getGameVersions();
      expect(versions).to.be.an('array');
      expect(versions.length).to.be.greaterThan(0);
    });

    it('each version should have id, name, and base URL', function () {
      const versions = wclCache.getGameVersions();
      for (const v of versions) {
        expect(v).to.have.property('id');
        expect(v).to.have.property('name');
        expect(v).to.have.property('base');
        expect(v.base).to.match(/^https:\/\//);
      }
    });

    it('should include retail and classic', function () {
      const versions = wclCache.getGameVersions();
      const ids = versions.map(v => v.id);
      expect(ids).to.include('retail');
      expect(ids).to.include('classic');
    });
  });

  describe('when WCL client is unavailable', function () {
    before(function () {
      // Ensure WCL client returns null by clearing env vars
      delete process.env.WCL_CLIENT_ID;
      delete process.env.WCL_CLIENT_SECRET;
      // Clear cached client singleton
      delete require.cache[require.resolve('../services/warcraftlogs')];
      delete require.cache[require.resolve('../services/wcl-cache')];
    });

    it('getRegions should return null', async function () {
      const cache = require('../services/wcl-cache');
      const result = await cache.getRegions('retail');
      expect(result).to.be.null;
    });

    it('getServers should return null', async function () {
      const cache = require('../services/wcl-cache');
      const result = await cache.getServers(1, 'retail');
      expect(result).to.be.null;
    });

    it('getExpansions should return null', async function () {
      const cache = require('../services/wcl-cache');
      const result = await cache.getExpansions('retail');
      expect(result).to.be.null;
    });

    it('getZones should return null', async function () {
      const cache = require('../services/wcl-cache');
      const result = await cache.getZones(1, 'retail');
      expect(result).to.be.null;
    });
  });
});
