# World Cup 2026 – e-ink live bracket

A single-screen **800 × 480** World Cup knockout bracket designed for a reTerminal E1002 / SenseCraft HMI Web widget.

## Publish to GitHub Pages

1. Open your existing `worldcup-elink-display` repository on GitHub.
2. Add these files to the repository root, replacing its existing `index.html`.
3. Commit the changes.
4. In **Settings → Pages**, set **Build and deployment** to **Deploy from a branch**, choose `main` and `/ (root)`, then save.
5. The public display address will be: `https://<your-github-username>.github.io/worldcup-elink-display/`
6. Paste that address into the SenseCraft HMI **Web** widget. Set the canvas to 800 × 480 and a refresh interval of 15–30 minutes.

## Live scores and fallback behaviour

- The page refreshes every 15 minutes and requests the public score feed directly.
- GitHub Actions creates an hourly cached copy in `public/data/live.json`, so a temporary upstream or device-browser failure does not leave the display blank.
- Scores are live only when the source exposes a recognisable official match number such as `Match 73`. The page remains usable with its local schedule otherwise.
- To manually correct a team, date or score, edit `public/data/live.json`. A final result must include `winner: true` on the winning team; the next round then fills automatically.

## Important GitHub setting

The scheduled score workflow is disabled by GitHub if a repository has no activity for 60 days. During the tournament, opening the **Actions** tab and running **Update World Cup scores** once will re-enable it.
