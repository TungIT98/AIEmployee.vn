/**
 * Basic test for Agent Orchestration System
 */

const {
  createAgentOrchestrationSystem,
  PRIORITY,
  TASK_STATUS,
  AGENT_STATUS
} = require('./agentOrchestration');

test('Agent Orchestration System - Create system', async () => {
  const system = createAgentOrchestrationSystem();
  expect(system).toBeDefined();
  expect(system.tools).toBeDefined();
  expect(system.agents).toBeDefined();
  expect(system.hooks).toBeDefined();
  system.destroy();
});

test('Agent Orchestration System - Tool Registry', async () => {
  const system = createAgentOrchestrationSystem();
  const tools = system.tools.list({ latestOnly: true });
  expect(Array.isArray(tools)).toBe(true);
  system.destroy();
});

test('Agent Orchestration System - Tool search', async () => {
  const system = createAgentOrchestrationSystem();
  const results = system.tools.search('file');
  expect(Array.isArray(results)).toBe(true);
  system.destroy();
});

test('Agent Orchestration System - Create agent', async () => {
  const system = createAgentOrchestrationSystem();
  const agent = system.agents.create({
    name: 'test-agent',
    role: 'backend',
    config: {
      maxTokens: 50000,
      tools: ['bash', 'file_read']
    }
  });
  expect(agent).toBeDefined();
  expect(agent.name).toBe('test-agent');
  expect(agent.status).toBe(AGENT_STATUS.CREATED);
  system.destroy();
});

test('Agent Orchestration System - Session and Task Queue', async () => {
  const system = createAgentOrchestrationSystem();
  const agent = system.agents.create({
    name: 'test-agent',
    role: 'backend'
  });
  const session = system.agents.createSession(agent.id);
  expect(session).toBeDefined();
  expect(session.taskQueue).toBeDefined();

  const task1 = session.taskQueue.add({
    type: 'code-review',
    payload: { file: 'test.js' },
    priority: PRIORITY.HIGH
  });
  expect(task1).toBeDefined();

  const task2 = session.taskQueue.add({
    type: 'test-run',
    payload: { file: 'test.js' },
    priority: PRIORITY.NORMAL,
    dependencies: [task1.id]
  });
  expect(task2).toBeDefined();
  system.destroy();
});

test('Agent Orchestration System - Execution Context', async () => {
  const system = createAgentOrchestrationSystem();
  const agent = system.agents.create({
    name: 'test-agent',
    role: 'backend'
  });
  const session = system.agents.createSession(agent.id);
  session.context.addMessage({ role: 'user', content: 'Hello, agent!' });
  session.context.addMessage({ role: 'assistant', content: 'Hello! How can I help?' });
  expect(session.context.getMessageCount()).toBe(2);
  system.destroy();
});

test('Agent Orchestration System - Memory', async () => {
  const system = createAgentOrchestrationSystem();
  const agent = system.agents.create({
    name: 'test-agent',
    role: 'backend'
  });
  const session = system.agents.createSession(agent.id);

  const fact1 = session.memory.store({
    content: 'User prefers dark mode',
    type: 'preference',
    tags: ['ui', 'user'],
    agentId: agent.id
  });
  expect(fact1).toBeDefined();

  const retrieved = session.memory.search('dark mode');
  expect(retrieved.length).toBeGreaterThan(0);
  system.destroy();
});

test('Agent Orchestration System - Stats', async () => {
  const system = createAgentOrchestrationSystem();
  expect(system.stats.getTools()).toBeDefined();
  expect(system.stats.getAgents()).toBeDefined();
  system.destroy();
});
