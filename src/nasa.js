// Real space weather from NASA DONKI. Archived data ships with the game; a live check is a bonus.
import archive from './data/donki.json';
import { trimCME } from './game.js';

const tag = (e, live) => ({ ...e, live, label: live ? 'Live NASA data' : `Archived NASA data (fetched ${archive.fetchedAt})` });
export const ARCHIVE = archive;
export const archived = archive.events.map(e => tag(e, false));

// Archived set plus up to 3 CMEs from the last 30 days, if NASA answers within 4 s. Cached for an hour (DEMO_KEY is rate-limited).
export async function loadSpaceWeather() {
  try {
    const c = JSON.parse(localStorage.getItem('mo-live') || 'null');
    if (c && Date.now() - c.at < 36e5) return [...c.ev, ...archived];
  } catch { /* storage blocked */ }
  try {
    const iso = d => d.toISOString().slice(0, 10), now = new Date();
    const r = await fetch(`https://api.nasa.gov/DONKI/CME?startDate=${iso(new Date(now - 30 * 864e5))}&endDate=${iso(now)}&api_key=DEMO_KEY`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(r.status);
    const ev = (await r.json()).map(trimCME).filter(e => e && e.speed >= 500).sort((a, b) => b.speed - a.speed).slice(0, 3).map(e => tag(e, true));
    try { localStorage.setItem('mo-live', JSON.stringify({ at: Date.now(), ev })); } catch { /* storage blocked */ }
    return [...ev, ...archived];
  } catch { // offline or rate-limited: don't retry for an hour
    try { localStorage.setItem('mo-live', JSON.stringify({ at: Date.now(), ev: [] })); } catch { /* storage blocked */ }
    return archived;
  }
}
