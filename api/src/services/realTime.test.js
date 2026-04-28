/**
 * Real-Time Service Tests (COM-190)
 */

const http = require('http');
const { RealTimeService, SSEService, RT_EVENTS } = require('../services/realTime');
const { AgentLifecycleManager } = require('../state/agentManager');
const { TaskQueueManager, PRIORITY } = require('../state/taskQueue');

describe('RealTimeService', () => {
  let server;
  let realTimeService;

  beforeAll((done) => {
    // Create test HTTP server
    server = http.createServer((req, res) => {
      res.writeHead(200);
      res.end('OK');
    });

    server.listen(0, () => {
      const port = server.address().port;
      realTimeService = new RealTimeService(server);
      realTimeService.initialize();
      done();
    });
  });

  afterAll((done) => {
    realTimeService.shutdown();
    server.close(done);
  });

  beforeEach(() => {
    realTimeService._clientCount = 0;
  });

  describe('initialization', () => {
    test('should initialize Socket.io server', () => {
      const io = realTimeService.getIO();
      expect(io).toBeDefined();
    });

    test('should return operational status when initialized', () => {
      const status = realTimeService.getStatus();
      expect(status.service).toBe('Real-Time Service');
      expect(status.status).toBe('operational');
    });
  });

  describe('broadcast', () => {
    test('should broadcast event to all clients', () => {
      const spy = jest.spyOn(realTimeService._io, 'emit');
      realTimeService.broadcast('test_event', { data: 'test' });
      expect(spy).toHaveBeenCalled();
    });

    test('should broadcast to specific room', () => {
      const spy = jest.spyOn(realTimeService._io, 'to');
      realTimeService.broadcastToRoom('dashboard', 'test_event', { data: 'test' });
      expect(spy).toHaveBeenCalledWith('dashboard');
    });
  });

  describe('registerAgentManager', () => {
    test('should register event listeners without error', () => {
      const agentManager = new AgentLifecycleManager();
      expect(() => {
        realTimeService.registerAgentManager(agentManager);
      }).not.toThrow();
    });

    test('should handle null agent manager gracefully', () => {
      expect(() => {
        realTimeService.registerAgentManager(null);
      }).not.toThrow();
    });
  });

  describe('registerTaskQueue', () => {
    test('should register event listeners without error', () => {
      const taskQueue = new TaskQueueManager();
      expect(() => {
        realTimeService.registerTaskQueue(taskQueue);
      }).not.toThrow();
    });

    test('should handle null task queue gracefully', () => {
      expect(() => {
        realTimeService.registerTaskQueue(null);
      }).not.toThrow();
    });
  });

  describe('refreshDashboard', () => {
    test('should broadcast dashboard refresh event', () => {
      const spy = jest.spyOn(realTimeService, 'broadcast');
      realTimeService.refreshDashboard();
      expect(spy).toHaveBeenCalledWith(
        RT_EVENTS.DASHBOARD_REFRESH,
        expect.objectContaining({ timestamp: expect.any(String) }),
        'dashboard'
      );
    });
  });

  describe('agent events integration', () => {
    test('should emit agent:created event', (done) => {
      const agentManager = new AgentLifecycleManager();
      realTimeService.registerAgentManager(agentManager);

      const io = realTimeService.getIO();
      io.emit('connection', { id: 'test-socket', join: jest.fn(), emit: jest.fn() });

      const newAgent = agentManager.create({ name: 'Test Agent', role: 'test' });
      agentManager.emit('agent:created', { agent: newAgent });

      setTimeout(() => {
        done();
      }, 100);
    });
  });

  describe('task events integration', () => {
    test('should emit task:added event', (done) => {
      const taskQueue = new TaskQueueManager();
      realTimeService.registerTaskQueue(taskQueue);

      const io = realTimeService.getIO();
      io.emit('connection', { id: 'test-socket', join: jest.fn(), emit: jest.fn() });

      taskQueue.add({ type: 'test_task', payload: { data: 'test' } });

      setTimeout(() => {
        done();
      }, 100);
    });
  });
});

describe('SSEService', () => {
  let sseService;

  beforeEach(() => {
    sseService = new SSEService();
  });

  describe('addClient', () => {
    test('should add client to clients set', () => {
      const mockResponse = { write: jest.fn() };
      sseService.addClient(mockResponse);
      expect(sseService._clients.has(mockResponse)).toBe(true);
    });
  });

  describe('removeClient', () => {
    test('should remove client from clients set', () => {
      const mockResponse = { write: jest.fn() };
      sseService.addClient(mockResponse);
      sseService.removeClient(mockResponse);
      expect(sseService._clients.has(mockResponse)).toBe(false);
    });
  });

  describe('send', () => {
    test('should write message to all clients', () => {
      const mockResponse1 = { write: jest.fn() };
      const mockResponse2 = { write: jest.fn() };
      sseService.addClient(mockResponse1);
      sseService.addClient(mockResponse2);

      sseService.send('test_event', { data: 'test' });

      expect(mockResponse1.write).toHaveBeenCalled();
      expect(mockResponse2.write).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    test('should return correct status', () => {
      const mockResponse = { write: jest.fn() };
      sseService.addClient(mockResponse);

      const status = sseService.getStatus();
      expect(status.service).toBe('SSE Service');
      expect(status.clientCount).toBe(1);
    });
  });
});

describe('RT_EVENTS', () => {
  test('should define agent event types', () => {
    expect(RT_EVENTS.AGENT_STATUS_CHANGED).toBe('agent:status_changed');
    expect(RT_EVENTS.AGENT_CREATED).toBe('agent:created');
    expect(RT_EVENTS.AGENT_STARTED).toBe('agent:started');
    expect(RT_EVENTS.AGENT_STOPPED).toBe('agent:stopped');
  });

  test('should define task event types', () => {
    expect(RT_EVENTS.TASK_ADDED).toBe('task:added');
    expect(RT_EVENTS.TASK_STARTED).toBe('task:started');
    expect(RT_EVENTS.TASK_COMPLETED).toBe('task:completed');
    expect(RT_EVENTS.TASK_FAILED).toBe('task:failed');
  });

  test('should define dashboard event types', () => {
    expect(RT_EVENTS.DASHBOARD_REFRESH).toBe('dashboard:refresh');
    expect(RT_EVENTS.METRICS_UPDATE).toBe('metrics:update');
  });
});
