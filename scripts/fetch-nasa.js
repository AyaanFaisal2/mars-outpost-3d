// Refresh the archived NASA space-weather data: `npm run data` (optional NASA_API_KEY env var).
// Pulls DONKI CMEs (+ geomagnetic storms) for a few real storm windows and writes src/data/donki.json.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { trimCME } from '../src/game.js';

const KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const WINDOWS = [
  ['2012-07-22', '2012-07-24', 'July 2012 extreme CME (missed Earth)'],
  ['2017-09-04', '2017-09-12', 'Sept 2017 storms, measured on Mars by Curiosity RAD'],
  ['2024-05-07', '2024-05-15', 'May 2024 storms from active region 13664'],
  ['2024-10-01', '2024-10-10', 'Oct 2024 storms'],
];
const get = async (type, a, b) => {
  const url = `https://api.nasa.gov/DONKI/${type}?startDate=${a}&endDate=${b}&api_key=${KEY}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`${type} ${a}: HTTP ${r.status}`);
    return r.json();
  } catch (e) { // some machines firewall Node but not curl
    if (e.message.includes('HTTP')) throw e;
    const out = execFileSync('curl', ['-s', '-m', '30', '-w', '\n%{http_code}', url], { encoding: 'utf8' }), i = out.lastIndexOf('\n'), code = out.slice(i + 1);
    if (code != '200') throw new Error(`${type} ${a}: HTTP ${code}`);
    return JSON.parse(out.slice(0, i));
  }
};
const fail = e => {
  console.error(/HTTP 429/.test(e.message)
    ? `\nNASA's rate limit is used up for ${KEY == 'DEMO_KEY' ? 'DEMO_KEY (about 10 requests/hour)' : 'this key'}. Try again later, or get a free key at https://api.nasa.gov and run:\n  NASA_API_KEY=yourkey npm run data\nsrc/data/donki.json was not changed.`
    : `\nCould not fetch NASA data: ${e.message}\nsrc/data/donki.json was not changed.`);
  process.exit(1);
};
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);

const events = [];
for (const [a, b, label] of WINDOWS) {
  const kp = {};
  try { // geomagnetic storms at Earth, keyed by the events they link to
    for (const g of await get('GST', a, b)) {
      const max = Math.max(...(g.allKpIndex || []).map(k => k.kpIndex));
      kp[g.gstID] = max;
      for (const l of g.linkedEvents || []) kp[l.activityID] = Math.max(kp[l.activityID] || 0, max);
    }
  } catch (e) { console.warn('GST skipped:', e.message); }
  const cmes = (await get('CME', a, b)).map(c => ({ ...trimCME(c), kp: kp[c.activityID] ?? null })).filter(c => c.speed >= 500);
  cmes.sort((x, y) => y.speed - x.speed);
  events.push(...cmes.slice(0, 3).map(c => ({ ...c, window: label })));
  console.log(label, '→', cmes.length, 'CMEs ≥ 500 km/s, kept', Math.min(3, cmes.length));
}
const out = { source: 'NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information)', api: 'https://api.nasa.gov/', fetchedAt: new Date().toISOString().slice(0, 10), events };
writeFileSync(new URL('../src/data/donki.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('wrote', events.length, 'events');
