import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { deleteUserByEmail, registerUser } from './helpers';

const createdEmails: string[] = [];
const futureScheduledAt = () => new Date(Date.now() + 10 * 60 * 1000).toISOString();

afterAll(async () => {
  await Promise.all(createdEmails.map((email) => deleteUserByEmail(email)));
});

async function createPassenger(token: string) {
  const response = await request(app).post('/api/passengers').set('Authorization', `Bearer ${token}`).send({
    name: 'Rahul Jani',
    age: 30,
    gender: 'MALE',
    phone: '9876543210',
  });
  return response.body.data.id as string;
}

describe('Bookings', () => {
  it('requires authentication', async () => {
    const response = await request(app).get('/api/bookings');
    expect(response.status).toBe(401);
  });

  it('creates a scheduled booking task without executing a real booking', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceType: 'TRAIN',
        provider: 'IRCTC',
        source: 'BRC',
        destination: 'MMCT',
        journeyDate: '2026-08-28',
        scheduledAt: futureScheduledAt(),
        trainNumber: '20902',
        travelClass: '3A',
        quota: 'GENERAL',
        passengerIds: [passengerId],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('SCHEDULED');
    expect(response.body.data.source).toBe('BRC');
    expect(response.body.data.destination).toBe('MMCT');
    expect(response.body.data.trainNumber).toBe('20902');

    const logs = await request(app)
      .get(`/api/bookings/${response.body.data.id}/logs`)
      .set('Authorization', `Bearer ${token}`);
    expect(logs.status).toBe(200);
    expect(logs.body.data.length).toBeGreaterThan(0);
  });

  it('rejects booking creation without passengers', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${authResponse.body.data.token}`)
      .send({
        serviceType: 'TRAIN',
        provider: 'IRCTC',
        source: 'BRC',
        destination: 'MMCT',
        journeyDate: '2026-08-28',
        scheduledAt: futureScheduledAt(),
        passengerIds: [],
      });

    expect(response.status).toBe(422);
  });

  it('prevents one user from accessing another user booking', async () => {
    const owner = await registerUser();
    const other = await registerUser();
    createdEmails.push(owner.payload.email, other.payload.email);
    const passengerId = await createPassenger(owner.response.body.data.token);

    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${owner.response.body.data.token}`)
      .send({
        serviceType: 'TRAIN',
        provider: 'IRCTC',
        source: 'BRC',
        destination: 'MMCT',
        journeyDate: '2026-08-28',
        scheduledAt: futureScheduledAt(),
        trainNumber: '20902',
        passengerIds: [passengerId],
      });

    const forbidden = await request(app)
      .get(`/api/bookings/${created.body.data.id}`)
      .set('Authorization', `Bearer ${other.response.body.data.token}`);

    expect(forbidden.status).toBe(404);
  });

  it('cancels a booking task', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const passengerId = await createPassenger(token);

    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceType: 'TRAIN',
        provider: 'IRCTC',
        source: 'BRC',
        destination: 'MMCT',
        journeyDate: '2026-08-28',
        scheduledAt: futureScheduledAt(),
        passengerIds: [passengerId],
      });

    const cancelled = await request(app)
      .post(`/api/bookings/${created.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
  });
});
