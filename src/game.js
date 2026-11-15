// Pure game data + simulation. No DOM, no Three.js — runs in Node for tests.
import { MARS } from './data/mars.js';

export const DAY = 12; // seconds per sol at speed x1
export const SOLS = 100;
// Radiation budget for the stay: NASA career limit minus what the crew already got flying to Mars.
export const TRIP = Math.round(MARS.cruiseDose.value * MARS.cruiseDays.value); // 331 mSv
export const BUDGET = MARS.careerLimit.value - TRIP; // 269 mSv
const DOSE = MARS.surfaceDose.value / DAY; // mSv per game second

export const R = [['life', '🫁', 'Life Support'], ['power', '⚡', 'Power'], ['food', '🥬', 'Food'], ['dose', '☢️', 'Radiation dose']];
export const IC = { life: '🫁', power: '⚡', food: '🥬', dose: '☢️', p: '🔩', sci: '🔬' };
export const MW = { life: 'life', power: 'power', food: 'greenhouse', dose: 'dose' }; // meter → Space Book word

// room: icon, name, makes, output/s at Lv1, costs/s, boost effect, Space Book word
export const ROOMS = [
  ['🫁', 'Life Support', 'life', .42, { power: -.12 }, { life: 4, power: -3 }, 'life'],
  ['⚡', 'Solar Farm', 'power', 1.4, {}, { power: 5, p: -2 }, 'farm'],
  ['🥬', 'Greenhouse', 'food', .42, { life: -.05, power: -.06 }, { food: 4, power: -3 }, 'greenhouse'],
  ['🛡️', 'Shelter', 'dose', 0, {}, { power: -4 }, 'shelter'], // boost = crew hides for half a sol
];

const FACTS = 'https://science.nasa.gov/mars/facts/', SHEET = MARS.solHours.url, OPPY = 'https://science.nasa.gov/mission/mer-opportunity/';
// Events are data: c = [label, story, effects]; w = forecast sols; d = fixed sol; wait = cost per second while asking Mission Control
export const EV = [
  { i: '🌪️', t: 'Dust Storm Coming', w: 3, dust: 1, s: 'A giant dust storm is on its way. Dust blocks the Sun, so the solar panels will make much less power.',
    c: [['🏠 Stay inside', 'Safe, but power drops and the greenhouse lights dim.', { power: -12, food: -4 }],
      ['🧹 Sweep the panels outside', 'Keeps power up, but spacesuits use air and the crew gets extra radiation.', { power: -4, life: -5, dose: 3 }]],
    wait: { power: -.4 }, f: 'Dust storms on Mars can cover much of the planet, and the dust can take months to settle. That is why a base needs batteries, not just solar panels.', u: FACTS },
  { i: '☄️', t: 'Space Rock!', s: 'A tiny space rock punched a hole in the greenhouse!',
    c: [['🩹 Quick patch', 'Fast, but some air leaks out.', { life: -8 }],
      ['🔧 Seal the room and fix it right', 'No air lost, but crops die and the repair uses power and parts.', { food: -8, power: -4, p: -3 }]],
    wait: { life: -.5 }, f: 'Mars has such thin air that small space rocks do not burn up like shooting stars on Earth. They hit the ground — or your greenhouse.', u: FACTS },
  { i: '🚰', t: 'Leaky Pipe', s: 'A water pipe in life support is leaking!',
    c: [['♻️ Run the water recycler extra', 'Saves the water but uses lots of power.', { power: -12, life: 3 }],
      ['🛠️ Patch it by hand all night', 'No power used, but some water is lost and the tired crew eats more.', { life: -6, food: -3 }]],
    wait: { life: -.5 }, f: 'The International Space Station recycles about 98% of its water, even sweat and the water in breath. A Mars base would have to do the same.', u: 'https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/' },
  { i: '🎂', t: 'Birthday!', s: 'It is Zara the engineer\'s birthday!',
    c: [['🎉 Party with extra food', 'Uses food, but rested minds get new ideas for experiments.', { food: -8, sci: 2 }],
      ['🔧 Quiet day, extra repairs', 'You salvage spare parts, but repairs use power and nobody celebrates.', { power: -6, p: 8 }]],
    wait: { food: -.2 }, f: `Radio messages take ${MARS.lightMin.value[0]} to ${MARS.lightMin.value[1]} minutes to travel between Mars and Earth, so there are no live video calls home. Birthday wishes always arrive late!`, u: MARS.lightMin.url },
  { i: '🚙', t: 'Stuck Rover', s: 'A supply rover is stuck 20 km away. It is carrying rock samples and spare parts.',
    c: [['🆘 Drive out and rescue it', 'You get the samples and parts, but the trip uses power and suit air.', { power: -10, life: -5, sci: 3, p: 6 }],
      ['⏳ Leave it there', 'Saves supplies, but its spare parts are lost.', { p: -4 }]],
    wait: { power: -.2 }, f: 'NASA\'s Opportunity rover was planned to work for 90 sols. It kept going for almost 15 years!', u: OPPY },
  { i: '🥶', t: 'Extra Cold Night', w: 2, s: 'Tonight will be extra cold, even for Mars.',
    c: [['🔥 Turn the heaters up', 'Warm and safe, but heaters use lots of power.', { power: -12 }],
      ['🧥 Bundle up', 'Saves power, but bodies burn more food to stay warm and the air gets stale.', { food: -6, life: -4 }]],
    wait: { power: -.3 }, f: `Nights at the Viking 1 landing site dropped to about −89 °C. The average on Mars is about ${MARS.avgTemp.value} °C.`, u: SHEET },
  { i: '🔬', t: 'Strange Rock Spotted', s: 'The cameras spotted a rock with odd layers 5 km away. Scientists on Earth are excited!',
    c: [['🚙 Drive the rover there', 'Lots of science, but the trip uses power and the crew gets extra radiation outside.', { power: -10, dose: 4, sci: 6 }],
      ['🤖 Send the small drone', 'Safer, but less science and the drone uses spare parts.', { p: -6, sci: 3 }]],
    wait: { power: -.2 }, f: 'Rovers like Curiosity study layered rocks because each layer is like a page in Mars\'s history book.', u: 'https://science.nasa.gov/mission/msl-curiosity/' },
  { i: '🧪', t: 'Experiment Time', s: 'Mission Control asks for a new experiment. You have two ideas.',
    c: [['🌱 Grow test plants in Mars soil', 'Great science, but it uses greenhouse space, so less food.', { food: -7, sci: 5 }],
      ['🔭 Watch the sky all night', 'Good science, but the telescope uses power.', { power: -9, sci: 4 }]],
    wait: { power: -.2 }, f: `Sunlight on Mars is only about ${Math.round(MARS.sunlight.value * 100)}% as strong as on Earth, so plants and solar panels both get less energy.`, u: MARS.sunlight.url },
  { i: '🚀', t: 'Supply Ship!', d: 40, s: 'A cargo ship from Earth landed! The crane only has power to unload one box.',
    c: [['🥬 Food boxes', 'Fills the pantry.', { food: 30, power: -6 }],
      ['🔩 Spare parts', 'Lots of parts for upgrades.', { p: 30, power: -6 }],
      ['🫁 Oxygen and water kit', 'Refills life support.', { life: 30, power: -6 }]],
    wait: { power: -.2 }, f: 'Earth and Mars line up for the shortest trip only about every 26 months, so supply ships cannot come whenever you want.', u: SHEET },
  { d: 60, big: 1 }, // the strongest real storm in the NASA archive
  { i: '🌑', t: 'The Long Night', d: 80, dust: 1, s: 'Dust makes the sky dark for days. The solar panels barely work.',
    c: [['🕯️ Ration the power', 'Saves power, but greenhouse lights and air fans run low.', { food: -10, life: -6 }],
      ['🔋 Use batteries as usual', 'Everything keeps running, but the batteries drain fast.', { power: -22 }]],
    wait: { power: -.4 }, f: 'In 2018 a dust storm covered Mars for so long that the Opportunity rover\'s solar panels could not recharge, and its mission ended.', u: OPPY },
];
export const DEFWAIT = { life: -.25, power: -.25 };

export const LOSE = {
  life: ['Life support failed: the air and water ran out.', 'Engineers keep spare oxygen and water, recycle almost every drop, and give life support its own backup power.'],
  food: ['The food ran out.', 'Engineers grow crops early and store extra food long before it is needed.'],
  dose: ['The crew reached NASA\'s radiation limit and had to go home.', 'Engineers bury shelters under thick regolith, hide during solar storms, and watch NASA space-weather forecasts.'],
};
export const WHY = {
  life: 'The crew breathes and drinks every second, and life support needs power to keep up.', food: 'The crew eats every day, and the greenhouse needs power and water.',
  dose: `Mars has no magnetic shield, so the crew soaks up about ${MARS.surfaceDose.value} mSv every sol, plus extra in storms.`,
};

export const cl = v => Math.max(0, Math.min(100, v));
export const isDay = t => (t % DAY) / DAY < .6;
export const isCost = (k, v) => k == 'dose' ? v > 0 : v < 0;
export const fxs = f => Object.entries(f).filter(([, v]) => v).map(([k, v]) => (v > 0 ? '+' : '') + Math.round(v) + (k == 'dose' ? ' mSv' : '') + IC[k]).join(' ');
export const loss = f => Object.entries(f).reduce((a, [k, v]) => a + (isCost(k, v) ? -Math.abs(v) : 0), 0);
export const halve = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, isCost(k, v) ? (k == 'dose' ? Math.floor(v / 2) : Math.ceil(v / 2)) : v]));
export const upCost = L => 10 + 10 * L;
export const health = (r, k) => k == 'dose' ? cl(100 * (1 - r.dose / BUDGET)) : r[k]; // 0 = bad, 100 = great
export const lost = s => ['life', 'food'].find(k => s.r[k] <= 0) || (s.r.dose >= BUDGET ? 'dose' : null);

// Power factor: rooms that use power slow down below 25% power (to 0.2 at 0%).
export const pf = s => s.r.power >= 25 ? 1 : .2 + .8 * Math.max(0, s.r.power) / 25;
// Fraction of radiation that gets through: Shelter level, and hiding in it.
export const shieldF = (s, hide = s.hide > 0) => (1 - .1 * (s.L[3] - 1)) * (hide ? .3 : 1);

// Change per second of every meter.
export function rates(s) {
  const lv = l => 1 + .6 * (l - 1), k = s.hard ? 1 : .85, P = pf(s), sun = isDay(s.t) ? (s.dust > 0 ? .4 : 1) : 0;
  const r = { life: -.33 * k, power: -.4 * k, food: -.33 * k, dose: DOSE * shieldF(s) };
  ROOMS.forEach((o, i) => {
    const F = lv(s.L[i]);
    if (i == 1) r.power += o[3] * F * sun;
    else if (o[3]) r[o[2]] += o[3] * F * ('power' in o[4] ? P : 1);
    for (const c in o[4]) r[c] += o[4][c] * F;
  });
  return r;
}

// Apply a one-off effect. Dose only ever goes up. Every 10 science points, Earth sends 10 parts.
export function apply(s, f) {
  for (const k in f) {
    const v = f[k];
    if (k == 'p') s.p = Math.max(0, s.p + v);
    else if (k == 'sci') { const b = s.sci | 0; s.sci = Math.max(0, b + v); if ((s.sci / 10 | 0) > (b / 10 | 0)) s.p += 10; }
    else if (k == 'dose') s.r.dose += Math.max(0, v);
    else s.r[k] = cl(s.r[k] + v);
  }
}
export function tick(s, dt) {
  const rt = rates(s);
  for (const k in rt) s.r[k] = k == 'dose' ? s.r.dose + Math.max(0, rt.dose * dt) : cl(s.r[k] + rt[k] * dt);
}

// Mission Control's pick: least harm for *this* base right now (losses hurt more when a meter is low).
export function harm(s, f) {
  let h = 0;
  for (const [k, v] of Object.entries(f)) {
    if (k == 'dose') h += v * 60 / Math.max(5, BUDGET - s.r.dose - DOSE * DAY * (SOLS - s.t / DAY) * shieldF(s, false)); // vs. budget still spare after the rest of the mission
    else if (k == 'p') h += Math.max(0, -v) * .3;
    else if (k in s.r) h += (v < 0 ? -v * 50 : -v * 25) / (s.r[k] + 10);
  }
  return h;
}
export const advice = (s, opts) => opts.reduce((b, c, i) => harm(s, c[2]) < harm(s, opts[b][2]) ? i : b, 0);

// Earth–Mars distance in light-minutes (real 3–22 min range; the 26-month cycle is squeezed into one mission).
export const lightMin = t => { const [a, b] = MARS.lightMin.value; return a + (b - a) * (.5 - .5 * Math.cos(2 * Math.PI * t / DAY / SOLS)); };
export const commDelay = t => 1 + .2 * 2 * lightMin(t); // game seconds for the question to go and the answer to come back

// ---- Real NASA DONKI space weather ----
export function trimCME(c) {
  const an = c.cmeAnalyses || [], a = an.find(x => x.isMostAccurate) || an[0];
  if (!a || !a.speed) return null;
  const links = (c.linkedEvents || []).map(l => l.activityID);
  const mars = (a.enlilList || []).flatMap(e => e.impactList || []).find(i => i.location == 'Mars');
  return {
    id: c.activityID, date: c.startTime.slice(0, 10), time: c.startTime, speed: Math.round(a.speed), halfAngle: a.halfAngle ?? null,
    flare: (c.note || '').match(/\b([XMC]\d{1,2}\.\d)\b/)?.[1] || null, flareLinked: links.some(x => x.includes('-FLR-')), sep: links.some(x => x.includes('-SEP-')),
    marsArrival: mars && Date.parse(mars.arrivalTime) > Date.parse(c.startTime) ? mars.arrivalTime : null,
    region: c.activeRegionNum ?? null, link: c.link || null,
  };
}
// 0..1 from real CME speed, plus a bump if it came with radiation particles (SEP) or a big flare.
export function stormStrength(ev) {
  const fl = ev.flare ? { X: .1, M: .05 }[ev.flare[0]] || 0 : 0;
  return Math.min(1, .75 * Math.min(1, Math.max(0, (ev.speed - 400) / 2600)) + (ev.sep ? .15 : 0) + fl);
}
// Forecast warning in sols: real modelled Mars arrival time, else Sun→Mars distance ÷ speed.
export const travelSols = ev => {
  const t = Date.parse(ev.time), a = Date.parse(ev.marsArrival), d = a > t ? (a - t) / 864e5 : 2.28e8 / ev.speed / 86400;
  return Math.max(1, Math.min(4, Math.round(d)));
};
export const dstr = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export function stormEvent(ev, s, big = false) {
  const k = stormStrength(ev), spike = Math.round((6 + 30 * k) * (big ? 1.4 : 1) * shieldF(s, false));
  return {
    i: big ? '⚠️' : '☀️', t: big ? 'The BIG Solar Storm' : 'Solar Storm!', storm: ev, k,
    s: `This really happened! On ${dstr(ev.date)} the Sun threw a CME, a giant cloud of hot gas, at ${ev.speed.toLocaleString('en')} km/s.${ev.sep ? ' It came with a burst of fast radiation.' : ''} Today it hits your base.`,
    c: [['🛡️ Hide in the Shelter', 'Much less radiation, but no work gets done.', { dose: Math.max(1, Math.round(spike * .25)), power: -8, food: -6 }],
      ['⚡ Keep working', 'Machines, plants and experiments keep going, but the crew gets the full dose.', { dose: spike, sci: 2 }]],
    wait: { dose: spike * .03 },
    f: `Mars has no magnetic shield and very thin air, so storm radiation reaches the ground. In September 2017 Curiosity's RAD saw the dose rate jump ${MARS.storm2017.value[0]}–${MARS.storm2017.value[1]} times for over two days. Soil piled on a shelter blocks a lot of it.`,
    u: MARS.storm2017.url,
  };
}

// Score for a finished mission: what is left (0–400), ×1.5 on Hard. Failed missions get no score.
export function score(s) {
  if (s.t / DAY < SOLS || lost(s)) return null;
  const b = { life: s.r.life | 0, power: s.r.power | 0, food: s.r.food | 0, rad: health(s.r, 'dose') | 0 };
  return { ...b, total: Math.round((b.life + b.power + b.food + b.rad) * (s.hard ? 1.5 : 1)), sci: s.sci | 0 };
}

// Seeded random (mulberry32) so a mission code replays the same events.
export const rng = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// Mission Code: seed (0–9999) + sol + mode + 4 room levels in 6 base-36 characters
export const enc = s => {
  let n = ((s.seed | 0) * 101 + Math.min(SOLS, s.t / DAY | 0)) * 2 + (s.hard ? 1 : 0);
  s.L.forEach(l => n = n * 5 + l - 1);
  return n.toString(36).toUpperCase().padStart(6, '0');
};
export const dec = c => {
  if (!/^[0-9a-z]{1,6}$/i.test(c)) return null;
  let n = parseInt(c, 36);
  const L = [];
  for (let i = 0; i < 4; i++) { L.unshift(n % 5 + 1); n = Math.floor(n / 5); }
  const hard = n % 2, m = Math.floor(n / 2), sol = m % 101, seed = Math.floor(m / 101);
  return seed < 10000 ? { t: sol * DAY, hard, L, p: 30, seed } : null;
};
