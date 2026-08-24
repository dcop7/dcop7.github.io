/* Pacing against Groq's 8 000 TPM free tier.

   This is the logic that once turned a 21-request run into 21 minutes of
   waiting and got the job killed at its 30-minute limit with nothing
   published. It has no visible output — a wrong answer here looks like a
   slow run, not like a bug — so it is pinned down here instead. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, noteHeaders, serverWaitMs, retryHintS, errMessage } from './build-curated.mjs';

/* Minimal stand-in for a fetch Response: serverWaitMs only ever reads
   headers, and only through get(). */
const reply = (h) => ({ headers: { get: (k) => (k in h ? String(h[k]) : null) } });

const TPM = 8000;
const seconds = (ms) => ms / 1000;

test('a bucket with room for the request does not wait at all', () => {
  noteHeaders(reply({ 'x-ratelimit-limit-tokens': TPM, 'x-ratelimit-remaining-tokens': 7900, 'x-ratelimit-reset-tokens': '1s' }));
  assert.equal(serverWaitMs(5000), 0);
});

test('the old bug: remaining below one worst-case request is NOT a reason to wait', () => {
  /* 7 600 = MAX_INPUT_TOK + MAX_OUTPUT_TOK. The previous version slept a
     whole window whenever remaining fell under it — true after the first
     call of any size, so it slept after every single call. */
  noteHeaders(reply({ 'x-ratelimit-limit-tokens': TPM, 'x-ratelimit-remaining-tokens': 7000, 'x-ratelimit-reset-tokens': '8s' }));
  assert.equal(serverWaitMs(3400), 0, 'a 3 400-token request fits in 7 000 remaining');
});

test('a shortfall waits for the shortfall, not for the advertised reset', () => {
  /* The exact numbers from the run that failed: 3 015 left, reset in 38s.
     A 5 000-token request is 1 985 short, and the bucket refills at
     8 000/60 ≈ 133 tok/s, so ~15s — not 38s. Over ~21 requests that
     difference is the whole job timeout. */
  noteHeaders(reply({ 'x-ratelimit-limit-tokens': TPM, 'x-ratelimit-remaining-tokens': 3015, 'x-ratelimit-reset-tokens': '38s' }));
  const w = seconds(serverWaitMs(5000));
  assert.ok(w > 12 && w < 18, `expected ~15s, got ${w}s`);
});

test('the wait never exceeds the reset the server advertised', () => {
  noteHeaders(reply({ 'x-ratelimit-limit-tokens': TPM, 'x-ratelimit-remaining-tokens': 100, 'x-ratelimit-reset-tokens': '2s' }));
  assert.ok(seconds(serverWaitMs(7000)) <= 2.5);
});

test('the limit is taken from the server, not assumed', () => {
  /* A paid tier would refill ten times faster; hard-coding 8 000 would
     make every wait ten times too long. */
  noteHeaders(reply({ 'x-ratelimit-limit-tokens': 80000, 'x-ratelimit-remaining-tokens': 3000, 'x-ratelimit-reset-tokens': '60s' }));
  assert.ok(seconds(serverWaitMs(5000)) < 3);
});

test('a reply without rate headers leaves pacing to our own estimate', () => {
  noteHeaders(reply({ 'x-ratelimit-limit-tokens': TPM, 'x-ratelimit-remaining-tokens': 50, 'x-ratelimit-reset-tokens': '60s' }));
  assert.ok(serverWaitMs(5000) > 0, 'sanity: this state does wait');
  noteHeaders(reply({}));   /* headers absent → previous reading stands */
  assert.ok(serverWaitMs(5000) > 0, 'a header-less reply must not be read as "bucket full"');
});

test('Go durations are summed, not parseFloat-ed', () => {
  assert.equal(parseDuration('7.66s', 10), 8);
  assert.equal(parseDuration('2m59.56s', 10), 120, 'clamped at 120s, not read as 2s');
  assert.equal(parseDuration('500ms', 10), 1);
  assert.equal(parseDuration('', 10), 10, 'falls back rather than resuming immediately');
  assert.equal(parseDuration('nonsense', 10), 10);
});

/* ── refusals ───────────────────────────────────────────────────────
   The run of 2026-08-24 made 25 requests and had 24 refused, spending
   55 minutes on it: the 429 body says which limit was hit and when it
   clears, and the old code read neither. These pin down that it now
   tells a per-minute hiccup (wait it out) apart from a wall (stop). */

test('the reason for a refusal is read out of the body, not discarded', () => {
  const body = JSON.stringify({ error: { message: 'Rate limit reached for model `openai/gpt-oss-120b` in organization `org_x` on tokens per day (TPD): Limit 200000, Used 199481. Please try again in 3h51m20.5s.', type: 'tokens' } });
  const msg = errMessage(body);
  assert.match(msg, /tokens per day \(TPD\)/);
  assert.ok(/per day|\bTPD\b/i.test(msg), 'a daily wall must be recognisable from the message alone');
});

test('a plain-text body (proxy, gateway) stays readable', () => {
  assert.equal(errMessage('502 Bad Gateway'), '502 Bad Gateway');
  assert.equal(errMessage(''), '');
});

test('the wait is recovered from the sentence when there is no retry-after', () => {
  /* Hours are allowed here, unlike the header parser: a daily cap can be
     most of a day away, and clamping that to 120s is what would make the
     run retry into a wall. */
  assert.equal(retryHintS('Please try again in 3h51m20.5s.'), 3 * 3600 + 51 * 60 + 21);
  assert.equal(retryHintS('Please try again in 7.66s'), 8);
  assert.equal(retryHintS('no hint here'), 0);
});

test('a per-minute hiccup is worth waiting out, a wall is not', () => {
  /* MAX_429_WAIT_S is 120: the rule the retry loop applies. */
  assert.ok(retryHintS('try again in 12s') <= 120, 'TPM refusals clear in seconds');
  assert.ok(retryHintS('try again in 3h51m20.5s') > 120, 'TPD refusals do not clear inside a run');
});
