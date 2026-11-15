# Changelog

## 2.2.0 — 2026-11-15 · The ride home

- 🚀 Ending cutscene: the crew walk out of the airlock carrying a crate, a sample case and a greenhouse plant, the
  base powers down, a countdown runs and the Mars Ascent Vehicle lifts off at sunset into the stars, with
  letterbox captions, sound and a Skip button. The debrief follows.
- A failed mission plays an emergency lift-off instead ("Nobody was hurt"). The rocket waits on its pad all game.

## 2.1.0 — 2026-11-15 · Player guidance

- 🧑‍🚀 Commander's Briefing on first play (goal, meters, Boost vs Upgrade, events). The clock waits until you
  close it; reopen any time with ❓.
- 🧭 Next step bar: always shows the one most useful thing to do (low meter, incoming storm, parts to spend), and
  the matching building and button glow. On phones the room list scrolls to it.
- Meters show their names; room buttons say "Boost" / "Upgrade" / "Recharging"; each room says what it makes.
- Tips wait while a card is open and stay 8 s; fixed the tip box never hiding.

## 2.0.0 — 2026-11-15 · Aligned with the "Junior Astronaut Mission Trainer" brief

### Real NASA data
- Solar storms are real CMEs from NASA DONKI (`src/data/donki.json`, refreshed by `npm run data`), plus an
  optional live check of the last 30 days. Every storm is labelled "Archived NASA data (date)" or "Live NASA data".
- Storm strength comes from real CME speed (+ SEP radiation link, + flare class when known); warning time from the
  real modelled Mars arrival. The Sol 60 storm is the strongest one in the archive.
- Real Mars constants with sources (`src/data/mars.js`): Curiosity RAD dose rates, NASA 600 mSv career limit,
  sol length, sunlight, light-time, temperature.
- 🛰️ NASA data credits screen; every Space Fact has a source link.

### Mechanics
- Six meters → four: 🫁 Life Support (air + water), ⚡ Power, 🥬 Food, ☢️ Radiation dose. Spirit removed.
- Six rooms → four: Life Support, Solar Farm, Greenhouse, Shelter. Crew quarters is now scenery.
- Power slows powered rooms below 25% and no longer ends the mission by itself.
- Radiation dose only goes up; Shelter level and hiding cut it; the limit is the lose condition.
- 📡 Ask Mission Control: a light-time delay with ongoing cost, then a starred, half-cost recommendation.
- No free choices: boosts cost power or parts; parts come from choices and science, not a trickle.
- 🔬 Science goal with two research events.
- Cause-and-effect debrief on the end screen.
- "Day" → "Sol" everywhere, with a one-time explanation.
- Mission codes now include a seed, so a code replays the same events.

### Learning
- 📖 Space Book: 25 entries (pronunciation, one-sentence explanation, "tell me more", read-aloud, source).
  Dotted words in game text open them; collect them all; meters and ℹ️ buttons open their entry.
- First-time coach tips (skippable). Pause + tap a building to learn about it.
- Optional "Do you remember?" quiz on the end screen (stars only).

### Leaderboard
- Score = resources left after Sol 100 (×1.5 Hard), science as tiebreak; failed runs listed by sols survived.
- Call-signs only (3 letters or a generated name); stored on this device.

### 3D
- Storm strength drives the flare tint; the shelter bubble shows while hiding; low power dims windows and
  slows the life-support fan; a dose warning lamp lights up on the Shelter.

### Docs and tests
- `docs/DATA.md`, `docs/DESIGN.md`, `docs/JUDGES.md`, README refresh.
- 11 tests (was 2): storm strength vs speed, dose never falls, power factor, no free choices, score, Mission
  Control advice, DONKI parsing, archive format, Space Book plain-language check.

### Known gaps
- `npm run data` with DEMO_KEY allows only ~10 requests/hour; use a free NASA key for repeated refreshes.
- Real Mars Trek terrain and a worldwide leaderboard are not included (see `docs/DATA.md`).
