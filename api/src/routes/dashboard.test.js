/**
 * Dashboard Real-Time Routes Tests (COM-190)
 */

const express = require('express');
const request = require('supertest');

// Mock global references before requiring the router
global.agentManager = null;
global.taskQueueManager = null;

const { router, initialize, getAgentStatusData } = require('../routes/dashboard');

describe('Dashboard RT Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/dashboard', router);
  });

  describe('GET /api/dashboard/agents/status', () => {
    test('should return agent status data', async () => {
      const response = await request(app)
        .get('/api/dashboard/agents/status')
        .expect(200);

      expect(response.body).toHaveProperty('agents');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.summary).toHaveProperty('total');
      expect(response.body.summary).toHaveProperty('byStatus');
    });

    test('should return JSON (not SSE) by default', async () => {
      const response = await request(app)
        .get('/api/dashboard/agents/status')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  describe('GET /api/dashboard/tasks/queue', () => {
    test('should return task queue status', async () => {
      const response = await request(app)
        .get('/api/dashboard/tasks/queue')
        .expect(200);

      expect(response.body).toHaveProperty('stats');
    });

    test('should handle missing task queue manager', async () => {
      global.taskQueueManager = null;

      const response = await request(app)
        .get('/api/dashboard/tasks/queue')
        .expect(200);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/dashboard/metrics', () => {
    test('should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/dashboard/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('agents');
      expect(response.body).toHaveProperty('tasks');
      expect(response.body).toHaveProperty('realTime');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/dashboard/activity', () => {
    test('should return activity feed', async () => {
      const response = await request(app)
        .get('/api/dashboard/activity')
        .expect(200);

      expect(response.body).toHaveProperty('activities');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit');
    });

    test('should respect limit query parameter', async () => {
      const response = await request(app)
        .get('/api/dashboard/activity?limit=5')
        .expect(200);

      expect(response.body.limit).toBe(5);
    });
  });
});

describe('getAgentStatusData', () => {
  test('should return empty data when no agent manager', () => {
    global.agentManager = null;
    const result = getAgentStatusData();

    expect(result.agents).toEqual([]);
    expect(result.summary.total).toBe(0);
  });
});
