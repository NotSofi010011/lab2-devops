'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { BookingService, BookingError, nightsBetween } = require('../src/bookingService');

const listings = [{ id: 1, title: 'Flat', city: 'Київ', pricePerNight: 1000, maxGuests: 2, minNights: 2 }];
const make = () => new BookingService(listings);
const base = { listingId: 1, guestName: 'Олена', guests: 2, checkIn: '2026-07-10', checkOut: '2026-07-13' };

test('nightsBetween рахує кількість ночей', () => {
  assert.strictEqual(nightsBetween(new Date('2026-07-10T00:00:00Z'), new Date('2026-07-13T00:00:00Z')), 3);
});

test('успішне бронювання рахує вартість', () => {
  const b = make().createBooking(base);
  assert.strictEqual(b.nights, 3);
  assert.strictEqual(b.totalPrice, 3000);
  assert.strictEqual(b.status, 'confirmed');
});

test('відхиляє перетин дат (409)', () => {
  const s = make();
  s.createBooking(base);
  assert.throws(
    () => s.createBooking({ ...base, checkIn: '2026-07-12', checkOut: '2026-07-15' }),
    (e) => e instanceof BookingError && e.status === 409
  );
});

test('дозволяє заїзд у день виїзду попереднього гостя', () => {
  const s = make();
  s.createBooking(base);
  const b = s.createBooking({ ...base, checkIn: '2026-07-13', checkOut: '2026-07-16' });
  assert.strictEqual(b.id, 2);
});

test('перевіряє мінімальний термін, гостей і дати', () => {
  const s = make();
  assert.throws(() => s.createBooking({ ...base, checkOut: '2026-07-11' }), /Мінімальний термін/);
  assert.throws(() => s.createBooking({ ...base, guests: 5 }), /Максимальна кількість гостей/);
  assert.throws(() => s.createBooking({ ...base, checkOut: '2026-07-09' }), /пізніше/);
  assert.throws(() => s.createBooking({ ...base, checkIn: '10.07.2026' }), /YYYY-MM-DD/);
});

test('скасоване бронювання звільняє дати', () => {
  const s = make();
  const b = s.createBooking(base);
  s.cancelBooking(b.id);
  assert.doesNotThrow(() => s.createBooking(base));
});

test('неіснуюче житло дає 404', () => {
  assert.throws(() => make().createBooking({ ...base, listingId: 99 }), (e) => e.status === 404);
});
