# WeekGrid (Svelte rebuild)

The Svelte 5 + Vite version of WeekGrid, built part by part. The plain-JS app in the parent folder keeps working until this one catches up.

```bash
cd svelte
npm install
npm run dev      # http://localhost:5173
npm test         # data-layer + shell tests
npm run build    # static site in dist/ (ready for Vercel), with sw.js for offline
npm run preview  # try the built app, offline mode included: http://localhost:4173
```

Same data format and `localStorage` key (`weekgrid:v1`) as the original, so exports import straight in.
For your own timetable, put `my-timetable.js` in `public/` (git-ignored).

## Layout

```
src/lib/constants.js   days, colours, views
src/lib/dates.js       date and time helpers
src/lib/model.js       state shape, normalising, frozen history, presets, marks (pure)
src/lib/stats.js       day score, streak, week stats (pure)
src/lib/store.svelte.js reactive state, saving, change stamps for sync, day rollover
src/lib/motion.js      full / lite / off motion level
src/lib/transitions.js tab transition, day/week slide
src/components/        Header, Intro, Wipe, Toast, Scene, Sheet, GymSheet, CardioSheet, CardioCard, RestBar, Pace
src/lib/effects.js     sparks, confetti
src/lib/scene.js       3D background grid of recent weeks
src/lib/tilt.js        card tilt (laptop), page lean (phone)
src/lib/theme.svelte.js colour themes (Colour / Mono)
src/lib/gym.js         workout + cardio logic (pure)
src/lib/gymui.svelte.js sheets, rest/cardio timers, beeps
src/views/             Today, Week, Timetable, Settings
src/lib/pwa.svelte.js  service worker registration, safe updates, install prompt, storage protection
pwa/sw.js              service worker template (offline cache, fonts, my-timetable.js)
pwa/plugin.js          writes dist/sw.js with the built file list and a version hash
vercel.json            Vercel build settings and cache headers
```

## Offline and installing

The built app works without internet after the first visit. Each build gets a new
cache version; a new version downloads in the background and then:

- switches quietly the next time the app is in the background, unless a rest timer,
  cardio timer or workout is open;
- otherwise shows "New version ready · Reload".

Settings → App shows the version, offline status, storage protection, and an
Install button (Chrome/Edge). On iPhone: Safari → Share → Add to Home Screen.
The service worker only runs in `npm run build` / `preview` / hosted, not in `npm run dev`.

## Deploy to Vercel

1. Push the repo to GitHub.
2. On vercel.com: Add New → Project → import `weekgrid`.
3. Set **Root Directory** to `svelte`. Vercel reads the rest from `vercel.json`
   (Vite, `npm run build`, output `dist`).
4. Deploy. Every push to `main` redeploys, and installed copies pick up the update.

`public/my-timetable.js` is git-ignored, so the hosted app starts with the sample week.

## Progress

- [x] Part 1: project, data layer with tests, app shell (header, tabs, intro, page wipe)
- [x] Part 2: Today (marking, notes, catch-up nudge, day slide, strip, bursts/confetti), 3D background grid, card tilt, phone lean
- [x] Part 3: Week (average, streak, best day, bars, hours vs targets, 8-week heatmap, notes, week stepping)
- [x] Part 4: Timetable editor (add/edit/delete blocks, copy a day, overlap warning)
- [x] Mono theme (black, white, grey + red), switch in the header
- [x] Smooth fade between tabs; centred tab switcher with hover glow; theme reveal spreading from the switch
- [x] Part 5: Settings (categories, theme, animations, streak threshold, export/import, sample week, clear)
- [x] Part 6: gym log (sets, last session, suggested weight, extra sets/exercises, session pace), rest timer, cardio timer, extra workout, leaving-the-gym checklist, their Settings editors
- [x] Part 7: offline app (service worker, safe auto-update, install button, storage protection), Vercel config
- [ ] Host on Vercel (needs your account)
- [ ] Pairing-code sync
