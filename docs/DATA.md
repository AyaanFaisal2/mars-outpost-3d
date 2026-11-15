# NASA data used in Mars Outpost

Every number that comes from NASA is listed here, with what it drives in the game and how to check it.
The in-game **🛰️ NASA data** button (title and end screens) shows the same list with links.

## 1. Solar storms — NASA DONKI (archived + live)

**Source:** DONKI (Space Weather Database Of Notifications, Knowledge, Information), NASA's Community
Coordinated Modeling Center, via `https://api.nasa.gov/DONKI/CME` (and `/GST` for geomagnetic storms).

**Archived (default):** `src/data/donki.json`, written by `npm run data` (`scripts/fetch-nasa.js`).
The script pulls these real storm windows and keeps the 3 fastest CMEs (≥ 500 km/s) of each:

| Window | Why |
|---|---|
| 22–24 Jul 2012 | The extreme CME that just missed Earth |
| 4–12 Sep 2017 | Storms that Curiosity's RAD measured on the Martian surface |
| 7–15 May 2024 | The storms from active region 13664 (big auroras on Earth) |
| 1–10 Oct 2024 | Another strong storm period |

Fields kept per CME (everything else is dropped; nothing is invented):

| Field | From | Used for |
|---|---|---|
| `date`, `time` | `startTime` | Date shown in the event ("This really happened! On 10 September 2017…") |
| `speed`, `halfAngle` | most accurate `cmeAnalyses[]` entry | `speed` → **storm strength** (`stormStrength()` in `src/game.js`) |
| `sep` | a linked `-SEP-` event (solar energetic particles = radiation) | +0.15 storm strength, "radiation burst" in the dialog |
| `flare`, `flareLinked` | flare class only if written in the CME `note` (e.g. `X8.2`); `flareLinked` if a `-FLR-` event is linked | Shown in the dialog; X adds +0.10, M adds +0.05 strength |
| `marsArrival` | `enlilList[].impactList[]` entry with `location: "Mars"` (WSA-ENLIL model) | **Forecast warning** in sols (`travelSols()`); if absent, Sun→Mars distance (2.28×10⁸ km) ÷ speed |
| `kp` | max Kp of a linked geomagnetic storm (GST) | Shown as "Earth aurora storm Kp N" |
| `region`, `link` | `activeRegionNum`, `link` | Dialog source link |

The DONKI FLR (flare) endpoint returned HTTP 404 while this was built, so flare classes are only
known when the CME note states one. They are never guessed.

**Live (bonus):** `src/nasa.js` → `loadSpaceWeather()` asks DONKI for CMEs from the last 30 days
(4 s timeout, `DEMO_KEY`, cached 1 hour in `localStorage` because DEMO_KEY is rate-limited) and adds
up to 3 of them to the storm pool. Every storm shows its label in the event dialog:
**"Archived NASA data (fetched YYYY-MM-DD)"** or **"Live NASA data"**. Archived data is never labelled live.
Offline or rate-limited → the game runs on the archive and the credits screen says so.

**Refresh the archive:** `npm run data` (optional: `NASA_API_KEY=yourkey npm run data`, free key at
api.nasa.gov — DEMO_KEY allows only ~10 requests/hour). The script falls back to `curl` if Node's own
network access is blocked.

**Current archive (fetched 2026-11-15):** 10 real CMEs, 1,178–3,435 km/s. Flare classes found in NASA's
notes: X9.3 (6 Sep 2017), X8.7 (14 May 2024), X2.9 (15 May 2024), X1.8 (9 Oct 2024). The strongest,
the 23 Jul 2012 CME (3,435 km/s, SEP-linked), is used for the Sol 60 "BIG storm".

## 2. Mars numbers — `src/data/mars.js`

| Constant | Value | Drives | Source |
|---|---|---|---|
| `surfaceDose` | 0.64 mSv/sol | Base radiation rate (`rates().dose`) | Curiosity RAD, Hassler et al., *Science* 2014, doi:10.1126/science.1244797 |
| `cruiseDose` | 1.84 mSv/day | Dose already received on the flight | Curiosity RAD cruise, Zeitlin et al., *Science* 2013, doi:10.1126/science.1235989 |
| `cruiseDays` | 180 days | Trip dose = 1.84 × 180 = **331 mSv** | One-way transit used by Zeitlin et al. 2013 |
| `careerLimit` | 600 mSv | Budget = 600 − 331 = **269 mSv**; mission lost at the limit | NASA-STD-3001 (NASA OCHMO radiation technical brief) |
| `solHours` | 24.6597 h | "A sol is 24 h 39 min" (Space Book, tips) | NASA Mars Fact Sheet |
| `sunlight` | 0.431 × Earth | Experiment fact, Solar Farm entry | NASA Mars Fact Sheet (586.2 vs 1361 W/m²) |
| `lightMin` | 3.0–22.3 min | **Ask Mission Control** delay, HUD "Earth: N light-min" | Fact Sheet distances 54.6–401.4 million km ÷ c |
| `avgTemp` | −59 °C | Cold-night fact | NASA Mars Fact Sheet (~214 K) |
| `storm2017` | 2–3 × dose rate | Storm fact | Zeitlin et al., GRL 2018; NASA/SwRI release |
| `site` | Jezero Crater ~18.4°N 77.5°E | Base location | NASA Perseverance mission |

Note: the plan draft said 0.67 mSv/sol and a 24 h 37 min sol. The published RAD surface value is
0.64 mSv/day, and 24 h 37 min is Mars's *sidereal* day — the solar day (sol) is 24 h 39 min 35 s.

## 3. Game simplifications (honest list)

- **Time:** 1 sol = 12 s at ×1 speed. CME warnings use real travel days as sols (1–4).
- **Earth–Mars distance** follows the real 3–22 light-minute range, but its 26-month cycle is squeezed
  into the 100-sol mission so players see it change. Delay in game = 1 s + 0.2 s per light-minute of round trip.
- **Storm doses are exaggerated.** Real surface storms are modest because Mars's thin air still blocks a
  lot (Sept 2017: dose rate ×2–3 for ~2 days). In the game a storm adds `(6 + 30 × strength)` mSv
  (×1.4 for the Sol 60 storm), ÷4 if the crew hides, reduced 10% per Shelter level. Without that, the
  dose meter would never matter in a 100-sol game. The *ranking* of storms (which is stronger) is real.
- **Shelter** shielding (−10%/level, −70% while hiding) is a game number, not a measured regolith curve.

## 4. Not included (future work)

- **Mars Trek real terrain** (a DEM pipeline for Jezero). The 3D ground is procedural; the site name and
  coordinates are real.
- **Worldwide leaderboard**: needs a hosted database and name moderation (players are children).
  Storage is behind `loadBoard()` / `saveScore()` in `src/main.js` so it can be swapped.
