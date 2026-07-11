import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEvent, Roster, DEFAULT_COLOR } from '../src/room.js';

const base = { callsign: 'octocat', stage: 'build', status: 'passed', color: '#22d3ee' };

test('sanitizeEvent accepts a well-formed event', () => {
  assert.deepEqual(sanitizeEvent(base), base);
});

test('sanitizeEvent trims + caps callsign, rejects empty', () => {
  assert.equal(sanitizeEvent({ ...base, callsign: '  octocat  ' }).callsign, 'octocat');
  assert.equal(sanitizeEvent({ ...base, callsign: 'x'.repeat(60) }).callsign.length, 39);
  assert.equal(sanitizeEvent({ ...base, callsign: '   ' }), null);
  assert.equal(sanitizeEvent({ ...base, callsign: 123 }), null);
});

test('sanitizeEvent rejects unknown stage/status', () => {
  assert.equal(sanitizeEvent({ ...base, stage: 'orbit' }), null);
  assert.equal(sanitizeEvent({ ...base, status: 'exploded' }), null);
});

test('sanitizeEvent defaults a bad colour, keeps a good one', () => {
  assert.equal(sanitizeEvent({ ...base, color: 'blue' }).color, DEFAULT_COLOR);
  assert.equal(sanitizeEvent({ ...base, color: '#ABCDEF' }).color, '#ABCDEF');
});

test('sanitizeEvent keeps http(s) siteUrl, drops anything else', () => {
  assert.equal(sanitizeEvent({ ...base, siteUrl: 'https://x.io/s' }).siteUrl, 'https://x.io/s');
  assert.equal('siteUrl' in sanitizeEvent({ ...base, siteUrl: 'javascript:alert(1)' }), false);
  assert.equal('siteUrl' in sanitizeEvent({ ...base, siteUrl: 'not a url' }), false);
});

test('sanitizeEvent carries optional version, capped', () => {
  assert.equal(sanitizeEvent({ ...base, version: 'v3' }).version, 'v3');
  assert.equal('version' in sanitizeEvent(base), false);
});

test('Roster upserts latest-wins by callsign', () => {
  const r = new Roster();
  r.upsert(sanitizeEvent({ ...base, stage: 'pad', status: 'running' }));
  r.upsert(sanitizeEvent({ ...base, stage: 'liftoff', status: 'shipped' }));
  assert.equal(r.size, 1);
  assert.equal(r.list()[0].stage, 'liftoff');
});
