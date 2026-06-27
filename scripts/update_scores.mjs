/**
 * Scheduled GitHub Actions cache updater.
 * The display itself also fetches the live feed directly. This script writes the
 * latest successful response into public/data/live.json, so the display keeps
 * working when the public API is unavailable from the e-ink browser.
 */
import { writeFile } from 'node:fs/promises';

const target = 'public/data/live.json';
const url = 'https://worldcup26.ir/get/games';

const response = await fetch(url, {
  headers: { 'user-agent': 'worldcup-eink-display/1.0' }
});

if (!response.ok) {
  throw new Error(`World Cup API failed: ${response.status}`);
}

const json = await response.json();
const games = json.games || [];

const matches = games
  .filter(game => Number(game.id) >= 73 && Number(game.id) <= 104)
  .map(game => {
    const id = `M${game.id}`;

    const home = game.home_team_name_en || game.home_team_label || 'TBD';
    const away = game.away_team_name_en || game.away_team_label || 'TBD';

    const homeScore = game.home_score ?? '–';
    const awayScore = game.away_score ?? '–';

    const finished = String(game.finished).toUpperCase() === 'TRUE';

    let winner = null;
    if (finished && Number(homeScore) > Number(awayScore)) winner = home;
    if (finished && Number(awayScore) > Number(homeScore)) winner = away;

    return {
      id,
      time: game.utc_date || game.date || game.datetime || null,
      venue: game.stadium_name_en || game.stadium || '',
      status: finished ? 'final' : (game.time_elapsed || 'scheduled'),
      teams: [
        { name: home, score: homeScore, winner: winner === home },
        { name: away, score: awayScore, winner: winner === away }
      ],
      winner
    };
  })
  .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

const updatedAt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Singapore',
  dateStyle: 'medium',
  timeStyle: 'short',
  hour12: false
}).format(new Date()).replace(',', ' · ') + ' SGT';

await writeFile(
  target,
  JSON.stringify({ updatedAt, matches }, null, 2) + '\n'
);
