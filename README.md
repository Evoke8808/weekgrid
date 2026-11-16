# ▦ WeekGrid

**Plan your week in time blocks. Mark what you actually did. See the gap.**

WeekGrid is a tiny, no-signup progress tracker for people who follow a weekly timetable — students balancing classes, DSA, the gym and side projects, or anyone testing their own discipline.

No backend, no account, no build step. Open `index.html` and go.

## Features

- **Weekly timetable** — set up repeating blocks for each day (start, end, title, category). Copy a day to another in one click.
- **Today view** — tap **✓ Done**, **½ Partial** or **✗ Missed** on each block. Add a one-line note on what slipped.
- **Week view** — average completion, day streak 🔥, best day, a 7-day bar chart, and hours per category against your weekly target.
- **Categories** — colors, weekly hour targets, and an untracked mode for fixed things like classes or travel.
- **Streaks** — a day counts when you hit your completion threshold (default 70%).
- **History stays put** — past days keep the blocks they had, so editing your timetable never rewrites old scores.
- **Fair scoring** — today's blocks that haven't ended yet aren't counted against your weekly average; days before you started are left blank.
- **Catch-up nudge** — if yesterday has unmarked blocks (like "sleep on time"), Today offers a one-tap way back.
- **Motion** — a welcome sequence, a seven-column page wipe between tabs, and feedback on every mark. Respects reduced-motion.
- **Workout log** — tap a gym block to open its workout: log kg and reps per set against a fixed target, add extra sets on the spot, see last session's numbers with a suggested weight for today, and rest between sets with a 1:00, 1:30 or 2:00 timer that starts by itself.
- **Sync across devices** — optional. Paste a GitHub token with only the `gist` permission in Settings on each device and your data is kept in a secret Gist on your own account. Changes merge day by day, newest wins.
- **Keyboard** — ← and → step through days and weeks.
- **Private** — data lives in your browser's `localStorage`. Export/import JSON to back up or switch devices.
- **Mobile-friendly** — works on phone and laptop.

## Quick start

```bash
git clone https://github.com/<your-username>/weekgrid.git
cd weekgrid
open index.html        # macOS  (or just double-click it)
```

It ships with a sample student week.

To keep your own timetable out of git, drop a `my-timetable.js` next to `index.html` (it is in `.gitignore`):

```js
window.WEEKGRID_PRESET = { version: 1, categories: [/* ... */], schedule: { mon: [/* ... */] } };
```

It loads automatically. Bump `version` to apply it again after editing; your logs are never touched.

 Edit it in **Timetable**, or import your own from **Settings → Import JSON** (see [`examples/sample-week.json`](examples/sample-week.json) for the format).

## Install on your phone

Open the live site in Chrome (Android) or Safari (iPhone) and choose **Add to Home screen** / **Install app**. It opens full-screen like a native app and works offline.

## Deploy free on GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Source: Deploy from a branch → `main` / root**.
3. Your tracker is live at `https://<your-username>.github.io/weekgrid/`.

## How scoring works

| Mark | Credit |
|---|---|
| ✓ Done | 1 |
| ½ Partial | 0.5 |
| ✗ Missed / unmarked | 0 |

- **Day completion** = credit ÷ number of tracked blocks that day.
- **Category hours** = block length × credit, summed over the week.
- **Streak** = consecutive days at or above your threshold. Days with no tracked blocks are skipped, not counted as breaks.

## Data format

```json
{
  "categories": [{ "id": "dsa", "name": "DSA", "color": "#3ecf8e", "target": 5, "tracked": true }],
  "schedule": { "mon": [{ "id": "a1", "start": "20:00", "end": "21:30", "title": "DSA", "cat": "dsa" }], "tue": [] },
  "logs": { "2026-11-16": { "marks": { "a1": "done" }, "note": "" } },
  "settings": { "threshold": 70 }
}
```

## Tech

Plain HTML, CSS and JavaScript. ~0 dependencies.

```
index.html   layout and tabs
style.css    dark, mobile-first styles
app.js       state, stats and rendering
examples/    sample timetable to import
```

## Roadmap

- [ ] Reminders when a block starts
- [ ] Light theme

## Contributing

Issues and PRs are welcome. Keep it dependency-free and simple.

## License

[MIT](LICENSE)
