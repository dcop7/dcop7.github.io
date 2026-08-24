/* Answer "should this snapshot be rebuilt?" from the snapshot itself.
 *
 * GitHub delays cron runs by minutes to HOURS, so a gate that tests the hour
 * of day skips whole days without saying so: data/events was gated on "is it
 * 07h in Lisbon?" and silently stopped refreshing on every day the runner
 * started late. Gating on the data's own age has no such failure mode — each
 * cron is a catch-up attempt, the first one to find stale data does the work,
 * and the rest cost ~20 s and no commit.
 *
 * Usage:  node .github/scripts/stale.mjs <json-file> day      once per Lisbon day
 *         node .github/scripts/stale.mjs <json-file> <hours>  older than <hours>
 *
 * Prints "true" (rebuild) or "false" (fresh) and always exits 0. An
 * unreadable or unrecognised snapshot means "rebuild", never "fail the run":
 * a gate that can break the pipeline defeats its own purpose. FORCE=true
 * (set for manual dispatches) short-circuits to "true".
 *
 * Node rather than jq + `date -d`: node is already a hard requirement of
 * every build, so this adds no assumption about the runner image, and it
 * runs unchanged on the author's Windows machine.
 */
import { readFileSync } from 'node:fs';

const [file, mode] = process.argv.slice(2);
const say = v => { process.stdout.write(v ? 'true\n' : 'false\n'); process.exit(0); };

if (!file || !mode) { console.error('usage: stale.mjs <json-file> day|<hours>'); say(true); }
if (process.env.FORCE === 'true') say(true);

let stamp;
try {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  /* The builds stamp their output under four different keys; accept them all
     rather than teaching every caller which one its file happens to use. */
  stamp = doc.generated ?? doc.generatedAt ?? doc.updated ?? doc.date;
} catch { say(true); }
if (typeof stamp !== 'string' || !stamp) say(true);

/* Date-only stamps ("2026-08-23") are read as that Lisbon day, not as UTC
   midnight: they record the day the snapshot was built for. */
const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(stamp);
const lisbonDay = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(d);

if (mode === 'day') {
  const have = dayOnly ? stamp : (Number.isNaN(Date.parse(stamp)) ? null : lisbonDay(new Date(stamp)));
  say(have !== lisbonDay(new Date()));
}

const hours = Number(mode);
if (!Number.isFinite(hours) || hours <= 0) { console.error(`bad mode: ${mode}`); say(true); }
const t = dayOnly ? Date.parse(stamp + 'T00:00:00Z') : Date.parse(stamp);
if (Number.isNaN(t)) say(true);
say(Date.now() - t >= hours * 3600e3);
