import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { deleteUserByEmail, registerUser } from './helpers';

const createdEmails: string[] = [];

afterAll(async () => {
  await Promise.all(createdEmails.map((email) => deleteUserByEmail(email)));
});

describe('Passengers', () => {
  it('requires authentication', async () => {
    const response = await request(app).get('/api/passengers');
    expect(response.status).toBe(401);
  });

  it('creates, lists, updates, and deletes a passenger', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = authResponse.body.data.token as string;
    const auth = { Authorization: `Bearer ${token}` };

    const created = await request(app).post('/api/passengers').set(auth).send({
      name: 'Rahul Jani',
      age: 30,
      gender: 'MALE',
      phone: '9876543210',
    });
    expect(created.status).toBe(201);
    const passengerId = created.body.data.id as string;

    const listed = await request(app).get('/api/passengers').set(auth);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);

    const fetched = await request(app).get(`/api/passengers/${passengerId}`).set(auth);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.name).toBe('Rahul Jani');

    const updated = await request(app).put(`/api/passengers/${passengerId}`).set(auth).send({
      age: 31,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.age).toBe(31);

    const deleted = await request(app).delete(`/api/passengers/${passengerId}`).set(auth);
    expect(deleted.status).toBe(200);
  });

  it('prevents one user from accessing another user passenger', async () => {
    const first = await registerUser();
    const second = await registerUser();
    createdEmails.push(first.payload.email, second.payload.email);

    const created = await request(app)
      .post('/api/passengers')
      .set('Authorization', `Bearer ${first.response.body.data.token}`)
      .send({ name: 'Private Person', age: 40, gender: 'FEMALE', phone: '1111111111' });

    const other = await request(app)
      .get(`/api/passengers/${created.body.data.id}`)
      .set('Authorization', `Bearer ${second.response.body.data.token}`);

    expect(other.status).toBe(404);
  });

  it('rejects invalid passenger payloads', async () => {
    const { payload, response: authResponse } = await registerUser();
    createdEmails.push(payload.email);

    const response = await request(app)
      .post('/api/passengers')
      .set('Authorization', `Bearer ${authResponse.body.data.token}`)
      .send({ name: 'X', age: -1, gender: 'UNKNOWN', phone: '1' });

    expect(response.status).toBe(422);
  });
});
