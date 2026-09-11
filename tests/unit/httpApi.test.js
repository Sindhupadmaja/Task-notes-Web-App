jest.mock('../../src/models/User');
jest.mock('../../src/models/Task');

process.env.JWT_SECRET = 'test-secret'; // must be set BEFORE requiring app.js, since
// authMiddleware.js constructs its AuthService singleton (reading this env var) at
// require time, not per-request -- the same reason server.js loads dotenv first.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const Task = require('../../src/models/Task');

const app = createApp();

function authHeaderFor(userId) {
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

describe('GET /health', () => {
  it('returns 200 ok without requiring auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/auth/register', () => {
  it('rejects an invalid email with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('rejects a short password with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('registers successfully with valid input', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: 'user123', name: 'Ada', email: 'ada@example.com', toJSON() { return this; } });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  it('returns 409 for a duplicate email', async () => {
    User.findOne.mockResolvedValue({ _id: 'existing' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'password123' });

    expect(res.status).toBe(409);
  });
});

describe('task routes require authentication', () => {
  it('rejects requests with no Authorization header', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('rejects requests with a malformed token', async () => {
    const res = await request(app).get('/api/tasks').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('allows requests with a valid token', async () => {
    Task.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    });
    Task.countDocuments.mockResolvedValue(0);

    const res = await request(app).get('/api/tasks').set('Authorization', authHeaderFor('user123'));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/tasks validation', () => {
  it('rejects a task with no title', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', authHeaderFor('user123'))
      .send({ notes: 'no title here' });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid status enum value', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', authHeaderFor('user123'))
      .send({ title: 'Valid title', status: 'not-a-real-status' });

    expect(res.status).toBe(400);
  });

  it('creates a task with valid input', async () => {
    Task.create.mockResolvedValue({ _id: 't1', title: 'Ship the feature', owner: 'user123' });

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', authHeaderFor('user123'))
      .send({ title: 'Ship the feature' });

    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe('Ship the feature');
  });
});

describe('unknown routes', () => {
  it('returns a 404 with a helpful message', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Route not found/);
  });
});
