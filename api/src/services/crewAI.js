/**
 * CrewAI Service - Node.js wrapper for CrewAI FastAPI service
 *
 * Provides integration between Company OS API and CrewAI orchestration engine
 */
const EventEmitter = require('events');

const CREW_SERVICE_URL = process.env.CREW_SERVICE_URL || 'http://localhost:8000';

/**
 * Crew types available
 */
const CREW_TYPES = {
  CONTENT: 'content',
  SUPPORT: 'support',
  SALES: 'sales',
  DATA_ANALYSIS: 'data_analysis'
};

/**
 * Execution status
 */
const EXECUTION_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

class CrewAIService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.baseUrl = options.baseUrl || CREW_SERVICE_URL;
    this.timeout = options.timeout || 300000; // 5 minute default timeout
  }

  /**
   * Make HTTP request to crew service
   */
  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(`CrewAI Service error: ${response.status} - ${error.detail || error.message}`);
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Health check for crew service
   */
  async healthCheck() {
    try {
      const response = await this._request('/health');
      return await response.json();
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * List available crews
   */
  async listCrews() {
    const response = await this._request('/crews');
    return await response.json();
  }

  /**
   * Run a crew with the given task
   * @param {string} crewId - Crew type (content, support, sales, data_analysis)
   * @param {string} task - Task description
   * @param {Object} inputs - Additional inputs for agents
   * @returns {Object} Execution info with stream URL
   */
  async runCrew(crewId, task, inputs = {}) {
    const response = await this._request(`/crews/${crewId}/run`, {
      method: 'POST',
      body: JSON.stringify({
        task,
        inputs,
        streaming: true
      })
    });

    return await response.json();
  }

  /**
   * Get crew execution status
   */
  async getExecutionStatus(crewId, executionId) {
    const response = await this._request(`/crews/${crewId}/status/${executionId}`);
    return await response.json();
  }

  /**
   * Stream crew execution results via SSE
   * @param {string} crewId - Crew type
   * @param {string} executionId - Execution ID from runCrew
   * @param {Function} onEvent - Callback for SSE events
   */
  async streamExecution(crewId, executionId, onEvent) {
    const response = await this._request(`/crews/${crewId}/stream/${executionId}`);

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          const eventType = line.slice(6).trim();
          continue;
        }

        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          try {
            const parsed = JSON.parse(data);
            if (onEvent) {
              onEvent(parsed);
            }
          } catch (e) {
            // Ignore parse errors for incomplete data
          }
        }
      }
    }
  }

  /**
   * Run crew with streaming - convenience method
   * @param {string} crewId - Crew type
   * @param {string} task - Task description
   * @param {Object} inputs - Additional inputs
   * @param {Function} onProgress - Progress callback (status, result, error)
   */
  async runCrewWithStreaming(crewId, task, inputs = {}, onProgress) {
    // Start execution
    const execution = await this.runCrew(crewId, task, inputs);

    // Stream results
    return new Promise((resolve, reject) => {
      let finalResult = null;

      this.streamExecution(crewId, execution.execution_id, (event) => {
        if (onProgress) {
          onProgress(event);
        }

        if (event.status === 'completed') {
          finalResult = event.result;
        } else if (event.status === 'failed') {
          reject(new Error(event.error || 'Crew execution failed'));
        }
      }).then(() => {
        resolve(finalResult);
      }).catch(reject);
    });
  }
}

// Export singleton instance
const crewAIService = new CrewAIService();

module.exports = {
  crewAIService,
  CrewAIService,
  CREW_TYPES,
  EXECUTION_STATUS
};
