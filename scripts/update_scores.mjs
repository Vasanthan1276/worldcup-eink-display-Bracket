/**
 * Scheduled GitHub Actions cache updater.
 * The display itself also fetches the live feed directly. This script writes the
 * latest successful response into public/data/live.json, so the display keeps
 * working when the public API is unavailable from the e-ink browser.
 */
```js
import { writeFile } from 'node:fs/promises';

const API =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=500&dates=20260601-20260731';

const TARGET = 'public/data/live.json';

const phaseConfig = {
  r32:   { base: 73,  count: 16 },
  r16:   { base: 89,  count: 8 },
  qf:    { base: 97,  count: 4 },
  sf:    { base: 101, count: 2 },
  third: { base: 103, count: 1 },
  final: { base: 104, count: 1 }
};

function phaseOf(event) {
  const text = [
    event.season?.type?.slug,
    event.competitions?.[0]?.altGameNote,
    event.name
  ].filter(Boolean).join(' ').toLowerCase();

  if (text.includes('round-of-32') || text.includes('round of 32')) return 'r32';
  if (text.includes('round-of-16') || text.includes('round of 16')) return 'r16';
  if (text.includes('quarter')) return 'qf';
  if (text.includes('semi')) return 'sf';
  if (text.includes('third-place') || text.includes('third place')) return 'third';
  if (text.includes('final')) return 'final';

  return null;
}

function statusOf(event) {
  const type = event.status?.type;

  if (type?.completed) return 'final';
  if (type?.state === 'in') return 'live';

  return 'scheduled';
}

function teamsOf(event) {
  const competitors = [...(event.competitions?.[0]?.competitors || [])]
    .sort((a, b) => {
      if (a.homeAway === 'home') return -1;
      if (b.homeAway === 'home') return 1;
      return 0;
    });

  return competitors.slice(0, 2).map(team => ({
    name: team.team?.displayName || 'TBD',
    score: team.score ?? '–',
    winner: Boolean(team.winner)
  }));
}

const response = await fetch(API, {
  headers: { 'user-agent': 'worldcup-eink-display/1.0' }
});

if (!response.ok) {
  throw new Error(`ESPN request failed: ${response.status}`);
}

const data = await response.json();
const grouped = { r32: [], r16: [], qf: [], sf: [], third: [], final: [] };

for (const event of data.events || []) {
  const phase = phaseOf(event);
  if (phase) grouped[phase].push(event);
}

for (const [phase, config] of Object.entries(phaseConfig)) {
  grouped[phase].sort((a, b) => new Date(a.date) - new Date(b.date));

  if (grouped[phase].length < config.count) {
    throw new Error(
      `ESPN returned only ${grouped[phase].length} ${phase} matches; expected ${config.count}.`
    );
  }
}

const matches = [];

for (const [phase, config] of Object.entries(phaseConfig)) {
  grouped[phase]
    .slice(0, config.count)
    .forEach((event, index) => {
      const teams = teamsOf(event);
      const winner = teams.find(team => team.winner)?.name || null;

      matches.push({
        id: `M${config.base + index}`,
        time: event.date,
        venue: event.competitions?.[0]?.venue?.fullName || '',
        status: statusOf(event),
        teams,
        winner
      });
    });
}

matches.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

const updatedAt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Singapore',
  dateStyle: 'medium',
  timeStyle: 'short',
  hour12: false
}).format(new Date()).replace(',', ' · ') + ' SGT';

await writeFile(
  TARGET,
  JSON.stringify({ updatedAt, matches }, null, 2) + '\n'
);

console.log(`Updated ${matches.length} knockout matches.`);
```
