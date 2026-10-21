'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

async function withServer(fn) {
  const server = createApp();
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const post = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('GET /health повертає ok', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { status: 'ok' });
  }));

test('GET /listings підтримує фільтр за містом', () =>
  withServer(async (base) => {
    const all = await (await fetch(`${base}/listings`)).json();
    const kyiv = await (await fetch(`${base}/listings?city=${encodeURIComponent('Київ')}`)).json();
    assert.strictEqual(all.length, 3);
    assert.strictEqual(kyiv.length, 2);
  }));

test('POST /bookings створює бронювання, повторне на ті ж дати дає 409', () =>
  withServer(async (base) => {
    const body = { listingId: 1, guestName: 'Іван', guests: 2, checkIn: '2026-08-01', checkOut: '2026-08-04' };
    const first = await post(`${base}/bookings`, body);
    assert.strictEqual(first.status, 201);
    assert.strictEqual((await first.json()).totalPrice, 4500);
    const second = await post(`${base}/bookings`, body);
    assert.strictEqual(second.status, 409);
  }));

test('невідомий маршрут дає 404', () =>
  withServer(async (base) => {
    assert.strictEqual((await fetch(`${base}/nope`)).status, 404);
  }));
