export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'AI Travel Booking Agent API',
    version: '0.1.0',
    description:
      'Phase 3 API for booking tasks, provider abstraction, and mock execution. Real IRCTC booking is not implemented.',
  },
  servers: [{ url: '/', description: 'Current host' }],
  tags: [
    { name: 'Health' },
    { name: 'Authentication' },
    { name: 'Passengers' },
    { name: 'Bookings' },
    { name: 'Providers' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Service health',
        responses: { '200': { description: 'API is healthy' } },
      },
    },
    '/health/db': {
      get: {
        tags: ['Health'],
        summary: 'Database health',
        responses: {
          '200': { description: 'PostgreSQL is reachable' },
          '503': { description: 'PostgreSQL is unreachable' },
        },
      },
    },
    '/health/redis': {
      get: {
        tags: ['Health'],
        summary: 'Redis health',
        responses: {
          '200': { description: 'Redis is reachable' },
          '503': { description: 'Redis is unreachable' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'phone', 'password'],
                properties: {
                  name: { type: 'string', example: 'Afzal Surti' },
                  email: { type: 'string', example: 'afzal@example.com' },
                  phone: { type: 'string', example: '9999999999' },
                  password: { type: 'string', example: 'password' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Registration successful' },
          '409': { description: 'Email already exists' },
          '422': { description: 'Validation error' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login successful' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Current user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Authenticated user' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/passengers': {
      get: {
        tags: ['Passengers'],
        summary: 'List passengers',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Passenger list' } },
      },
      post: {
        tags: ['Passengers'],
        summary: 'Create passenger',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'age', 'gender', 'phone'],
                properties: {
                  name: { type: 'string' },
                  age: { type: 'integer' },
                  gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER'] },
                  phone: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Passenger created' } },
      },
    },
    '/api/passengers/{id}': {
      get: {
        tags: ['Passengers'],
        summary: 'Get passenger',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Passenger' }, '404': { description: 'Not found' } },
      },
      put: {
        tags: ['Passengers'],
        summary: 'Update passenger',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Updated' } },
      },
      delete: {
        tags: ['Passengers'],
        summary: 'Delete passenger',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deleted' } },
      },
    },
    '/api/bookings': {
      get: {
        tags: ['Bookings'],
        summary: 'List booking tasks',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Booking list' } },
      },
      post: {
        tags: ['Bookings'],
        summary: 'Create booking task',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: [
                  'serviceType',
                  'provider',
                  'source',
                  'destination',
                  'journeyDate',
                  'scheduledAt',
                  'passengerIds',
                ],
                properties: {
                  serviceType: { type: 'string', enum: ['TRAIN', 'BUS', 'FLIGHT'] },
                  provider: { type: 'string', example: 'MOCK' },
                  source: { type: 'string', example: 'BRC' },
                  destination: { type: 'string', example: 'MMCT' },
                  journeyDate: { type: 'string', example: '2026-08-28' },
                  scheduledAt: { type: 'string', example: '2026-08-27T09:55:00+05:30' },
                  trainNumber: { type: 'string', example: '20902' },
                  travelClass: { type: 'string', example: '3A' },
                  quota: { type: 'string', example: 'GENERAL' },
                  passengerIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Booking task created' } },
      },
    },
    '/api/bookings/{id}': {
      get: {
        tags: ['Bookings'],
        summary: 'Get booking task',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Booking task' } },
      },
      put: {
        tags: ['Bookings'],
        summary: 'Update booking task',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Updated' } },
      },
      delete: {
        tags: ['Bookings'],
        summary: 'Delete booking task',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deleted' } },
      },
    },
    '/api/bookings/{id}/cancel': {
      post: {
        tags: ['Bookings'],
        summary: 'Cancel booking task',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Cancelled' } },
      },
    },
    '/api/bookings/{id}/reschedule': {
      put: {
        tags: ['Bookings'],
        summary: 'Reschedule a scheduled booking task',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['scheduledAt'],
                properties: {
                  scheduledAt: { type: 'string', example: '2026-08-27T10:00:00+05:30' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Rescheduled' } },
      },
    },
    '/api/bookings/{id}/run': {
      post: {
        tags: ['Bookings'],
        summary: 'Queue booking for immediate mock execution (development only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Queued' } },
      },
    },
    '/api/bookings/{id}/resume': {
      post: {
        tags: ['Bookings'],
        summary: 'Resume a booking after a human-required action',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Requeued' },
          '409': { description: 'Booking is not waiting on a human action' },
        },
      },
    },
    '/api/bookings/{id}/logs': {
      get: {
        tags: ['Bookings'],
        summary: 'Get execution logs',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Execution logs' } },
      },
    },
    '/api/providers': {
      get: {
        tags: ['Providers'],
        summary: 'List supported providers',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Provider list' } },
      },
    },
    '/api/providers/{provider}': {
      get: {
        tags: ['Providers'],
        summary: 'Get provider metadata',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Provider metadata' },
          '404': { description: 'Unknown provider' },
        },
      },
    },
  },
};
