import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Health', () => {
  it('returns service health', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'ai-travel-agent-api',
    });
  });

  it('returns database health', async () => {
    const response = await request(app).get('/health/db');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('connected');
  });

  it('returns redis health', async () => {
    const response = await request(app).get('/health/redis');
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty('redis');
  });
});
