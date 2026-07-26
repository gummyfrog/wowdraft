const axios = require('axios');

const DEFAULT_COLOR = 0x00B7FF;
const FIELD_LIMIT = 1024;
const POST_TIMEOUT_MS = 10000;

// '#RRGGBB' -> integer. Anything else (named colours, junk, missing) -> brand blue.
function parseColor(hex) {
  if (typeof hex !== 'string') return DEFAULT_COLOR;
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return DEFAULT_COLOR;
  return parseInt(match[1], 16);
}

function truncate(text, limit = FIELD_LIMIT) {
  if (typeof text !== 'string' || text.length <= limit) return text;
  return text.slice(0, limit - 3) + '...';
}

function teamNames(reportData) {
  const names = {};
  for (const team of reportData) names[team.team_id] = team.team_name || team.team_id;
  return names;
}

function matchupLines(matchups, names) {
  const lines = [];

  for (const m of matchups) {
    if (m.bye) {
      lines.push((names[m.bye] || m.bye) + ' — bye');
      continue;
    }

    const home = names[m.home] || m.home;
    const away = names[m.away] || m.away;
    let line = home + ' ' + m.homeScore + ' – ' + m.awayScore + ' ' + away;

    if (m.tie) line += ' (Tie)';
    else if (m.winner) line += ' (Winner: ' + (names[m.winner] || m.winner) + ')';

    lines.push(line);
  }

  return lines;
}

// No schedule yet (first week / unscheduled league): show raw team totals instead.
function standingsLines(reportData) {
  return reportData
    .slice()
    .sort((a, b) => (b.total_points || 0) - (a.total_points || 0))
    .map(t => (t.team_name || t.team_id) + ' — ' + (t.total_points || 0) + ' pts');
}

function topPerformer(reportData) {
  let best = null;

  for (const team of reportData) {
    const players = team.players || {};
    for (const name of Object.keys(players)) {
      const entry = players[name] || {};
      const total = (entry.points && entry.points.total) || 0;
      if (!best || total > best.total) {
        best = { name, total, title: entry.title, team: team.team_name || team.team_id };
      }
    }
  }

  return best;
}

// Pure: league + persisted report entry -> Discord webhook JSON body.
function buildReportPayload(league, report, baseUrl) {
  const data = Array.isArray(report.data) ? report.data : [];
  const fields = [];

  if (Array.isArray(report.matchups) && report.matchups.length > 0) {
    const lines = matchupLines(report.matchups, teamNames(data));
    if (lines.length > 0) {
      fields.push({ name: 'Matchups', value: truncate(lines.join('\n')) });
    }
  } else if (data.length > 0) {
    fields.push({ name: 'Team Totals', value: truncate(standingsLines(data).join('\n')) });
  }

  const best = topPerformer(data);
  if (best) {
    let value = best.name + ' (' + best.team + ') — ' + best.total + ' pts';
    if (best.title) value += '\n' + best.title;
    fields.push({ name: 'Top Performer', value: truncate(value) });
  }

  return {
    embeds: [{
      title: league.name + ' — Week ' + report.week + ' Results',
      url: baseUrl + '/leagues/' + league.code + '/rankings',
      color: parseColor(league.color1),
      fields,
      footer: { text: 'wowdraft weekly report' },
      timestamp: new Date(report.time || Date.now()).toISOString(),
    }],
  };
}

// Fire-and-forget: never rejects. A dead webhook must not break report generation.
function postReport(league, report, http = axios) {
  const url = league && league.discord_webhook_url;
  if (!url) return Promise.resolve(null);

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  return Promise.resolve()
    .then(() => http.post(url, buildReportPayload(league, report, baseUrl), { timeout: POST_TIMEOUT_MS }))
    .catch((err) => {
      console.error('[discord] webhook post failed for league ' + (league.code || '?') + ':', err.message);
      return null;
    });
}

module.exports = { buildReportPayload, postReport, parseColor };
