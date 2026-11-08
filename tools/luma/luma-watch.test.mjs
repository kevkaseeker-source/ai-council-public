import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, nearBerlin, pick } from './luma-watch.mjs';

const entry = (name, lat = 52.5, lon = 13.4, start = '2026-11-05T17:00:00Z') => ({ event: { api_id: name, name, start_at: start, url: 'x', coordinate: { latitude: lat, longitude: lon } }, calendar: { name: 'Cal' }, hosts: [] });

test('classify: Anthropic/OpenAI vor Blockchain vor Agenten, ganze Wörter', () => {
  assert.equal(classify(entry('Claude Code Meetup')).tier, 1);
  assert.equal(classify(entry('Solana agents night')).tier, 2);
  assert.equal(classify(entry('Agents in Prod')).tier, 3);
  assert.equal(classify(entry('Management offsite')), null); // "agent" steckt nicht als Wort drin
});

test('nearBerlin: 60 km Radius, sonst Stadtname', () => {
  assert.equal(nearBerlin(entry('a', 52.39, 13.06).event), true);  // Potsdam
  assert.equal(nearBerlin(entry('a', 53.55, 9.99).event), false);  // Hamburg
  assert.equal(nearBerlin({ geo_address_info: { city: 'Berlin' } }), true);
});

test('pick: vergangene, ferne und doppelte Events fallen raus', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  const list = pick([entry('Claude Code Meetup'), entry('Claude Code Meetup'), entry('OpenAI old', 52.5, 13.4, '2026-10-01T17:00:00Z'), entry('Solana Hamburg', 53.55, 9.99)], now);
  assert.deepEqual(list.map(x => x.name), ['Claude Code Meetup']);
});
