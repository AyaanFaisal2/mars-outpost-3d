# Mars Outpost — one page for judges

**Challenge:** Junior Astronaut Mission Trainer (NASA Space Apps). A 3D browser game for kids: command a
base in Jezero Crater for 100 sols, balancing 3 resources and a radiation dose while real solar storms hit.

## NASA data used, and why

| Dataset | What it does in the game | Why it matters |
|---|---|---|
| **DONKI CME catalogue** (api.nasa.gov) | Each solar storm is a real CME: real date shown, real speed → storm strength, real modelled Mars arrival → warning time, real SEP link → "radiation burst" | Kids practise on storms that actually happened, and see that NASA forecasts them |
| **DONKI live feed** (last 30 days) | Adds current storms, labelled "Live NASA data" | Connects the game to today's Sun |
| **Curiosity RAD** (surface 0.64 mSv/sol, cruise 1.84 mSv/day) | Base dose rate; dose already received on the flight (331 mSv) | Real measured radiation on Mars |
| **NASA-STD-3001** career limit 600 mSv | Radiation budget = 600 − 331 = 269 mSv | A real astronaut-safety rule as the lose condition |
| **NASA Mars Fact Sheet** | Sol length, 43% sunlight, 3–22 light-minute distance, −59 °C | Communication delay mechanic and facts |

## Three mechanics from the brief

1. **Trade-offs** — 4 meters, every choice costs something (enforced by a unit test).
2. **Communication delay** — "📡 Ask Mission Control": better advice, but you pay while the signal travels.
3. **Learning for beginners** — 📖 Space Book: 25 terms/tools, tap any dotted word for a one-sentence
   explanation, pronunciation and read-aloud; collect them all; optional 3-question quiz.

## How to verify (5 minutes)

```bash
npm install
npm test        # 11 checks: storm strength vs real speed, dose never falls, no free choices, score, DONKI parsing, Space Book
npm run dev     # play: wait for a ☀️ forecast, then check the storm dialog's real date + "Archived NASA data" label
npm run data    # re-download the DONKI archive yourself (NASA_API_KEY optional)
```

- In the game, **🛰️ NASA data** lists every dataset with its source link.
- `docs/DATA.md` lists each field used, and every simplification (e.g. storm doses are exaggerated for a short game).
- `docs/DESIGN.md` has the full trade-off map and the balance check.

Kid-safety: no accounts or real names (leaderboard uses 3-letter call-signs), no tracking, works offline.
