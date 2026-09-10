import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { deleteUserByEmail, registerUser } from './helpers';

const createdEmails: string[] = [];

afterAll(async () => {
  await Promise.all(createdEmails.map((email) => deleteUserByEmail(email)));
});

describe('Auth', () => {
  it('registers a user and returns a token without passwordHash', async () => {
    const { payload, response } = await registerUser();
    createdEmails.push(payload.email);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Registration successful');
    expect(response.body.data.user.email).toBe(payload.email);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.token).toEqual(expect.any(String));
  });

  it('rejects duplicate email registration', async () => {
    const { payload } = await registerUser();
    createdEmails.push(payload.email);
    const second = await registerUser({ email: payload.email });
    expect(second.response.status).toBe(409);
  });

  it('logs in with valid credentials', async () => {
    const { payload } = await registerUser();
    createdEmails.push(payload.email);

    const response = await request(app).post('/api/auth/login').send({
      email: payload.email,
      password: payload.password,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user.email).toBe(payload.email);
  });

  it('rejects invalid credentials', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'wrong-password',
    });
    expect(response.status).toBe(401);
  });

  it('rejects unauthorized /me requests', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('returns the current user with a valid token', async () => {
    const { payload, response: registerResponse } = await registerUser();
    createdEmails.push(payload.email);
    const token = registerResponse.body.data.token as string;

    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(payload.email);
  });

  it('returns validation errors for invalid register payloads', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'A',
      email: 'not-an-email',
      phone: '1',
      password: 'short',
    });
    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
