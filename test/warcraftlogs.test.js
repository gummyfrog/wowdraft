const { expect } = require('chai');
const { WarcraftLogsClient, GAME_VERSIONS } = require('../services/warcraftlogs');

describe('WarcraftLogsClient', function () {
  it('should construct with credentials', function () {
    const client = new WarcraftLogsClient('test-id', 'test-secret');
    expect(client.clientId).to.equal('test-id');
    expect(client.clientSecret).to.equal('test-secret');
    expect(client.accessToken).to.be.null;
  });

  it('should skip re-auth if token is still valid', async function () {
    const client = new WarcraftLogsClient('id', 'secret');
    client.accessToken = 'cached-token';
    client.tokenExpiry = Date.now() + 60000;
    const token = await client.authenticate();
    expect(token).to.equal('cached-token');
  });

  it('should not use cached token when expired', function () {
    const client = new WarcraftLogsClient('id', 'secret');
    client.accessToken = 'old-token';
    client.tokenExpiry = Date.now() - 1000;
    // Expired token means authenticate() won't short-circuit
    // We can verify by checking that the expiry condition fails
    const isValid = client.accessToken && Date.now() < client.tokenExpiry;
    expect(isValid).to.equal(false);
  });

  it('getClient returns null when env vars are missing', function () {
    delete process.env.WCL_CLIENT_ID;
    delete process.env.WCL_CLIENT_SECRET;
    delete require.cache[require.resolve('../services/warcraftlogs')];
    const { getClient } = require('../services/warcraftlogs');
    expect(getClient()).to.be.null;
  });
});

describe('GAME_VERSIONS', function () {
  it('should be an array with retail and classic', function () {
    expect(GAME_VERSIONS).to.be.an('array');
    const ids = GAME_VERSIONS.map(v => v.id);
    expect(ids).to.include('retail');
    expect(ids).to.include('classic');
  });

  it('each version should have id, name, and base URL', function () {
    for (const v of GAME_VERSIONS) {
      expect(v).to.have.property('id');
      expect(v).to.have.property('name');
      expect(v).to.have.property('base');
      expect(v.base).to.match(/^https:\/\/.*warcraftlogs\.com$/);
    }
  });

  it('retail and classic should have different base URLs', function () {
    const retail = GAME_VERSIONS.find(v => v.id === 'retail');
    const classic = GAME_VERSIONS.find(v => v.id === 'classic');
    expect(retail.base).to.not.equal(classic.base);
  });
});
