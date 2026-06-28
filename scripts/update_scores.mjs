import { readFile, writeFile } from 'node:fs/promises';

const API =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=500&dates=20260601-20260731';

const TARGET = 'public/data/live.json';

const PHASES = {
  r32: { base: 73, count: 16 },
  r16: { base: 89, count: 8 },
  qf: { base: 97, count: 4 },
  sf: { base: 101, count: 2 },
  third: { base: 103, count: 1 },
  final: { base: 104, count: 1 }
};

function phaseOf(event) {
  const competition = event.competitions && event.competitions[0]
    ? event.competitions[0]
    : {};

  const text = [
    event.name || '',
    event.shortName || '',
    event.season && event.season.type ? event.season.type.slug : '',
    competition.altGameNote || '',
    competition.notes && competition.notes[0] ? competition.notes[0].headline : ''
  ].join(' ').toLowerCase();

  if (text.includes('round of 32') || text.includes('round-of-32')) return 'r32';
  if (text.includes('round of 16') || text.includes('round-of-16')) return 'r16';
  if (text.includes('quarterfinal') || text.includes('quarter-final')) return 'qf';
  if (text.includes('semifinal') || text.includes('semi-final')) return 'sf';
  if (text.includes('third place') || text.includes('third-place')) return 'third';
  if (text.includes('final')) return 'final';

  return null;
}

function statusOf(event) {
  const type = event.status && event.status.type ? event.status.type : {};

  if (type.completed) return 'final';
  if (type.state === 'in') return 'live';

  return 'scheduled';
}

function teamsOf(event) {
  const competition = event.competitions && event.competitions[0]
    ? event.competitions[0]
    : {};

  const competitors = Array.isArray(competition.competitors)
    ? competition.competitors.slice()
    : [];

  competitors.sort(function (a, b) {
    if (a.homeAway === 'home') return -1;
    if (b.homeAway === 'home') return 1;
    return 0;
  });

  return competitors.slice(0, 2).map(function (team) {
    return {
      name: team.team && team.team.displayName ? team.team.displayName : 'TBD',
      score: team.score !== undefined && team.score !== null ? String(team.score) : '-',
      winner: Boolean(team.winner)
    };
  });
}

function readExisting() {
  return readFile(TARGET, 'utf8')
    .then(function (text) {
      const data = JSON.parse(text);
      return Array.isArray(data.matches) ? data.matches : [];
    })
    .catch(function () {
      return [];
    });
}

function buildUpdatedAt() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false
  }).format(new Date()).replace(',', ' · ') + ' SGT';
}

function main() {
  return fetch(API, {
    headers: {
      'user-agent': 'worldcup-eink-display/1.0'
    }
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('ESPN request failed: ' + response.status);
      }

      return response.json();
    })
    .then(function (data) {
      return readExisting().then(function (existingMatches) {
        const byId = new Map();

        existingMatches.forEach(function (match) {
          if (match && match.id) {
            byId.set(match.id, match);
          }
        });

        const grouped = {
          r32: [],
          r16: [],
          qf: [],
          sf: [],
          third: [],
          final: []
        };

        (data.events || []).forEach(function (event) {
          const phase = phaseOf(event);

          if (phase) {
            grouped[phase].push(event);
          }
        });

        Object.keys(PHASES).forEach(function (phase) {
          grouped[phase].sort(function (a, b) {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          });

          const config = PHASES[phase];

          grouped[phase]
            .slice(0, config.count)
            .forEach(function (event, index) {
              const id = 'M' + (config.base + index);
              const teams = teamsOf(event);
              const winner = teams.find(function (team) {
                return team.winner;
              });

              const competition = event.competitions && event.competitions[0]
                ? event.competitions[0]
                : {};

              byId.set(id, {
                id: id,
                time: event.date || null,
                venue: competition.venue && competition.venue.fullName
                  ? competition.venue.fullName
                  : '',
                status: statusOf(event),
                teams: teams,
                winner: winner ? winner.name : null
              });
            });
        });

        const matches = Array.from(byId.values()).sort(function (a, b) {
          return Number(String(a.id).replace('M', '')) -
            Number(String(b.id).replace('M', ''));
        });

        return writeFile(
          TARGET,
          JSON.stringify(
            {
              updatedAt: buildUpdatedAt(),
              matches: matches
            },
            null,
            2
          ) + '\n'
        ).then(function () {
          console.log('Updated ' + matches.length + ' bracket matches.');
        });
      });
    });
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});
