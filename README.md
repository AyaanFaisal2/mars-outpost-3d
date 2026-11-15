# Mars Outpost 3D — Junior Astronaut Mission Trainer

A NASA Space Apps game: command a base in Jezero Crater on Mars for 100 sols. The base runs itself;
you handle **real solar storms from NASA DONKI**, dust storms, leaks and supply drops, keep your crew's
radiation dose under NASA's limit, and learn every space word as you meet it.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ (deploy anywhere)
npm test         # simulation checks
npm run data     # refresh archived NASA DONKI storms (NASA_API_KEY optional)
```

## Play

- **Four meters:** 🫁 Life Support, ⚡ Power, 🥬 Food, ☢️ Radiation dose. The mission ends if life support
  or food hits 0, or the dose reaches 269 mSv (NASA's 600 mSv career limit minus the 331 mSv from the flight).
- **Power runs everything:** under 25% power, life support and the greenhouse slow down.
- **Solar storms are real CMEs** from NASA's DONKI database: real date, real speed (strength), real travel
  time (warning). Hide in the 🛡️ Shelter or keep working: it's a trade-off.
- **📡 Ask Mission Control** before deciding: better advice, but Earth is 3–22 light-minutes away and the
  problem keeps costing while you wait.
- **🔬 Science:** optional research events cost resources but earn science (and parts).
- **📖 Space Book:** tap any dotted word for a kid-friendly explanation with read-aloud. Collect all 25.
- **🏆 Leaderboard:** score = resources left after Sol 100 (Hard ×1.5). Saved on this device; crew call-signs only.
- ⏸ Pause, then tap a building to learn what it is. Drag to orbit, scroll to zoom.

## Code

| File | What it holds |
|---|---|
| `src/game.js` | Pure data + simulation: meters, rooms, events, rates, storm strength, Mission Control advice, score, mission codes. No DOM. |
| `src/main.js` | UI, audio synth, event dialogs, Ask Mission Control, Space Book, tips, debrief, leaderboard, game loop. |
| `src/scene.js` | Three.js world: terrain, sky + day/night, 4 base buildings that react to meters and power, storm/shelter bubble, dose warning lamp, rover, dust storm. |
| `src/nasa.js` | Archived DONKI storms + optional live check, with "Archived/Live NASA data" labels. |
| `src/data/mars.js` | Real Mars numbers, each with its source. |
| `src/data/donki.json` | Archived NASA DONKI CMEs (written by `scripts/fetch-nasa.js`). |
| `src/data/glossary.js` | Space Book entries. |
| `docs/` | `DATA.md` (datasets + simplifications), `DESIGN.md` (trade-off map), `JUDGES.md` (one-pager). |
