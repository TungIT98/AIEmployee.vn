/**
 * BashTool - Execute shell commands
 */

const { BaseTool } = require('./base');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class BashTool extends BaseTool {
  constructor(config = {}) {
    super({
      name: 'bash',
      description: 'Execute shell commands in a sandboxed environment',
      category: 'system',
      version: '1.0.0',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute'
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds',
            default: 60000
          },
          cwd: {
            type: 'string',
            description: 'Working directory for command execution'
          },
          env: {
            type: 'object',
            description: 'Environment variables'
          }
        },
        required: ['command']
      }
    });

    this.allowedCommands = config.allowedCommands || [];
    this.deniedCommands = config.deniedCommands || ['rm -rf /', 'del /f /s /q', 'format'];
    this.maxTimeout = config.maxTimeout || 120000;
  }

  /**
   * Check if command is allowed
   * @param {string} command
   * @returns {boolean}
   */
  isCommandAllowed(command) {
    // Check denied patterns
    for (const denied of this.deniedCommands) {
      if (command.toLowerCase().includes(denied.toLowerCase())) {
        return false;
      }
    }
    // If allowed list is empty, allow all non-denied commands
    if (this.allowedCommands.length === 0) {
      return true;
    }
    // Check allowed patterns
    for (const allowed of this.allowedCommands) {
      if (command.toLowerCase().includes(allowed.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  async execute(input) {
    const { command, timeout = 60000, cwd, env } = input;

    // Security check
    if (!this.isCommandAllowed(command)) {
      return {
        success: false,
        result: null,
        error: 'Command not allowed for security reasons',
        metadata: { tool: this.name, timestamp: new Date().toISOString() }
      };
    }

    // Enforce max timeout
    const effectiveTimeout = Math.min(timeout, this.maxTimeout);

    try {
      const options = {
        timeout: effectiveTimeout,
        ...(cwd && { cwd }),
        ...(env && { env: { ...process.env, ...env } }),
        shell: true
      };

      const { stdout, stderr } = await execAsync(command, options);

      return {
        success: true,
        result: {
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: 0
        },
        metadata: {
          tool: this.name,
          command,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      // execAsync throws with code and stderr in the error object
      const exitCode = error.code || 1;
      const stderr = error.stderr || error.message;

      return {
        success: exitCode === 0,
        result: {
          stdout: error.stdout || '',
          stderr: stderr,
          exitCode
        },
        error: exitCode !== 0 ? stderr : null,
        metadata: {
          tool: this.name,
          command,
          exitCode,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

module.exports = { BashTool };
