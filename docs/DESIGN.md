# Design: trade-off map

The game teaches one idea: **every choice gives something up.** A test (`every choice gives something up`)
fails if any option in any event, including every real-storm event, has no cost.

## Meters (4)

| Meter | Goes | Mission lost when | Main drains | Main sources |
|---|---|---|---|---|
| 🫁 Life Support | 0–100 | reaches 0 | crew breathing/drinking, greenhouse water | Life Support room (needs power) |
| ⚡ Power | 0–100 | **never directly** | base load, Life Support, Greenhouse | Solar Farm (daytime only, ×0.4 in dust) |
| 🥬 Food | 0–100 | reaches 0 | crew eating | Greenhouse (needs power + water) |
| ☢️ Radiation dose | 0 → 269 mSv, **only up** | reaches 269 mSv | 0.64 mSv/sol (real RAD value) + storms | — (Shelter level and hiding slow it) |

**Power factor:** below 25% power, rooms that use power run slower (down to 20% at 0%). A blackout
doesn't end the game — it starves life support and food, which does. Shown as "⚡ low power — slowed"
on room cards and "⚡ slow" on 3D labels; the 3D fan and windows slow/dim.

## Rooms and boosts

| Room | Makes | Uses / s | ✨ Boost (8 s cooldown) |
|---|---|---|---|
| 🫁 Life Support | life | power | +4 🫁, −3 ⚡ |
| ⚡ Solar Farm | power (day) | — | +5 ⚡, −2 🔩 |
| 🥬 Greenhouse | food | life, power | +4 🥬, −3 ⚡ |
| 🛡️ Shelter | shielding (−10% dose per level) | — | Hide ½ sol: dose rate ×0.3, −4 ⚡ |

Upgrades cost 🔩 parts (20/30/40/50). Parts no longer trickle in: they come from event choices
(rover rescue +6, quiet day +8, supply ship +30) and from science (every 10 🔬 → +10 🔩).

## Events and their trade-offs

| Event | Option A | Option B | Wait cost/s (Ask MC) |
|---|---|---|---|
| ☀️ Solar Storm (real DONKI CME) | 🛡️ Hide: dose ÷4, −8 ⚡, −6 🥬 | ⚡ Keep working: full dose, +2 🔬 | dose |
| ⚠️ Sol 60 BIG storm (strongest archived) | same, ×1.4 dose | same | dose |
| 🌪️ Dust Storm (3-sol warning) | Stay inside: −12 ⚡ −4 🥬 | Sweep panels: −4 ⚡ −5 🫁 +3 mSv | power |
| ☄️ Space Rock | Quick patch: −8 🫁 | Fix right: −8 🥬 −4 ⚡ −3 🔩 | life |
| 🚰 Leaky Pipe | Recycler: −12 ⚡ +3 🫁 | By hand: −6 🫁 −3 🥬 | life |
| 🎂 Birthday | Party: −8 🥬 +2 🔬 | Repairs: −6 ⚡ +8 🔩 | food |
| 🚙 Stuck Rover | Rescue: −10 ⚡ −5 🫁 +3 🔬 +6 🔩 | Leave it: −4 🔩 | power |
| 🥶 Cold Night (2-sol warning) | Heaters: −12 ⚡ | Bundle up: −6 🥬 −4 🫁 | power |
| 🔬 Strange Rock (science) | Rover: −10 ⚡ +4 mSv +6 🔬 | Drone: −6 🔩 +3 🔬 | power |
| 🧪 Experiment (science) | Test plants: −7 🥬 +5 🔬 | Watch sky: −9 ⚡ +4 🔬 | power |
| 🚀 Sol 40 Supply Ship | Food +30 / Parts +30 / Life +30 | each −6 ⚡ | power |
| 🌑 Sol 80 Long Night | Ration: −10 🥬 −6 🫁 | Batteries: −22 ⚡ | power |

Every event also offers **🔩 Spend 15 parts** (the worst option at half cost) when it has fewer than 3 options.

## 📡 Ask Mission Control (communication delay)

Option costs are hidden — you choose from the description. Or ask Mission Control: the dialog closes,
the game keeps running, and the event's **wait cost** ticks until the answer arrives
(1 s + 0.2 s × round-trip light-minutes: ~2 s near Sol 1, ~10 s near Sol 50). Then the dialog returns
with Mission Control's pick starred ⭐, its cost shown and halved. Their pick (`advice()` in
`game.js`) weighs each loss by how low that meter is, and dose by how much budget is still spare after
the rest of the mission's normal dose. **Act now with less information, or wait and pay.**

## Scoring

Only missions that reach Sol 100: `🫁 + ⚡ + 🥬 + ☢️ budget left %` (0–400), ×1.5 on Hard.
Science is shown beside it and breaks ties. Failed missions are listed by sols survived.

## Balance check (headless, 300 runs per row, 10-storm archive)

| Mode | Strategy | Wins | Main cause of loss |
|---|---|---|---|
| Easy | random choices | ~76% | radiation, food |
| Easy | Mission Control's picks | ~100% | — |
| Hard | random choices | ~63% | food, radiation |
| Hard | Mission Control's picks | ~97% | life, food |

Thinking pays: careless play loses 1 run in 4 on Easy and 1 in 3 on Hard; careful play nearly always wins.
Even careful players end near 200 of 269 mSv, so radiation stays a real worry. Storm odds (`STORM_ODDS` in
`main.js`, 15%) and the storm dose formula (`stormEvent()` in `game.js`) are the two tuning knobs.
