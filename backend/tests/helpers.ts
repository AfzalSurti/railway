import { BookingStatus } from '@prisma/client';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { bookingScheduler } from '../src/scheduler/booking-scheduler';

export async function registerUser(overrides?: {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}) {
  const payload = {
    name: overrides?.name ?? 'Test User',
    email: overrides?.email ?? `test-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
    phone: overrides?.phone ?? '9999999999',
    password: overrides?.password ?? 'password123',
  };

  const response = await request(app).post('/api/auth/register').send(payload);
  return { payload, response };
}

export async function deleteUserByEmail(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { bookingTasks: true },
  });
  if (user) {
    await Promise.all(
      user.bookingTasks.map((booking) => bookingScheduler.cancelScheduledBooking(booking.id).catch(() => undefined)),
    );
  }
  await prisma.user.deleteMany({ where: { email } });
}

export async function deleteUserById(id: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { bookingTasks: true },
  });
  if (user) {
    await Promise.all(
      user.bookingTasks.map((booking) => bookingScheduler.cancelScheduledBooking(booking.id).catch(() => undefined)),
    );
  }
  await prisma.user.deleteMany({ where: { id } });
}

export async function createPassenger(token: string, name = 'Rahul Jani') {
  const response = await request(app).post('/api/passengers').set('Authorization', `Bearer ${token}`).send({
    name,
    age: 30,
    gender: 'MALE',
    phone: '9876543210',
  });
  return response.body.data.id as string;
}

export async function createScheduledBooking(
  token: string,
  passengerId: string,
  scheduledAt?: string,
  provider = 'MOCK',
) {
  const when = scheduledAt ?? new Date(Date.now() + 5 * 60 * 1000).toISOString();
  return request(app).post('/api/bookings').set('Authorization', `Bearer ${token}`).send({
    serviceType: 'TRAIN',
    provider,
    source: 'BRC',
    destination: 'MMCT',
    journeyDate: '2026-08-28',
    scheduledAt: when,
    trainNumber: '20902',
    travelClass: '3A',
    quota: 'GENERAL',
    passengerIds: [passengerId],
  });
}

export async function waitForBookingStatus(id: string, status: BookingStatus, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const booking = await prisma.bookingTask.findUnique({ where: { id } });
    if (booking?.status === status) {
      return booking;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const latest = await prisma.bookingTask.findUnique({ where: { id } });
  throw new Error(`Timed out waiting for ${status}. Current status: ${latest?.status ?? 'missing'}`);
}
