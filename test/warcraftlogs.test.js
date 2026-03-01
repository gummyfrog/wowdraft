const { expect } = require('chai');
const { WarcraftLogsClient } = require('../services/warcraftlogs');

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

  it('getClient returns null when env vars are missing', function () {
    delete process.env.WCL_CLIENT_ID;
    delete process.env.WCL_CLIENT_SECRET;
    delete require.cache[require.resolve('../services/warcraftlogs')];
    const { getClient } = require('../services/warcraftlogs');
    expect(getClient()).to.be.null;
  });
});
