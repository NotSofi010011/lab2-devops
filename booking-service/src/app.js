'use strict';

const http = require('node:http');
const { BookingService, BookingError } = require('./bookingService');

const DEFAULT_LISTINGS = [
  { id: 1, title: 'Апартаменти в центрі Києва', city: 'Київ', pricePerNight: 1500, maxGuests: 4, minNights: 1 },
  { id: 2, title: 'Студія біля Дніпра', city: 'Київ', pricePerNight: 1100, maxGuests: 2, minNights: 2 },
  { id: 3, title: 'Будинок у Карпатах', city: 'Яремче', pricePerNight: 2800, maxGuests: 8, minNights: 3 },
];

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) reject(new BookingError('Запит завеликий', 413));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new BookingError('Некоректний JSON'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function createApp(service = new BookingService(DEFAULT_LISTINGS)) {
  return http.createServer(async (req, res) => {
    try {
      const { pathname, searchParams } = new URL(req.url, 'http://localhost');

      if (req.method === 'GET' && pathname === '/health') {
        return send(res, 200, { status: 'ok' });
      }
      if (req.method === 'GET' && pathname === '/listings') {
        const city = searchParams.get('city');
        const list = service.getListings().filter((l) => !city || l.city === city);
        return send(res, 200, list);
      }
      if (req.method === 'GET' && pathname === '/bookings') {
        return send(res, 200, service.getBookings());
      }
      if (req.method === 'POST' && pathname === '/bookings') {
        const booking = service.createBooking(await readJson(req));
        return send(res, 201, booking);
      }
      const cancel = pathname.match(/^\/bookings\/(\d+)\/cancel$/);
      if (req.method === 'POST' && cancel) {
        return send(res, 200, service.cancelBooking(Number(cancel[1])));
      }
      return send(res, 404, { error: 'Not found' });
    } catch (err) {
      if (err instanceof BookingError) return send(res, err.status, { error: err.message });
      return send(res, 500, { error: 'Internal server error' });
    }
  });
}

module.exports = { createApp, DEFAULT_LISTINGS };
