import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAY, SOLS, BUDGET, EV, rates, tick, apply, enc, dec, stormStrength, stormEvent, trimCME, travelSols, score, advice, isCost, lost } from '../src/game.js';
import { GLOSSARY } from '../src/data/glossary.js';

const donki = JSON.parse(readFileSync(new URL('../src/data/donki.json', import.meta.url)));
const base = () => ({ t: 0, hard: false, dust: 0, hide: 0, sci: 0, p: 20, L: [1, 1, 1, 1], r: { life: 70, power: 70, food: 70, dose: 0 } });

test('mission code round-trips seed, sol, mode and room levels', () => {
  const s = { ...base(), seed: 9876, t: 57 * DAY + 3, hard: true, L: [5, 1, 3, 2] };
  const d = dec(enc(s));
  assert.deepEqual([d.seed, d.t, d.hard, d.L], [9876, 57 * DAY, 1, s.L]);
  assert.equal(enc({ ...s, seed: 9999, t: SOLS * DAY, L: [5, 5, 5, 5] }).length, 6);
  assert.equal(dec('!!!'), null);
});

test('solar makes power by day, none at night, less in dust', () => {
  const day = rates(base()).power, night = rates({ ...base(), t: DAY * .8 }).power, dusty = rates({ ...base(), dust: 5 }).power;
  assert.ok(day > 0 && night < 0 && dusty < day);
});

test('low power slows life support (and a blackout starves it)', () => {
  const ok = rates(base()).life, low = rates({ ...base(), r: { ...base().r, power: 10 } }).life, out = rates({ ...base(), r: { ...base().r, power: 0 } }).life;
  assert.ok(ok > low && low > out && out < 0);
});

test('radiation dose never goes down', () => {
  for (let i = 0; i < 200; i++) {
    const s = { ...base(), t: Math.random() * 100 * DAY, hide: Math.random() < .5 ? 3 : 0, L: [1, 1, 1, 1 + (i % 5)], r: { life: 50, power: Math.random() * 100, food: 50, dose: Math.random() * BUDGET } };
    const d0 = s.r.dose;
    tick(s, Math.random());
    apply(s, { dose: -50 });
    assert.ok(s.r.dose >= d0);
  }
  const a = base(), b = { ...base(), L: [1, 1, 1, 5] }, c = { ...base(), hide: 5 };
  assert.ok(rates(a).dose > rates(b).dose && rates(a).dose > rates(c).dose, 'shelter level and hiding cut the dose rate');
});

test('storm strength rises with real CME speed', () => {
  let prev = -1;
  for (let v = 300; v <= 3500; v += 100) { const k = stormStrength({ speed: v }); assert.ok(k >= prev && k >= 0 && k <= 1); prev = k; }
  assert.ok(stormStrength({ speed: 1500, sep: true }) > stormStrength({ speed: 1500 }));
});

test('every choice gives something up (no free choices)', () => {
  const events = [...EV.filter(e => e.c), ...donki.events.map(ev => stormEvent(ev, base())), ...donki.events.map(ev => stormEvent(ev, base(), true))];
  for (const e of events) for (const [label, , f] of e.c) assert.ok(Object.entries(f).some(([k, v]) => isCost(k, v)), `${e.t}: "${label}" has no cost`);
});

test('score: more left over → higher; failed or unfinished → no score', () => {
  const done = r => ({ ...base(), t: SOLS * DAY, r });
  const a = score(done({ life: 80, power: 80, food: 80, dose: 50 })), b = score(done({ life: 40, power: 40, food: 40, dose: 200 }));
  assert.ok(a.total > b.total);
  assert.equal(score({ ...done({ life: 80, power: 80, food: 80, dose: 50 }), hard: true }).total, Math.round(a.total * 1.5));
  assert.equal(score(done({ life: 0, power: 80, food: 80, dose: 50 })), null);
  assert.equal(score(done({ life: 80, power: 80, food: 80, dose: BUDGET })), null);
  assert.equal(score({ ...base(), t: 50 * DAY }), null);
  assert.equal(lost(done({ life: 80, power: 0, food: 80, dose: 0 })), null, 'power alone no longer ends the mission');
});

test('Mission Control protects the meter that is lowest', () => {
  const opts = [['a', '', { food: -10 }], ['b', '', { life: -10 }]];
  assert.equal(advice({ ...base(), r: { life: 10, power: 70, food: 80, dose: 0 } }, opts), 0);
  assert.equal(advice({ ...base(), r: { life: 80, power: 70, food: 10, dose: 0 } }, opts), 1);
});

test('DONKI records are trimmed to the fields the game uses', () => {
  const raw = { activityID: '2017-09-10T16:09:00-CME-001', startTime: '2017-09-10T16:09Z', activeRegionNum: 12673, note: 'Clear flare, eruption.',
    linkedEvents: [{ activityID: '2017-09-10T15:35:00-FLR-001' }, { activityID: '2017-09-10T16:25:00-SEP-001' }],
    cmeAnalyses: [{ isMostAccurate: true, speed: 2650, halfAngle: 54, enlilList: [{ impactList: [{ location: 'Mars', arrivalTime: '2017-09-13T22:00Z' }] }] }] };
  const e = trimCME(raw);
  assert.deepEqual([e.speed, e.sep, e.flareLinked, e.flare, e.marsArrival], [2650, true, true, null, '2017-09-13T22:00Z']);
  assert.equal(travelSols(e), 3);
  assert.equal(trimCME({ ...raw, cmeAnalyses: [] }), null);
  assert.equal(trimCME({ ...raw, note: 'Seen in LASCO C3 after an X8.2 flare' }).flare, 'X8.2', 'coronagraph name C3 is not a flare class');
});

test('archived NASA data is present and well-formed', () => {
  assert.ok(donki.fetchedAt && donki.events.length > 0);
  for (const e of donki.events) assert.ok(e.id && /^\d{4}-\d\d-\d\d$/.test(e.date) && e.speed > 0, e.id);
});

test('Space Book: every word explained in plain words', () => {
  const ids = new Set(GLOSSARY.map(g => g.id));
  assert.equal(ids.size, GLOSSARY.length);
  // hard words that may only appear in a `short` if they have their own entry
  const JARGON = { radiation: 'radiation', regolith: 'regolith', oxygen: 'oxygen', CME: 'cme', flare: 'flare', sol: 'sol', dose: 'dose', 'solar panel': 'panel', 'life support': 'life', 'Mission Control': 'mc', rover: 'rover', mSv: null, millisievert: null, magnetic: null, atmosphere: null, ejection: null, coronal: null };
  for (const g of GLOSSARY) {
    assert.match(g.short, new RegExp(g.m), `${g.id}: its pattern must find the word in its own sentence (used by the quiz)`);
    assert.ok(g.short.split(/[.!?]/).filter(Boolean).length <= 2 && g.short.length < 110, `${g.id}: short must stay short`);
    for (const [w, id] of Object.entries(JARGON)) if (new RegExp(`\\b${w}`, 'i').test(g.short)) assert.ok(id && ids.has(id), `${g.id}: "${w}" is used but not explained`);
  }
});
