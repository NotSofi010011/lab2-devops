'use strict';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

class BookingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'BookingError';
    this.status = status;
  }
}

function parseDate(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BookingError(`Поле ${field} має бути датою у форматі YYYY-MM-DD`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BookingError(`Поле ${field} містить некоректну дату`);
  }
  return d;
}

function nightsBetween(checkIn, checkOut) {
  return Math.round((checkOut - checkIn) / MS_PER_DAY);
}

// Діапазони [checkIn, checkOut) перетинаються, якщо початок одного раніше кінця іншого.
function rangesOverlap(aIn, aOut, bIn, bOut) {
  return aIn < bOut && bIn < aOut;
}

class BookingService {
  constructor(listings = []) {
    this.listings = new Map(listings.map((l) => [l.id, { ...l }]));
    this.bookings = [];
    this.nextId = 1;
  }

  getListings() {
    return [...this.listings.values()];
  }

  getBookings() {
    return [...this.bookings];
  }

  isAvailable(listingId, checkIn, checkOut) {
    return !this.bookings.some(
      (b) =>
        b.listingId === listingId &&
        b.status === 'confirmed' &&
        rangesOverlap(checkIn, checkOut, new Date(b.checkIn), new Date(b.checkOut))
    );
  }

  createBooking({ listingId, guestName, checkIn, checkOut, guests = 1 }) {
    const listing = this.listings.get(listingId);
    if (!listing) throw new BookingError('Житло не знайдено', 404);
    if (typeof guestName !== 'string' || guestName.trim() === '') {
      throw new BookingError('Вкажіть ім’я гостя');
    }
    if (!Number.isInteger(guests) || guests < 1) {
      throw new BookingError('Кількість гостей має бути додатним цілим числом');
    }
    if (guests > listing.maxGuests) {
      throw new BookingError(`Максимальна кількість гостей: ${listing.maxGuests}`);
    }

    const inDate = parseDate(checkIn, 'checkIn');
    const outDate = parseDate(checkOut, 'checkOut');
    const nights = nightsBetween(inDate, outDate);
    if (nights < 1) throw new BookingError('Дата виїзду має бути пізніше за дату заїзду');
    if (nights < listing.minNights) {
      throw new BookingError(`Мінімальний термін оренди: ${listing.minNights} дн.`);
    }
    if (!this.isAvailable(listingId, inDate, outDate)) {
      throw new BookingError('Житло недоступне на обрані дати', 409);
    }

    const booking = {
      id: this.nextId++,
      listingId,
      guestName: guestName.trim(),
      guests,
      checkIn,
      checkOut,
      nights,
      totalPrice: nights * listing.pricePerNight,
      status: 'confirmed',
    };
    this.bookings.push(booking);
    return booking;
  }

  cancelBooking(id) {
    const booking = this.bookings.find((b) => b.id === id);
    if (!booking) throw new BookingError('Бронювання не знайдено', 404);
    booking.status = 'cancelled';
    return booking;
  }
}

module.exports = { BookingService, BookingError, nightsBetween, rangesOverlap };
