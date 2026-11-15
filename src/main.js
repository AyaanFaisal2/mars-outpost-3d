// UI, audio and game loop. The simulation lives in game.js, the 3D world in scene.js.
import './style.css';
import { DAY, SOLS, BUDGET, TRIP, R, MW, ROOMS, EV, DEFWAIT, LOSE, WHY, isDay, isCost, fxs, loss, halve, upCost, health, lost, pf, rates, tick, apply, advice, lightMin, commDelay, stormStrength, stormEvent, travelSols, dstr, score, rng, enc, dec } from './game.js';
import { MARS } from './data/mars.js';
import { GLOSSARY, GROUPS, WORD } from './data/glossary.js';
import { ARCHIVE, archived, loadSpaceWeather } from './nasa.js';
import { createScene } from './scene.js';

const q = id => document.getElementById(id), $ = h => q('app').innerHTML = h, ov = h => q('ov').innerHTML = h;
const esc = t => String(t).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const link = (u, t) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;

let S = null, MU = !!get('mu', 0), AC, CARD = 0, BACK = 0, QZ = null, STORMS = archived, STARS = get('mo-stars', 0), TIPS = get('mo-tips', {});
const MET = new Set(get('mo-met', []));
const BIG = archived.reduce((a, e) => stormStrength(e) > stormStrength(a) ? e : a); // Sol 60 uses the strongest archived storm
loadSpaceWeather().then(s => STORMS = s);
const STORM_ODDS = .15; // share of random events that are real solar storms
const sol = () => Math.min(SOLS, (S.t / DAY | 0) + 1);

// ---------- audio (tiny synth, no files) ----------
function tone(f, d = .12, ty = 'square', v = .05, at = 0) {
  if (MU) return;
  try {
    AC = AC || new AudioContext();
    if (AC.state == 'suspended') AC.resume();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + at;
    o.type = ty; o.frequency.value = f;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d);
  } catch { /* no audio */ }
}
const seq = (fs, d, ty, v, gap) => () => fs.forEach((f, i) => tone(f, d, ty, v, i * gap));
const SFX = {
  click: seq([660], .07, 'square', .04, 0), up: seq([523, 659, 784, 1047], .12, 'square', .05, .07),
  alarm: seq([880, 660, 880, 660], .15, 'sawtooth', .05, .16), good: seq([659, 880], .14, 'triangle', .08, .1),
  bad: seq([300, 200], .22, 'sawtooth', .06, .12), dawn: seq([523, 784], .5, 'sine', .07, .2), dusk: seq([392, 262], .5, 'sine', .07, .2),
  win: seq([523, 659, 784, 1047, 1319], .2, 'triangle', .09, .12), beep: seq([880], .12, 'sine', .08, 0), go: seq([1320], .4, 'sine', .09, 0),
  rumble: seq([55, 52, 49, 46, 44, 41], .9, 'sawtooth', .09, .45), lose: seq([392, 330, 262, 196], .3, 'sawtooth', .06, .2),
};

// ---------- Space Book: tap-to-learn words ----------
const GL = [...GLOSSARY].sort((a, b) => b.word.length - a.word.length);
const GRX = new RegExp(GL.map(g => `\\b(${g.m})\\b`).join('|'), 'g');
function meet(id) { if (!MET.has(id)) { MET.add(id); put('mo-met', [...MET]); } }
// Plain text → HTML with the first use of each Space Book word as a tappable button.
function gloss(t) {
  const seen = new Set();
  return esc(t).replace(GRX, (m, ...a) => {
    const g = GL[a.slice(0, GL.length).findIndex(x => x !== undefined)];
    if (!g || seen.has(g.id)) return m;
    seen.add(g.id); meet(g.id);
    return `<button class="gw" data-a="word" data-i="${g.id}">${m}</button>`;
  });
}
function word(id) {
  const g = WORD[id];
  if (!g) return;
  meet(id); CARD = 1; SFX.click();
  q('card').innerHTML = `<div class="ov top-ov"><div class="c card" role="dialog" aria-modal="true" aria-labelledby="cw">
  <h2 id="cw">${g.icon} ${g.word}</h2><p class="say">🗣️ Say it: <b>${g.say}</b></p><p class="big">${g.short}</p>
  <details><summary>Tell me more</summary><p>${g.more}</p></details>
  ${g.url ? `<p><small>📚 Source: ${link(g.url, new URL(g.url).hostname)}</small></p>` : ''}
  <div class="row"><button data-a="say" data-i="${id}">🔊 Read to me</button><button class="alt" data-a="closeCard">✖ Close</button></div></div></div>`;
  q('card').querySelector('[data-a=say]').focus();
}
function say(id) {
  const g = WORD[id];
  try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(`${g.word}. ${g.short} ${g.more}`.replace(/mSv/g, 'millisieverts'))); } catch { /* no speech */ }
}
function closeCard() {
  q('card').innerHTML = ''; CARD = 0;
  try { speechSynthesis.cancel(); } catch { /* no speech */ }
  if (BACK) { BACK = 0; book(); }
}
function book() {
  CARD = 1; SFX.click();
  const n = GLOSSARY.filter(g => MET.has(g.id)).length;
  q('card').innerHTML = `<div class="ov top-ov"><div class="c card book" role="dialog" aria-modal="true" aria-labelledby="bk"><h2 id="bk">📖 Space Book</h2>
  <p>⭐ ${n}/${GLOSSARY.length} words found · 🧠 ${STARS} quiz stars. Tap a word to learn it. Find the rest by playing!</p>
  ${GROUPS.map((t, gi) => `<h3>${t}</h3><div class="words">${GLOSSARY.filter(g => g.g == gi).map(g => MET.has(g.id)
    ? `<button class="alt" data-a="bookWord" data-i="${g.id}">⭐ ${g.icon} <b>${g.word}</b><br><small>${g.short}</small></button>`
    : '<div class="unk">❓ ??? <small>— find me in the game</small></div>').join('')}</div>`).join('')}
  <button data-a="closeCard">✖ Close</button></div></div>`;
  q('card').querySelector('button').focus();
}

// ---------- first-time coach tips ----------
const tipQ = [];
let tipOn = 0;
function tip(id, text) { if (!TIPS[id] && !TIPS.skip && !tipQ.some(t => t[0] == id)) tipQ.push([id, text]); }
function showTip() {
  const el = q('tip');
  if (!el || CARD || tipOn || !tipQ.length) return;
  const [id, text] = tipQ.shift();
  TIPS[id] = 1; put('mo-tips', TIPS); tipOn = 1;
  el.hidden = false; el.querySelector('span').innerHTML = '💡 ' + gloss(text);
  setTimeout(() => { tipOn = 0; const e = q('tip'); if (e) e.hidden = true; }, 8000);
}
function skipTips() { TIPS.skip = 1; put('mo-tips', TIPS); tipQ.length = 0; q('tip').hidden = true; }
function tipsOn() { TIPS = {}; put('mo-tips', TIPS); title(); }

// ---------- first-time briefing (game is frozen while it is open) ----------
function brief() {
  CARD = 1; TIPS.brief = 1; put('mo-tips', TIPS); SFX.click();
  q('card').innerHTML = `<div class="ov top-ov"><div class="c card" role="dialog" aria-modal="true" aria-labelledby="bf"><h2 id="bf">🧑‍🚀 Commander's Briefing</h2>
  <p class="big">🎯 <b>Your goal:</b> keep the crew alive until <b>Sol ${SOLS}</b>. A sol is one Mars day (about ${DAY} seconds here).</p>
  <ol class="steps">
  <li><b>Watch the 4 meters at the top.</b> 🫁 Life Support, ⚡ Power and 🥬 Food must never reach 0. ☢️ Radiation must stay under ${BUDGET}. ▲ means going up, ▼ going down.</li>
  <li><b>The base runs by itself.</b> Help it with the buttons on each building:<br>✨ <b>Boost</b> = a quick top-up right now.<br>⬆ <b>Upgrade</b> = works better forever (costs 🔩 parts).</li>
  <li><b>Problems pop up.</b> The game pauses and you pick what to do. Every choice costs something, so pick what your base can spare.</li>
  <li><b>Not sure what to do?</b> Follow the 🧭 <b>Next step</b> bar. It always tells you, and the button to press glows.</li></ol>
  <button data-a="closeCard">🚀 Start the mission</button><p><small>Open this again any time with the ❓ button.</small></p></div></div>`;
  q('card').querySelector('button').focus();
}

// ---------- 🧭 Next step: always one clear thing to do → [text, room, 'b'oost | 'u'pgrade] ----------
const DO = ['Makes air & water', 'Makes power (day)', 'Grows food', 'Blocks radiation'];
function coach() {
  if (S.hold) return ['⏸ Paused. Tap a building to learn about it, then press ▶ to keep going.', -1];
  if (S.wait) return ['📡 Waiting for Mission Control to answer…', -1];
  const ready = i => S.cd[i] <= 0 && !(ROOMS[i][5].p < 0 && S.p < -ROOMS[i][5].p);
  const canUp = i => S.L[i] < 5 && S.p >= upCost(S.L[i]);
  const [v, i] = [0, 1, 2].map(i => [S.r[R[i][0]], i]).sort((a, b) => a[0] - b[0])[0];
  if (v < 35) {
    const m = `${R[i][1]} ${R[i][2]} is low!`;
    if (ready(i)) return [`${m} Press ✨ Boost on the ${ROOMS[i][1]}.`, i, 'b'];
    if (canUp(i)) return [`${m} Press ⬆ Upgrade on the ${ROOMS[i][1]}.`, i, 'u'];
    return [`${m} Boost is recharging. Press it again when the timer ends.`, i, 'b'];
  }
  const storm = S.q.find(x => x.e.storm), soon = S.q[0], left = x => Math.max(1, Math.ceil((x.due - S.t) / DAY));
  if (storm || health(S.r, 'dose') < 40) {
    const w = storm ? `☀️ A solar storm hits in ${left(storm)} sol(s)!` : '☢️ Radiation is getting high!';
    return canUp(3) ? [`${w} Press ⬆ Upgrade on the Shelter to block more radiation.`, 3, 'u']
      : [`${w} Save 🔩 parts for a Shelter upgrade. When it hits, hiding in the Shelter is the safe choice.`, 3];
  }
  if (soon) return S.r.power < 80 && ready(1) ? [`⚠️ ${soon.e.t} in ${left(soon)} sol(s)! Fill up ⚡ Power first: press ✨ Boost on the Solar Farm.`, 1, 'b']
    : [`⚠️ ${soon.e.t} in ${left(soon)} sol(s)! Keep your meters full so you can handle it.`, -1];
  const u = [1, ...[0, 2].sort((a, b) => S.r[R[a][0]] - S.r[R[b][0]]), 3].find(i => canUp(i) && (i != 1 || S.L[1] <= Math.min(S.L[0], S.L[2])));
  if (u !== undefined) return [`You have ${S.p | 0} 🔩 parts! Press ⬆ Upgrade on the ${ROOMS[u][1]}: it works better forever.`, u, 'u'];
  if (!S.dl) return ['🌙 Night: solar panels are off, so ⚡ Power drops until sunrise. That is normal!', -1];
  return ['✅ All good! The base runs itself. Keep every meter above 35 and collect 🔩 parts from events for upgrades.', -1];
}

// ---------- small UI helpers ----------
const news = t => { const e = q('nw'); if (e) e.innerHTML = '📡 ' + gloss(t); };
function fl(t, el, dx = 0) {
  if (!el) return;
  const e = document.createElement('span'), b = el.getBoundingClientRect();
  e.className = 'fl'; e.textContent = t;
  e.style.left = b.left + b.width / 2 + 'px'; e.style.top = b.top + 'px'; e.style.setProperty('--dx', dx + 'px');
  document.body.appendChild(e); setTimeout(() => e.remove(), 1000);
}
const shake = () => { document.body.classList.add('sh'); setTimeout(() => document.body.classList.remove('sh'), 500); world.shake(); };
function save() {
  const h = get('mo3', []);
  h.push({ t: S.t, hard: S.hard, r: S.r, L: S.L, p: S.p, sci: S.sci, seed: S.seed, log: S.log, f: S.f, used: S.used });
  put('mo3', h.slice(-4));
}

// ---------- screens ----------
function title() {
  S = null; ov(''); world.reset();
  $(`<div class="center"><div class="c"><h1>🚀 Mars Outpost</h1><p class="sub">Junior Astronaut Mission Trainer</p>
  <p>${gloss(`You are the commander of a base in Jezero Crater on Mars. Keep your crew alive for ${SOLS} sols (Mars days)! The solar storms are real ones, taken from NASA's DONKI database.`)}</p>
  <div class="g"><button data-a="start" data-i="0">🟢 Start: Easy</button><button class="alt" data-a="start" data-i="1">🔴 Start: Hard</button><button class="alt" data-a="cont">💾 Continue saved game</button>
  <div class="row"><input id="mc" maxlength="6" placeholder="MISSION CODE" aria-label="Mission code"><button data-a="byCode">Load code</button></div></div>
  <p><small>${gloss('🫁 Life Support · ⚡ Power · 🥬 Food · ☢️ Radiation dose. Spend 🔩 parts to upgrade rooms. Every choice is a trade-off. Drag to look around the base; tap a dotted word to learn it.')}</small></p>
  <div class="row wrap"><button class="alt" data-a="book">📖 Space Book</button><button class="alt" data-a="board">🏆 Leaderboard</button><button class="alt" data-a="credits">🛰️ NASA data</button>${TIPS.skip ? '<button class="alt" data-a="tipsOn">💡 Tips on</button>' : ''}</div></div></div>`);
}
function cont() { const h = get('mo3', []); h.length ? start(h[0].hard, h[0]) : alert('No saved game yet.'); }
function byCode() { const s = dec(q('mc').value.trim()); s ? start(s.hard, s) : alert('That code does not work. Check it and try again.'); }

function start(h, ld) {
  SFX.click();
  S = { hard: !!h, t: 0, r: { life: 70, power: 70, food: 70, dose: 0 }, L: [1, 1, 1, 1], p: 20, sci: 0, cd: [0, 0, 0, 0], q: [], f: [], log: [], used: [], dn: {}, dust: 0, fl: 0, hide: 0, sp: 1, pause: 0, hold: 0, over: 0, on: 1, seed: Math.random() * 1e4 | 0 };
  world.reset();
  if (ld) Object.assign(S, structuredClone(ld), { hard: !!ld.hard });
  else put('mo3', []);
  S.rand = rng(S.seed * 1000 + (S.t / DAY | 0));
  S.code = enc({ seed: S.seed, hard: S.hard, t: 0, L: [1, 1, 1, 1] });
  S.nx = S.t + 20; S.dy = S.t / DAY | 0; S.dl = isDay(S.t);
  EV.forEach(e => { if (e.d && e.d <= S.t / DAY + 1) S.dn[e.d] = 1; });
  build();
  tip('life', 'This is 🫁 Life Support: air to breathe and water to drink. Tap any meter to learn more.');
  tip('dose', `This is ☢️ Radiation dose. It only goes up! Your crew got ${TRIP} mSv flying here, so ${BUDGET} mSv are left before NASA's limit.`);
  tip('boost', 'Rooms run by themselves. ✨ Boost gives a quick top-up, but it costs power (the Solar Farm costs parts).');
  tip('pause', '⏸ Pause the game, then tap a building to learn what it is.');
  if (!TIPS.brief) brief();
}

function build() {
  ov('');
  $(`<div class="top"><div class="c hud"><b id="dy"></b><span><i><b id="cf"></b></i></span><b id="lm"></b><b id="pt"></b><b id="sc"></b><button class="alt" id="hd" data-a="hold" aria-label="Pause"></button><button class="alt" id="sp" data-a="spd" aria-label="Game speed"></button><button class="alt" id="mu" data-a="mut" aria-label="Sound"></button><button class="alt" data-a="book" aria-label="Space Book">📖</button><button class="alt" data-a="brief" aria-label="How to play">❓</button></div>
  <div class="bar">${R.map(([k, , n]) => `<button class="m" id="m${k}" data-a="word" data-i="${MW[k]}" aria-label="${n}: tap to learn"><span></span><i><b></b></i></button>`).join('')}</div>
  <div class="c nx" id="nx" aria-live="polite"></div><div class="c fc" id="fc"></div><div class="c tip" id="tip" hidden><span></span> <button class="alt" data-a="skipTips">Skip tips</button></div></div>
  <div class="spacer"></div>
  <div class="rooms">${ROOMS.map((o, i) => `<div class="rm" id="r${i}" data-r="${i}"><b>${o[0]} ${o[1]} <button class="info" data-a="word" data-i="${o[6]}" aria-label="What is the ${o[1]}?">ℹ️</button></b><small id="l${i}"></small><em id="w${i}"></em><div class="btns"><button id="b${i}" data-a="boost" data-i="${i}"></button><button class="alt" id="u${i}" data-a="upg" data-i="${i}"></button></div></div>`).join('')}</div>
  <div class="c nw" id="nw"></div>`);
  news('Base online in Jezero Crater! Everything runs by itself. Upgrade rooms to stay safe.');
}

function spd() { S.sp = S.sp % 3 + 1; SFX.click(); }
function mut() { MU = !MU; put('mu', MU ? 1 : 0); SFX.click(); }
function hold() { S.hold = !S.hold; SFX.click(); news(S.hold ? '⏸ Paused. Tap a building to learn what it is.' : '▶ Back to work!'); }
function boost(i, el = q('b' + i)) {
  if (!S || !S.on || S.cd[i] > 0 || S.pause || S.hold) return;
  const f = ROOMS[i][5];
  if (f.p && S.p < -f.p) return news('Not enough 🔩 parts to boost the Solar Farm.');
  apply(S, f); S.cd[i] = 8;
  if (i == 3) { S.hide = DAY / 2; news('🛡️ The crew is hiding in the Shelter: much less radiation for half a sol.'); }
  SFX.click(); fl(fxs(f), el); world.pulse(i);
}
function upg(i) {
  const c = upCost(S.L[i]);
  if (S.L[i] > 4 || S.p < c || S.pause) return;
  S.p -= c; S.L[i]++;
  SFX.up(); world.pulse(i);
  for (let j = 0; j < 6; j++) fl('✨', q('u' + i), (j - 3) * 14);
  news(ROOMS[i][1] + ' is now Level ' + S.L[i] + '!' + (i == 3 ? ' More regolith on the roof means less radiation.' : ''));
}

// ---------- simulation step ----------
function step(dt) {
  S.t += dt;
  const p0 = S.r.power;
  tick(S, dt);
  S.dust = Math.max(0, S.dust - dt); S.fl = Math.max(0, S.fl - dt * .8); S.hide = Math.max(0, S.hide - dt); S.cd = S.cd.map(c => Math.max(0, c - dt));
  if (S.wait) { // the unanswered problem keeps costing
    const f = Object.fromEntries(Object.entries(S.cur.wait || DEFWAIT).map(([k, v]) => [k, v * dt]));
    apply(S, f);
    for (const k in f) S.wait.paid[k] = (S.wait.paid[k] || 0) + f[k];
  }
  if (p0 > 0 && S.r.power <= 0) {
    S.log.push({ sol: sol(), txt: '⚡ The power ran out, so life support and the greenhouse slowed down', hits: ['life', 'food'] });
    news('⚡ Blackout! Life support and the greenhouse have slowed right down.');
  }
  if (pf(S) < 1) tip('lowpower', '⚡ Power is under 25%, so life support and the greenhouse slow down! Boost the Solar Farm or save power.');
  const dn = S.t / DAY, dl = isDay(S.t);
  if (dl != S.dl) { S.dl = dl; SFX[dl ? 'dawn' : 'dusk'](); news(dl ? '☀️ Sunrise! Solar panels make power again.' : '🌙 Night! Solar panels are off, so power is falling.'); if (!dl) tip('night', '🌙 Night on Mars: solar panels make no power until sunrise.'); }
  if ((dn | 0) != S.dy) { S.dy = dn | 0; save(); tip('sol', 'A new sol! A sol is one day on Mars: 24 hours and 39 minutes.'); }
  const bad = lost(S);
  if (bad) return end(bad);
  if (dn >= SOLS) return end();
  if (S.wait) {
    if (S.t >= S.wait.due) {
      S.log.push({ sol: sol(), txt: `📡 Waited for Mission Control about "${S.cur.t}"`, f: Object.fromEntries(Object.entries(S.wait.paid).map(([k, v]) => [k, Math.round(v)])) });
      S.wait = null; SFX.good(); showEv(S.cur, 1);
    }
    return;
  }
  let e = null;
  const i = S.q.findIndex(x => x.due <= S.t);
  if (i >= 0) e = S.q.splice(i, 1)[0].e;
  else if ((e = EV.find(x => x.d && dn + 1 >= x.d && !S.dn[x.d]))) S.dn[e.d] = 1;
  else if (S.t >= S.nx) {
    S.nx = S.t + 14 + S.rand() * 10;
    if (S.rand() < STORM_ODDS) { // a real solar storm from NASA DONKI, warned with its real travel time
      const pool = STORMS.filter(x => !S.used.includes(x.id)), from = pool.length ? pool : STORMS, ev = from[S.rand() * from.length | 0], w = travelSols(ev);
      S.used.push(ev.id);
      S.q.push({ due: S.t + w * DAY, e: { storm: ev } }); SFX.alarm();
      news(`⚠️ NASA forecast: a real CME from ${dstr(ev.date)} reaches Mars in ${w} sol${w > 1 ? 's' : ''}!`);
      tip('forecast', 'NASA spotted a solar storm coming. Upgrade the Shelter or save power before it hits!');
    } else {
      const p = EV.filter(x => !x.d && x.t != S.last && !S.q.some(y => y.e == x));
      e = p[S.rand() * p.length | 0]; S.last = e.t;
      if (e.w) { S.q.push({ due: S.t + e.w * DAY, e }); SFX.alarm(); news('⚠️ Forecast: ' + e.t + ' is coming!'); tip('forecast', 'A forecast tells you what is coming, so you can get ready first.'); e = null; }
    }
  }
  if (e) showEv(e);
}

function showEv(e, advised) {
  if (e.big) e = { ...stormEvent(BIG, S, true), t: 'Sol 60: The BIG Solar Storm' };
  else if (e.storm && !e.c) e = stormEvent(e.storm, S);
  S.pause = 1; S.cur = e; SFX.alarm();
  if (!advised) shake();
  let o = [...e.c], best = -1;
  if (advised) { best = advice(S, o); o[best] = ['⭐ ' + o[best][0], 'Mission Control: "Do this one. We found a smarter way, so it costs half as much."', halve(o[best][2])]; }
  if (o.length < 3) { // always offer a 'spend parts' option that halves the worst choice's losses
    const b = o.reduce((a, c) => loss(a[2]) < loss(c[2]) ? a : c), h = { ...halve(b[2]), p: -15 };
    o = [...o, ['🔩 Spend 15 parts', 'Spare parts soften the blow of the hardest choice.', h]];
  }
  S.opts = o;
  const ev = e.storm, lm = lightMin(S.t);
  ov(`<div class="ov"><div class="c" role="dialog" aria-modal="true" aria-labelledby="et"><h2 id="et">${e.i} ${e.t}</h2><p>${gloss(e.s)}</p>
  ${ev ? `<p class="real">📅 Real event: <b>${dstr(ev.date)}</b> · CME ${ev.speed.toLocaleString('en')} km/s${ev.flare ? ` · ${ev.flare} flare` : ev.flareLinked ? ' · with a solar flare' : ''}${ev.sep ? ' · radiation burst' : ''}${ev.kp ? ` · Earth aurora storm Kp ${ev.kp}` : ''} · storm strength ${Math.round(e.k * 100)}%<br><small>Source: ${ev.link ? link(ev.link, 'NASA DONKI') : 'NASA DONKI'} · <b>${ev.label}</b></small></p>` : ''}
  ${advised ? '<p class="mc">📡 Mission Control answered! Their pick is marked ⭐ and shows its cost.</p>' : ''}
  <div class="g">${o.map((c, j) => `<button ${c[2].p < 0 && S.p < -c[2].p ? 'disabled' : ''} data-a="pick" data-i="${j}"><b>${c[0]}</b><br><small>${c[1]}${j == best ? ` <b>${fxs(c[2])}</b>` : ''}</small></button>`).join('')}
  ${advised ? '' : `<button class="alt mcb" data-a="ask"><b>📡 Ask Mission Control first</b><br><small>Earth is ${lm.toFixed(0)} light-minutes away, so the answer takes ${(2 * lm).toFixed(0)} minutes (${commDelay(S.t).toFixed(0)} s in the game). The problem keeps costing you while you wait.</small></button>`}</div></div></div>`);
  q('ov').querySelector('.g button:not([disabled])')?.focus();
}
function ask() {
  S.wait = { due: S.t + commDelay(S.t), paid: {} }; ov(''); S.pause = 0; SFX.click();
  news(`Question sent! Radio takes ${lightMin(S.t).toFixed(0)} minutes to reach Earth and the same to come back. The problem keeps costing you while you wait…`);
}
function pick(j) {
  const e = S.cur, c = S.opts[j];
  apply(S, c[2]);
  if (!S.f.some(x => x.f == e.f)) S.f.push({ f: e.f, u: e.u });
  if (e.storm) { S.fl = .4 + e.k; shake(); }
  if (e.dust) S.dust = DAY * 3;
  S.log.push({ sol: sol(), txt: `${e.i} ${e.t} → ${c[0]}`, f: c[2] });
  loss(c[2]) < -12 ? SFX.bad() : SFX.good();
  ov(`<div class="ov"><div class="c" role="dialog" aria-modal="true" aria-labelledby="rt"><h2 id="rt">${e.i} ${esc(c[0])}</h2><p>Result: <b>${fxs(c[2]) || 'nothing changed'}</b></p><p>🌟 <b>Space Fact!</b> ${gloss(e.f)} <small>${link(e.u, 'source')}</small></p><button data-a="go">Continue ▶</button></div></div>`);
  q('ov').querySelector('[data-a=go]').focus();
}
function go() { ov(''); S.pause = 0; SFX.click(); }

// Mission over: the crew packs up and flies home (an emergency lift-off if the mission failed), then the debrief.
function end(k) {
  S.over = 1; S.on = 0; S.wait = null; ov('');
  if (!k) put('mo3', []);
  const d = sol();
  const lines = k ? [[0, `⚠️ Sol ${d}: ${LOSE[k][0]}`, 'lose'], [2.4, '📡 Mission Control: "Bring everyone home. Grab only what matters!"'], [5.2, '💡 The base powers down…']]
    : [[0, `📅 Sol ${SOLS}. You did it, Commander!`, 'win'], [2.4, '🧳 The crew packs the rock samples, the science… and one lucky plant.'], [5.2, '💡 Powering down the base for the next crew.']];
  lines.push([7.2, '🚀 Boarding the Mars Ascent Vehicle.'], [8.5, '3…', 'beep'], [9.2, '2…', 'beep'], [9.9, '1…', 'beep'], [10.6, k ? '🔥 Emergency lift-off!' : '🔥 LIFT-OFF!', 'go'], [10.7, '', 'rumble'],
    [13.4, k ? '🌍 The crew is safe and heading home. Nobody was hurt.' : '🌍 Next stop: Earth. Welcome home, Commander!', k ? '' : 'win']);
  $(`<div class="cine"><p id="cap" aria-live="polite"></p><button class="alt" data-a="skipCine">Skip ▶</button></div>`);
  world.depart(lines, (t, sfx) => { if (t) { const c = q('cap'); if (c) { c.textContent = t; c.style.animation = 'none'; c.offsetWidth; c.style.animation = ''; } } if (sfx) SFX[sfx](); }, () => debrief(k));
}
function debrief(k) {
  const w = !k, d = sol(), sc = score(S);
  // Cause and effect: the choices that hit the meter that ran out (or the costliest ones on a win)
  const hits = S.log.filter(x => k ? x.hits?.includes(k) || isCost(k, x.f?.[k] || 0) : loss(x.f || {}) <= -8).slice(-6);
  const chain = hits.map(x => { const ef = x.f ? fxs(k ? { [k]: x.f[k] || 0 } : x.f) : ''; return `<li>Sol ${x.sol}: ${esc(x.txt)}${ef ? ` → <b>${ef}</b>` : ''}</li>`; }).join('');
  $(`<div class="center"><div class="c end"><h1>${w ? '🎉 Mission Complete!' : '🛰️ Mission Ended'}</h1>
  <p>${w ? `You kept the crew alive for ${SOLS} sols. Great commanding!` : gloss(`Sol ${d}: ${LOSE[k][0]}`)}</p>
  ${sc ? `<p class="score">🏆 Score: 🫁 ${sc.life} + ⚡ ${sc.power} + 🥬 ${sc.food} + ☢️ ${sc.rad} budget left = ${sc.life + sc.power + sc.food + sc.rad}${S.hard ? ' × 1.5 (Hard)' : ''} = <b>${sc.total}</b></p>` : ''}
  <p>🔬 Science earned: <b>${S.sci | 0}</b> · ☢️ Radiation dose: <b>${S.r.dose | 0}</b> of ${BUDGET} mSv</p>
  ${chain ? `<h3>${w ? 'Your biggest choices' : 'How it happened'}</h3><ol class="chain">${chain}</ol>` : ''}
  ${k ? `<p>${chain ? '…and all along' : 'No single choice did it'}: ${gloss(WHY[k])}</p><p>🔧 <b>What a real engineer would do:</b> ${gloss(LOSE[k][1])}</p><p>Nobody was hurt. Now you know what to try next time!</p>` : ''}
  <div class="c2" id="ent"><h3>🏆 Add to the leaderboard</h3><p><small>${sc ? 'Your score goes on the board.' : `Ended early: you go on the "sols survived" list (${d} sol${d > 1 ? "s" : ""}).`} Use a crew call-sign, not your real name.</small></p>
  <div class="row"><input id="cs" maxlength="3" placeholder="ABC" aria-label="Call-sign, 3 letters"><button class="alt" data-a="gen">🎲 Make one</button><button data-a="submitScore">Save</button></div></div>
  <h3>Space Facts you found</h3><ul>${S.f.map(x => `<li>${gloss(x.f)} <small>${link(x.u, 'source')}</small></li>`).join('') || '<li>None yet. Try again!</li>'}</ul>
  <p>Mission code: <b class="code">${S.code}</b> <small>(a friend can type it in to fly the same mission)</small></p>
  <div class="g"><button data-a="title">🚀 Play again</button>${w ? '' : '<button class="alt" data-a="cont">↩️ Retry from a few sols earlier</button>'}<button class="alt" data-a="quiz">🧠 Do you remember? (+⭐)</button>
  <div class="row wrap"><button class="alt" data-a="board">🏆 Leaderboard</button><button class="alt" data-a="book">📖 Space Book</button><button class="alt" data-a="credits">🛰️ NASA data</button><button class="alt" data-a="print">🖨️ Print</button></div></div></div></div>`);
}

// ---------- leaderboard (global board via /api/leaderboard; falls back to this device) ----------
const loadBoard = () => get('mo-board', []);
const saveScore = row => put('mo-board', [...loadBoard(), row].slice(-200));
const ADJ = ['Rover', 'Comet', 'Dusty', 'Rocket', 'Crater', 'Orbit', 'Nova', 'Lunar'], ANI = ['Fox', 'Owl', 'Lynx', 'Otter', 'Hawk', 'Panda', 'Gecko', 'Wolf'];
function gen() { S.gen = ADJ[Math.random() * 8 | 0] + ' ' + ANI[Math.random() * 8 | 0]; q('cs').value = S.gen; }
async function submitScore() {
  const v = q('cs').value.trim(), name = v == S.gen ? v : v.toUpperCase();
  if (name != S.gen && !/^[A-Z]{3}$/.test(name)) return alert('Use 3 letters (like ZAP) or tap 🎲 for a crew name.');
  const id = Date.now(), sc = score(S);
  const row = { id, name, hard: S.hard, won: !!sc, total: sc ? sc.total : 0, sci: S.sci | 0, sols: sol(), code: S.code, date: new Date().toISOString().slice(0, 10) };
  saveScore(row);
  let online = false;
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) });
    online = r.ok;
  } catch {}
  q('ent').innerHTML = online ? '<p>✅ Saved! Your mission is on the 🌍 worldwide board.</p>'
    : '<p>✅ Saved to this device (🌍 worldwide board unreachable — offline?).</p>';
  board(id);
}
async function fetchGlobal() {
  try {
    const r = await fetch('/api/leaderboard');
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.global ? j : null;
  } catch { return null; }
}
async function board(hl) {
  const g = await fetchGlobal();
  const b = g || { easy: null, hard: null, early: null };
  const local = loadBoard();
  const pick = rows => rows || local; // fall back to this device when the board is unreachable
  const tbl = (rows, h) => rows.length ? `<table><tr><th>#</th><th>Crew</th><th>${h}</th><th>🔬</th><th>Code</th></tr>${rows.map((r, i) => `<tr class="${r.id == hl ? 'hl' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td><b>${r.won ? r.total : r.sols}</b></td><td>${r.sci}</td><td class="code">${esc(r.code)}</td></tr>`).join('')}</table>` : '<p><small>No missions yet. Be the first!</small></p>';
  const won = m => pick(b[m]).filter(r => r.won && !!r.hard == m).sort((x, y) => y.total - x.total || y.sci - x.sci).slice(0, 10);
  const early = pick(b.early).filter(r => !r.won).sort((x, y) => y.sols - x.sols || y.sci - x.sci).slice(0, 10);
  ov(`<div class="ov"><div class="c wide" role="dialog" aria-modal="true" aria-labelledby="lb"><h2 id="lb">🏆 Leaderboard <small>${g ? '🌍 worldwide' : '💾 this device (offline)'}</small></h2>
  <p><small>Score = what is left after ${SOLS} sols: 🫁 + ⚡ + 🥬 + ☢️ budget left (up to 400), × 1.5 on Hard. 🔬 science breaks ties. Type a code on the title screen to fly the same mission.${g ? ' Showing every player\'s best missions.' : ' Could not reach the worldwide board, showing this device only.'}</small></p>
  <h3>🟢 Easy</h3>${tbl(won(false), 'Score')}<h3>🔴 Hard</h3>${tbl(won(true), 'Score')}<h3>🛰️ Missions that ended early</h3>${tbl(early, 'Sols')}
  <button data-a="closeOv">✖ Close</button></div></div>`);
  q('ov').querySelector('[data-a=closeOv]').focus();
}

// ---------- NASA data credits ----------
const USES = {
  surfaceDose: 'Radiation the crew gets every sol', cruiseDose: 'Radiation the crew got on the flight', cruiseDays: `Flight length, so the trip dose is ${TRIP} mSv`,
  careerLimit: `Your radiation budget: ${MARS.careerLimit.value} − ${TRIP} = ${BUDGET} mSv`, solHours: 'One game sol stands for one real Mars day', sunlight: 'Why solar panels and plants get less energy',
  lightMin: 'How long Mission Control takes to answer', avgTemp: 'The cold-night fact', storm2017: 'The solar storm fact', site: 'Where your base is',
};
function credits() {
  const ev = STORMS, live = ev.some(e => e.live);
  ov(`<div class="ov"><div class="c wide" role="dialog" aria-modal="true" aria-labelledby="cr"><h2 id="cr">🛰️ NASA data in this game</h2>
  <h3>Solar storms: NASA DONKI</h3><p>${gloss('Every solar storm is a real CME from NASA\'s DONKI database. Its real speed sets how strong the storm is, its real travel time to Mars sets the warning time, and its real date is shown in the event.')}</p>
  <ul>${ev.map(e => `<li><b>${dstr(e.date)}</b>: ${e.speed.toLocaleString('en')} km/s${e.sep ? ', radiation burst' : ''}${e.window ? ` <small>(${esc(e.window)})</small>` : ''} — <em>${e.label}</em></li>`).join('')}</ul>
  <p><small>${live ? '✅ Live NASA data loaded from the last 30 days.' : 'Live NASA data not loaded (offline or rate-limited), so only archived data is used.'}${ARCHIVE.partial ? ' ⚠️ ' + esc(ARCHIVE.partial) : ''} ${link('https://api.nasa.gov/', 'api.nasa.gov')} · ${link('https://ccmc.gsfc.nasa.gov/tools/DONKI/', 'DONKI')}</small></p>
  <h3>Mars numbers</h3><table><tr><th>Fact</th><th>Used for</th><th>Source</th></tr>${Object.entries(MARS).map(([k, m]) => `<tr><td>${Array.isArray(m.value) ? m.value.join('–') : m.value} ${m.unit}</td><td>${USES[k]}</td><td>${link(m.url, m.source)}</td></tr>`).join('')}</table>
  <p><small>Game simplifications: time is sped up (1 sol = ${DAY} s), the 26-month Earth–Mars distance cycle is squeezed into one mission, and storm doses are made bigger than real so storms matter in a short game. Details in docs/DATA.md.</small></p>
  <button data-a="closeOv">✖ Close</button></div></div>`);
  q('ov').querySelector('[data-a=closeOv]').focus();
}

// ---------- end-screen quick check (stars only, never affects the mission) ----------
const shuffle = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
function quiz() {
  const met = shuffle(GLOSSARY.filter(g => MET.has(g.id)));
  if (met.length < 3) return alert('Find at least 3 Space Book words first!');
  QZ = { list: met.slice(0, 3), n: 0, ok: 0 }; nextQ();
}
function nextQ() {
  const g = QZ.list[QZ.n];
  QZ.opts = shuffle([g, ...shuffle(GLOSSARY.filter(x => x.id != g.id)).slice(0, 2)]);
  ov(`<div class="ov"><div class="c" role="dialog" aria-modal="true" aria-labelledby="qz"><h2 id="qz">🧠 Do you remember? (${QZ.n + 1}/3)</h2><p class="big">“${g.short.replace(new RegExp(g.m, 'g'), '____')}”</p><p>Which word is it?</p>
  <div class="g">${QZ.opts.map((o, j) => `<button class="alt" data-a="qa" data-i="${j}">${o.icon} ${o.word}</button>`).join('')}</div><p><small>No penalty: a right answer adds a ⭐.</small></p></div></div>`);
  q('ov').querySelector('button').focus();
}
function qa(j) {
  const g = QZ.list[QZ.n], ok = QZ.opts[j].id == g.id;
  if (ok) { QZ.ok++; STARS++; put('mo-stars', STARS); SFX.good(); } else SFX.bad();
  QZ.n++;
  ov(`<div class="ov"><div class="c" role="dialog" aria-modal="true"><h2>${ok ? '⭐ Correct!' : '🙂 Nice try!'}</h2><p>${g.icon} <b>${g.word}</b>: ${g.short}</p>
  <button data-a="${QZ.n < 3 ? 'nextQ' : 'closeOv'}">${QZ.n < 3 ? 'Next ▶' : `Done! ⭐ ${QZ.ok}/3`}</button></div></div>`);
  q('ov').querySelector('button').focus();
}

// ---------- HUD refresh (10×/s) ----------
function paint() {
  const d = sol(), ph = (S.t % DAY) / DAY, rt = rates(S), P = pf(S);
  q('dy').textContent = `📅 Sol ${d}/${SOLS} ${ph < .6 ? '☀️' : '🌙'}`;
  q('cf').style.width = ph * 100 + '%';
  q('lm').textContent = `📡 Earth: ${lightMin(S.t).toFixed(0)} light-min`;
  q('pt').textContent = '🔩 ' + (S.p | 0);
  q('sc').textContent = '🔬 ' + (S.sci | 0);
  q('hd').textContent = S.hold ? '▶' : '⏸';
  q('sp').textContent = '⏩ ×' + S.sp;
  q('mu').textContent = MU ? '🔇' : '🔊';
  R.forEach(([k, i, n]) => {
    const h = health(S.r, k), e = q('m' + k);
    e.className = 'm ' + (h < 25 ? 'x' : h < 50 ? 'w' : '');
    e.firstChild.textContent = k == 'dose' ? `${i} Radiation ${S.r.dose | 0}/${BUDGET}${S.hide > 0 ? ' 🛡️' : ''}` : `${i} ${n} ${h | 0} ${h < 25 ? '✖ ' : h < 50 ? '⚠ ' : ''}${rt[k] > 0 ? '▲' : '▼'}`;
    e.lastChild.firstChild.style.width = (k == 'dose' ? 100 - h : h) + '%';
  });
  const [ct, ci, cb] = coach(), nx = q('nx'), html = (el, h) => el._h !== h && (el.innerHTML = el._h = h); // only touch the DOM on change, so clicks are not lost
  html(nx, '🧭 <b>Next step:</b> ' + ct);
  if (ci != paint.ci && (paint.ci = ci) >= 0) q('r' + ci).scrollIntoView({ block: 'nearest', inline: 'nearest' }); // phones: rooms scroll sideways
  ROOMS.forEach((o, i) => {
    const L = S.L[i], c = upCost(L), h = health(S.r, o[2]), b = q('b' + i), u = q('u' + i), f = o[5];
    q('l' + i).textContent = `${DO[i]} · Lv ${L}/5`;
    q('w' + i).textContent = P < 1 && 'power' in o[4] ? '⚡ low power — slowed' : '';
    b.disabled = S.cd[i] > 0 || (f.p < 0 && S.p < -f.p);
    html(b, S.cd[i] > 0 ? `⏳ Recharging<br><small>${Math.ceil(S.cd[i])} s</small>` : `${i == 3 ? '🛡️ Hide' : '✨ Boost'}<br><small>${fxs(f)}</small>`);
    u.disabled = L > 4 || S.p < c;
    html(u, L > 4 ? '✅ MAX' : `⬆ Upgrade<br><small>${S.p < c ? 'need ' : ''}${c} 🔩</small>`);
    b.classList.toggle('go', ci == i && cb == 'b'); u.classList.toggle('go', ci == i && cb == 'u');
    q('r' + i).className = 'rm' + (h < 15 ? ' d' : h < 35 ? ' k' : '') + (ci == i ? ' go' : '');
  });
  const left = x => Math.ceil((x.due - S.t) / DAY);
  q('fc').textContent = [S.wait && `📡 Waiting for Mission Control… ${Math.ceil(S.wait.due - S.t)} s`,
    ...S.q.map(x => x.e.storm ? `☀️ Solar storm (real ${dstr(x.e.storm.date)}) in ${left(x)} sol(s)` : `⚠️ ${x.e.t} in ${left(x)} sol(s)`)].filter(Boolean).join(' · ') || '☀️ Skies look clear.';
}

// ---------- wiring ----------
const A = {
  start: i => start(i), cont, byCode, spd, mut, hold, boost: i => boost(i), upg, pick, go, ask, title, print: () => print(),
  word, say, closeCard, book, bookWord: id => { BACK = 1; word(id); }, board: () => board(), credits, closeOv: () => ov(''),
  quiz, nextQ, qa, gen, submitScore, skipTips, tipsOn, brief, skipCine: () => world.skip(),
};
document.addEventListener('click', e => {
  if (e.target.classList?.contains('top-ov')) return closeCard(); // tap outside a card closes it
  const b = e.target.closest('[data-a]');
  if (b && !b.disabled) { const v = b.dataset.i; A[b.dataset.a](v === undefined || isNaN(v) ? v : +v); }
});
document.addEventListener('keydown', e => {
  if (e.key == 'Enter' && e.target.id == 'mc') byCode();
  if (e.key == 'Escape') CARD ? closeCard() : (!S || S.over) && ov('');
});
q('app').addEventListener('mouseover', e => { const r = e.target.closest('.rm'); world.highlight(r ? +r.dataset.r : -1); });

const world = createScene(q('world'), { onPick: (i, el) => S && S.hold ? word(ROOMS[i][6]) : boost(i, el) });
if (import.meta.env.DEV) window.mo = { get S() { return S; }, showEv, end, step, EV, STORMS: () => STORMS };

let last = 0, lp = 0, am = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min((ts - last) / 1000, .25);
  last = ts;
  const run = S && S.on && !S.pause && !S.hold && !S.over && !CARD;
  if (run) step(dt * S.sp);
  if (S && S.on && ts - lp > 100) { lp = ts; paint(); showTip(); }
  if (run && ts - am > 3500) { am = ts; tone([262, 294, 330, 392, 440][Math.random() * 5 | 0] * (S.dl ? 1 : .5), 1.6, 'sine', .025); }
  world.update(S, ts);
}
title();
requestAnimationFrame(loop);
