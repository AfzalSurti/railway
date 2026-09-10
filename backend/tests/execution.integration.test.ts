import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Worker } from 'bullmq';
import { BookingStatus } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { createBookingWorker } from '../src/workers/booking.worker';
import { getBookingQueue, closeBookingQueue } from '../src/queue/queues';
import { bookingJobId } from '../src/queue/queue.types';
import { closeLockClient } from '../src/queue/booking-lock';
import { closeRedisConnections, isRedisHealthy } from '../src/queue/connection';
import { bookingExecutionService } from '../src/services/bookingExecution.service';
import { createPassenger, createScheduledBooking, deleteUserByEmail, registerUser, waitForBookingStatus } from './helpers';
import { BookingExecutionJob } from '../src/queue/queue.types';

const createdEmails: string[] = [];
let worker: Worker<BookingExecutionJob>;

beforeAll(async () => {
  const redisUp = await isRedisHealthy();
  if (!redisUp) {
    throw new Error('Redis is required for Phase 2 tests. Start Redis at redis://localhost:6379');
  }
  worker = createBookingWorker();
  await worker.waitUntilReady();
});

afterAll(async () => {
  await Promise.all(createdEmails.map((email) => deleteUserByEmail(email)));
  if (worker) {
    await worker.close();
  }
  await closeBookingQueue();
  await closeLockClient();
  await closeRedisConnections();
});

describe('Booking execution engine', () => {
  it('creates a delayed BullMQ job when a booking is scheduled', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);
    const delayMs = 5 * 60 * 1000;
    const scheduledAt = new Date(Date.now() + delayMs).toISOString();
    const created = await createScheduledBooking(token, passengerId, scheduledAt);

    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('SCHEDULED');
    expect(created.body.data.queueJobId).toBeUndefined();

    const job = await getBookingQueue().getJob(bookingJobId(created.body.data.id));
    expect(job).toBeTruthy();
    const delay = job?.opts.delay ?? 0;
    expect(delay).toBeGreaterThan(4 * 60 * 1000);
    expect(delay).toBeLessThan(6 * 60 * 1000);
  });

  it('cancels a scheduled booking and removes the delayed job', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);
    const created = await createScheduledBooking(token, passengerId);
    const id = created.body.data.id as string;

    const cancelled = await request(app).post(`/api/bookings/${id}/cancel`).set('Authorization', `Bearer ${token}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(await getBookingQueue().getJob(bookingJobId(id))).toBeFalsy();
  });

  it('reschedules a booking and replaces the delayed job', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);
    const created = await createScheduledBooking(token, passengerId, new Date(Date.now() + 10 * 60 * 1000).toISOString());
    const id = created.body.data.id as string;
    const next = new Date(Date.now() + 20 * 60 * 1000).toISOString();

    const rescheduled = await request(app)
      .put(`/api/bookings/${id}/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scheduledAt: next });

    expect(rescheduled.status).toBe(200);
    expect(rescheduled.body.data.status).toBe('SCHEDULED');
    const job = await getBookingQueue().getJob(bookingJobId(id));
    expect(job?.opts.delay).toBeGreaterThan(15 * 60 * 1000);
  });

  it('queues a booking immediately via run now without executing in the HTTP request', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);
    const created = await createScheduledBooking(token, passengerId);
    const id = created.body.data.id as string;

    const run = await request(app)
      .post(`/api/bookings/${id}/run`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mockOutcome: 'SUCCESS' });

    expect(run.status).toBe(200);
    expect(run.body.data.status).toBe('QUEUED');
    expect(run.body.data.completedAt).toBeNull();

    const completed = await waitForBookingStatus(id, BookingStatus.COMPLETED);
    expect(completed.bookingReference).toMatch(/^MOCK-/);
    const logs = await request(app).get(`/api/bookings/${id}/logs`).set('Authorization', `Bearer ${token}`);
    const steps = (logs.body.data as Array<{ step: string }>).map((log) => log.step);
    expect(steps).toContain('BOOKING_CREATED');
    expect(steps).toContain('BOOKING_QUEUED');
    expect(steps).toContain('BOOKING_STARTED');
    expect(steps).toContain('SEARCHING');
    expect(steps).toContain('BOOKING_COMPLETED');
  });

  it('fails without retry when mock executor returns NO_SEATS', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);
    const created = await createScheduledBooking(token, passengerId);
    const id = created.body.data.id as string;

    await request(app).post(`/api/bookings/${id}/run`).set('Authorization', `Bearer ${token}`).send({ mockOutcome: 'NO_SEATS' });
    const failed = await waitForBookingStatus(id, BookingStatus.FAILED);
    expect(failed.failureCode).toBe('NO_SEATS');
    expect(failed.failureReason).toBe('No seats available');
    const attempts = await prisma.bookingAttempt.findMany({ where: { bookingTaskId: id } });
    expect(attempts).toHaveLength(1);
  });

  it('retries WEBSITE_TIMEOUT then fails after exhaustion', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);
    const created = await createScheduledBooking(token, passengerId);
    const id = created.body.data.id as string;

    await request(app)
      .post(`/api/bookings/${id}/run`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mockOutcome: 'WEBSITE_TIMEOUT' });

    const failed = await waitForBookingStatus(id, BookingStatus.FAILED, 60000);
    expect(failed.failureCode).toBe('WEBSITE_TIMEOUT');
    const attempts = await prisma.bookingAttempt.findMany({ where: { bookingTaskId: id } });
    expect(attempts.length).toBe(3);
    const tasks = await prisma.bookingTask.findMany({ where: { id } });
    expect(tasks).toHaveLength(1);
  });

  it('marks UNKNOWN_RESULT as failed without retry', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);
    const created = await createScheduledBooking(token, passengerId);
    const id = created.body.data.id as string;

    await request(app)
      .post(`/api/bookings/${id}/run`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mockOutcome: 'UNKNOWN_RESULT' });

    const failed = await waitForBookingStatus(id, BookingStatus.FAILED);
    expect(failed.failureCode).toBe('UNKNOWN_RESULT');
    expect(failed.failureReason).toContain('Manual investigation required');
    const attempts = await prisma.bookingAttempt.findMany({ where: { bookingTaskId: id } });
    expect(attempts).toHaveLength(1);
  });

  it('does not execute another user booking', async () => {
    const owner = await registerUser();
    const other = await registerUser();
    createdEmails.push(owner.payload.email, other.payload.email);
    const passengerId = await createPassenger(owner.response.body.data.token);
    const created = await createScheduledBooking(owner.response.body.data.token, passengerId);

    const run = await request(app)
      .post(`/api/bookings/${created.body.data.id}/run`)
      .set('Authorization', `Bearer ${other.response.body.data.token}`)
      .send({ mockOutcome: 'SUCCESS' });
    expect(run.status).toBe(404);
  });

  it('is idempotent for completed bookings', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);
    const created = await createScheduledBooking(token, passengerId);
    const id = created.body.data.id as string;

    await request(app).post(`/api/bookings/${id}/run`).set('Authorization', `Bearer ${token}`).send({ mockOutcome: 'SUCCESS' });
    await waitForBookingStatus(id, BookingStatus.COMPLETED, 90000);

    const job = await getBookingQueue().getJob(bookingJobId(id));
    expect(job).toBeTruthy();
    await bookingExecutionService.execute(job!);
    const attempts = await prisma.bookingAttempt.findMany({ where: { bookingTaskId: id } });
    const successAttempts = attempts.filter((attempt) => attempt.status === 'SUCCESS');
    expect(successAttempts).toHaveLength(1);
  });

  it('pauses on AUTHENTICATION_REQUIRED and can be resumed', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);
    const created = await createScheduledBooking(token, passengerId);
    const id = created.body.data.id as string;

    await request(app)
      .post(`/api/bookings/${id}/run`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mockOutcome: 'AUTHENTICATION_REQUIRED' });

    const paused = await waitForBookingStatus(id, BookingStatus.AUTHENTICATION_REQUIRED);
    expect(paused.actionRequired).toBe(true);
    expect(paused.actionRequiredType).toBe('LOGIN');
    expect(paused.actionRequiredMessage).toContain('authentication');

    await prisma.bookingTask.update({ where: { id }, data: { mockOutcome: 'SUCCESS' } });
    const resumed = await request(app).post(`/api/bookings/${id}/resume`).set('Authorization', `Bearer ${token}`);
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.status).toBe('QUEUED');

    const completed = await waitForBookingStatus(id, BookingStatus.COMPLETED, 60000);
    expect(completed.bookingReference).toMatch(/^MOCK-/);
  });

  it('pauses on PAYMENT_REQUIRED', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);
    const created = await createScheduledBooking(token, passengerId);
    const id = created.body.data.id as string;

    await request(app)
      .post(`/api/bookings/${id}/run`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mockOutcome: 'PAYMENT_REQUIRED' });

    const paused = await waitForBookingStatus(id, BookingStatus.PAYMENT_REQUIRED);
    expect(paused.actionRequired).toBe(true);
    expect(paused.actionRequiredType).toBe('PAYMENT');
  });

  it('does not execute IRCTC skeleton as a real booking', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);
    const created = await createScheduledBooking(token, passengerId, undefined, 'IRCTC');
    const id = created.body.data.id as string;

    await request(app).post(`/api/bookings/${id}/run`).set('Authorization', `Bearer ${token}`).send({ mockOutcome: 'SUCCESS' });
    const failed = await waitForBookingStatus(id, BookingStatus.FAILED);
    expect(failed.failureCode).toBe('PROVIDER_NOT_IMPLEMENTED');
  });

  it('lists providers without exposing browser session details', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const response = await request(app).get('/api/providers').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const names = (response.body.data as Array<{ name: string; available: boolean }>).map((item) => item.name);
    expect(names).toContain('MOCK');
    expect(names).toContain('IRCTC');
    const irctc = await request(app).get('/api/providers/IRCTC').set('Authorization', `Bearer ${token}`);
    expect(irctc.body.data[0].health).toBe('NOT_IMPLEMENTED');
    expect(JSON.stringify(response.body)).not.toMatch(/cookie|authorization|password/i);
  });
});
