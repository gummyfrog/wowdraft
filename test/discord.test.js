const { expect } = require('chai');
const { buildReportPayload, postReport, parseColor } = require('../services/discord');

const league = {
  name: 'Aldori League',
  code: 'abc123',
  color1: '#8b0000',
};

function team(id, name, points, players) {
  return { team_id: id, team_name: name, total_points: points, players: players || {} };
}

function player(total, title) {
  const entry = { points: { total, parse: 0, dps: 0, bosses_down: 0, speedy_clear: 0, new_best: 0, consistency: 0, all_stars: 0 } };
  if (title) entry.title = title;
  return entry;
}

describe('Discord Webhooks', function () {
  describe('buildReportPayload', function () {
    const baseUrl = 'https://wowdraft.test';

    it('should build embed title, url and color from the league', function () {
      const report = { time: new Date('2026-07-01T00:00:00Z'), week: 3, data: [], matchups: null };
      const payload = buildReportPayload(league, report, baseUrl);
      const embed = payload.embeds[0];

      expect(embed.title).to.equal('Aldori League — Week 3 Results');
      expect(embed.url).to.equal('https://wowdraft.test/leagues/abc123/rankings');
      expect(embed.color).to.equal(0x8b0000);
      expect(embed.timestamp).to.equal('2026-07-01T00:00:00.000Z');
    });

    it('should fall back to the default color for a non-hex color1', function () {
      expect(parseColor('black')).to.equal(0x00B7FF);
      expect(parseColor(undefined)).to.equal(0x00B7FF);
      expect(parseColor('#00B7FF')).to.equal(0x00B7FF);
      expect(parseColor('0070FF')).to.equal(0x0070ff);
    });

    it('should render a matchup line with the winner', function () {
      const report = {
        week: 2,
        data: [team('t1', 'Ragnaros', 34), team('t2', 'Onyxia', 28)],
        matchups: [{ home: 't1', away: 't2', homeScore: 34, awayScore: 28, winner: 't1', loser: 't2' }],
      };
      const field = buildReportPayload(league, report, baseUrl).embeds[0].fields[0];

      expect(field.name).to.equal('Matchups');
      expect(field.value).to.equal('Ragnaros 34 – 28 Onyxia (Winner: Ragnaros)');
    });

    it('should render a tie matchup', function () {
      const report = {
        week: 2,
        data: [team('t1', 'Ragnaros', 30), team('t2', 'Onyxia', 30)],
        matchups: [{ home: 't1', away: 't2', homeScore: 30, awayScore: 30, winner: null, loser: null, tie: true }],
      };
      const field = buildReportPayload(league, report, baseUrl).embeds[0].fields[0];

      expect(field.value).to.equal('Ragnaros 30 – 30 Onyxia (Tie)');
    });

    it('should render a bye line by team name', function () {
      const report = {
        week: 2,
        data: [team('t1', 'Ragnaros', 34), team('t3', 'Nefarian', 12)],
        matchups: [
          { home: 't1', away: 't3', homeScore: 34, awayScore: 12, winner: 't1', loser: 't3' },
          { bye: 't3' },
        ],
      };
      const field = buildReportPayload(league, report, baseUrl).embeds[0].fields[0];

      expect(field.value.split('\n')[1]).to.equal('Nefarian — bye');
    });

    it('should list team totals when matchups is null', function () {
      const report = {
        week: 1,
        data: [team('t1', 'Ragnaros', 12), team('t2', 'Onyxia', 40)],
        matchups: null,
      };
      const fields = buildReportPayload(league, report, baseUrl).embeds[0].fields;

      expect(fields[0].name).to.equal('Team Totals');
      expect(fields[0].value).to.equal('Onyxia — 40 pts\nRagnaros — 12 pts');
    });

    it('should pick the global top performer and name their team', function () {
      const report = {
        week: 2,
        data: [
          team('t1', 'Ragnaros', 34, { Alpha: player(20), Bravo: player(14) }),
          team('t2', 'Onyxia', 28, { Charlie: player(27, 'Parse Lord'), Delta: player(1) }),
        ],
        matchups: null,
      };
      const fields = buildReportPayload(league, report, baseUrl).embeds[0].fields;
      const top = fields[fields.length - 1];

      expect(top.name).to.equal('Top Performer');
      expect(top.value).to.equal('Charlie (Onyxia) — 27 pts\nParse Lord');
    });

    it('should omit the top performer field when no players are drafted', function () {
      const report = { week: 1, data: [team('t1', 'Ragnaros', 0)], matchups: null };
      const names = buildReportPayload(league, report, baseUrl).embeds[0].fields.map(f => f.name);

      expect(names).to.not.include('Top Performer');
    });

    it('should truncate a field value to the Discord 1024 char limit', function () {
      const data = [];
      for (let i = 0; i < 200; i++) data.push(team('t' + i, 'Averylongteamname' + i, i));
      const report = { week: 1, data, matchups: null };
      const field = buildReportPayload(league, report, baseUrl).embeds[0].fields[0];

      expect(field.value.length).to.equal(1024);
      expect(field.value.slice(-3)).to.equal('...');
    });

    it('should contain no emoji in embed text', function () {
      const report = {
        week: 2,
        data: [team('t1', 'Ragnaros', 34, { Alpha: player(20, 'Ace') }), team('t2', 'Onyxia', 28)],
        matchups: [{ home: 't1', away: 't2', homeScore: 34, awayScore: 28, winner: 't1', loser: 't2' }],
      };
      const text = JSON.stringify(buildReportPayload(league, report, baseUrl));

      expect(/\p{Extended_Pictographic}/u.test(text)).to.equal(false);
    });
  });

  describe('postReport', function () {
    function stubHttp() {
      const calls = [];
      return {
        calls,
        post: function (url, body, opts) { calls.push({ url, body, opts }); return Promise.resolve({ status: 204 }); },
      };
    }

    it('should resolve without posting when no webhook is configured', async function () {
      const http = stubHttp();
      const result = await postReport({ ...league }, { week: 1, data: [], matchups: null }, http);

      expect(result).to.equal(null);
      expect(http.calls).to.have.length(0);
    });

    it('should resolve without posting when the webhook url is empty', async function () {
      const http = stubHttp();
      await postReport({ ...league, discord_webhook_url: '' }, { week: 1, data: [], matchups: null }, http);

      expect(http.calls).to.have.length(0);
    });

    it('should post the payload with a 10s timeout when configured', async function () {
      const http = stubHttp();
      const url = 'https://discord.com/api/webhooks/1/token';
      await postReport({ ...league, discord_webhook_url: url }, { week: 4, data: [], matchups: null }, http);

      expect(http.calls).to.have.length(1);
      expect(http.calls[0].url).to.equal(url);
      expect(http.calls[0].opts.timeout).to.equal(10000);
      expect(http.calls[0].body.embeds[0].title).to.equal('Aldori League — Week 4 Results');
    });

    it('should use BASE_URL for embed links when set', async function () {
      const prev = process.env.BASE_URL;
      process.env.BASE_URL = 'https://draft.example.com';
      try {
        const http = stubHttp();
        await postReport({ ...league, discord_webhook_url: 'https://discord.com/api/webhooks/1/t' }, { week: 1, data: [], matchups: null }, http);
        expect(http.calls[0].body.embeds[0].url).to.equal('https://draft.example.com/leagues/abc123/rankings');
      } finally {
        if (prev === undefined) delete process.env.BASE_URL;
        else process.env.BASE_URL = prev;
      }
    });

    it('should swallow transport errors and resolve', async function () {
      const http = { post: function () { return Promise.reject(new Error('ECONNREFUSED')); } };
      const originalError = console.error;
      const logged = [];
      console.error = function () { logged.push(Array.from(arguments).join(' ')); };

      try {
        const result = await postReport({ ...league, discord_webhook_url: 'https://discord.com/api/webhooks/1/t' }, { week: 1, data: [], matchups: null }, http);
        expect(result).to.equal(null);
        expect(logged.join(' ')).to.contain('ECONNREFUSED');
      } finally {
        console.error = originalError;
      }
    });

    it('should swallow synchronous throws from the http client', async function () {
      const http = { post: function () { throw new Error('boom'); } };
      const originalError = console.error;
      console.error = function () {};

      try {
        const result = await postReport({ ...league, discord_webhook_url: 'https://discord.com/api/webhooks/1/t' }, { week: 1, data: [], matchups: null }, http);
        expect(result).to.equal(null);
      } finally {
        console.error = originalError;
      }
    });
  });
});
