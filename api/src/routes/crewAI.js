/**
 * CrewAI API Routes
 * Integrates CrewAI orchestration engine with Company OS API
 */
const express = require('express');
const { crewAIService, CREW_TYPES } = require('../services/crewAI');

const router = express.Router();

/**
 * GET /api/crewai/health
 * Check CrewAI service health
 */
router.get('/health', async (req, res) => {
  try {
    const health = await crewAIService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * GET /api/crewai/crews
 * List all available crews
 */
router.get('/crews', async (req, res) => {
  try {
    const crews = await crewAIService.listCrews();
    res.json(crews);
  } catch (error) {
    res.status(503).json({
      error: 'Failed to fetch crews',
      message: error.message
    });
  }
});

/**
 * POST /api/crewai/crews/:crewId/run
 * Run a crew with a task
 */
router.post('/crews/:crewId/run', async (req, res) => {
  const { crewId } = req.params;
  const { task, inputs = {} } = req.body;

  if (!task) {
    return res.status(400).json({
      error: 'Missing required field: task'
    });
  }

  // Validate crew type
  const validCrewTypes = Object.values(CREW_TYPES);
  if (!validCrewTypes.includes(crewId)) {
    return res.status(400).json({
      error: `Invalid crew type: ${crewId}`,
      validTypes: validCrewTypes
    });
  }

  try {
    const execution = await crewAIService.runCrew(crewId, task, inputs);
    res.json(execution);
  } catch (error) {
    res.status(502).json({
      error: 'Failed to start crew execution',
      message: error.message
    });
  }
});

/**
 * GET /api/crewai/crews/:crewId/status/:executionId
 * Get crew execution status
 */
router.get('/crews/:crewId/status/:executionId', async (req, res) => {
  const { crewId, executionId } = req.params;

  try {
    const status = await crewAIService.getExecutionStatus(crewId, executionId);
    res.json(status);
  } catch (error) {
    res.status(502).json({
      error: 'Failed to get execution status',
      message: error.message
    });
  }
});

/**
 * POST /api/crewai/crews/:crewId/run-with-streaming
 * Run a crew with real-time streaming response
 */
router.post('/crews/:crewId/run-with-streaming', async (req, res) => {
  const { crewId } = req.params;
  const { task, inputs = {} } = req.body;

  if (!task) {
    return res.status(400).json({
      error: 'Missing required field: task'
    });
  }

  const validCrewTypes = Object.values(CREW_TYPES);
  if (!validCrewTypes.includes(crewId)) {
    return res.status(400).json({
      error: `Invalid crew type: ${crewId}`,
      validTypes: validCrewTypes
    });
  }

  try {
    // Start execution
    const execution = await crewAIService.runCrew(crewId, task, inputs);

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Stream results
    await crewAIService.streamExecution(crewId, execution.execution_id, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      // Close connection when complete or failed
      if (event.status === 'completed' || event.status === 'failed') {
        res.end();
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      // Cleanup if needed
    });

  } catch (error) {
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Failed to run crew with streaming',
        message: error.message
      });
    } else {
      res.end();
    }
  }
});

module.exports = router;
