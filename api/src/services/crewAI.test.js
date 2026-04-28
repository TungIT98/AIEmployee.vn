/**
 * CrewAI Service Tests
 */
const { crewAIService, CREW_TYPES, EXECUTION_STATUS } = require('./crewAI');

// Mock fetch for testing
global.fetch = jest.fn();

describe('CrewAIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('healthCheck', () => {
    it('should return healthy status when service is up', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          service: 'crewai-service',
          available_crews: ['content', 'support', 'sales', 'data_analysis']
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await crewAIService.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.available_crews).toContain('content');
    });

    it('should return unhealthy status when service is down', async () => {
      fetch.mockRejectedValue(new Error('Connection refused'));

      const result = await crewAIService.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('listCrews', () => {
    it('should return list of available crews', async () => {
      const mockCrews = {
        crews: [
          { id: 'content', name: 'ContentCrew' },
          { id: 'support', name: 'SupportCrew' }
        ]
      };
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCrews)
      });

      const result = await crewAIService.listCrews();

      expect(result.crews).toHaveLength(2);
      expect(result.crews[0].id).toBe('content');
    });
  });

  describe('runCrew', () => {
    it('should start crew execution and return execution info', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          execution_id: 'exec_20260428_120000_content',
          status: 'started',
          stream_url: '/crews/content/stream/exec_20260428_120000_content'
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await crewAIService.runCrew('content', 'Write a blog post about AI');

      expect(result.execution_id).toBeDefined();
      expect(result.status).toBe('started');
      expect(result.stream_url).toContain('/crews/content/stream/');
    });

    it('should throw error for unknown crew type', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ detail: "Crew 'unknown' not found" })
      });

      await expect(crewAIService.runCrew('unknown', 'test task'))
        .rejects.toThrow("CrewAI Service error: 404");
    });
  });

  describe('getExecutionStatus', () => {
    it('should return execution status', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          execution_id: 'exec_123',
          crew_id: 'content',
          status: 'completed',
          result: { output: 'Blog post completed' }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await crewAIService.getExecutionStatus('content', 'exec_123');

      expect(result.status).toBe('completed');
      expect(result.result).toBeDefined();
    });
  });

  describe('CREW_TYPES', () => {
    it('should have all crew types defined', () => {
      expect(CREW_TYPES.CONTENT).toBe('content');
      expect(CREW_TYPES.SUPPORT).toBe('support');
      expect(CREW_TYPES.SALES).toBe('sales');
      expect(CREW_TYPES.DATA_ANALYSIS).toBe('data_analysis');
    });
  });

  describe('EXECUTION_STATUS', () => {
    it('should have all status values defined', () => {
      expect(EXECUTION_STATUS.PENDING).toBe('pending');
      expect(EXECUTION_STATUS.RUNNING).toBe('running');
      expect(EXECUTION_STATUS.COMPLETED).toBe('completed');
      expect(EXECUTION_STATUS.FAILED).toBe('failed');
    });
  });
});
