/**
 * WebFetchTool - Make HTTP requests
 */

const { BaseTool } = require('./base');
const https = require('https');
const http = require('http');
const { URL } = require('url');

class WebFetchTool extends BaseTool {
  constructor(config = {}) {
    super({
      name: 'web_fetch',
      description: 'Make HTTP/HTTPS requests to fetch web content or call APIs',
      category: 'network',
      version: '1.0.0',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to fetch'
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
            description: 'HTTP method',
            default: 'GET'
          },
          headers: {
            type: 'object',
            description: 'Request headers'
          },
          body: {
            type: ['string', 'object'],
            description: 'Request body (will be JSON stringified if object)'
          },
          timeout: {
            type: 'number',
            description: 'Request timeout in milliseconds',
            default: 30000
          },
          allowRedirects: {
            type: 'boolean',
            description: 'Follow redirects',
            default: true
          }
        },
        required: ['url']
      }
    });

    this.allowedDomains = config.allowedDomains || [];
    this.deniedDomains = config.deniedDomains || [];
    this.maxResponseSize = config.maxResponseSize || 10 * 1024 * 1024; // 10MB
    this.defaultHeaders = config.defaultHeaders || {
      'User-Agent': 'CompanyOS/1.0 (Agent Orchestration System)'
    };
  }

  /**
   * Check if domain is allowed
   * @param {string} url
   * @returns {boolean}
   */
  isDomainAllowed(urlString) {
    try {
      const url = new URL(urlString);
      const hostname = url.hostname;

      // Check denied domains
      for (const denied of this.deniedDomains) {
        if (hostname === denied || hostname.endsWith('.' + denied)) {
          return false;
        }
      }

      // If allowed list is empty, allow all non-denied domains
      if (this.allowedDomains.length === 0) {
        return true;
      }

      // Check allowed domains
      for (const allowed of this.allowedDomains) {
        if (hostname === allowed || hostname.endsWith('.' + allowed)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Make HTTP request
   * @param {Object} input
   * @returns {Promise<Object>}
   */
  async makeRequest(input) {
    const { url, method = 'GET', headers = {}, body, timeout = 30000, allowRedirects = true } = input;

    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestHeaders = {
        ...this.defaultHeaders,
        ...headers
      };

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method,
        headers: requestHeaders
      };

      const req = client.request(options, (res) => {
        const chunks = [];
        let size = 0;

        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > this.maxResponseSize) {
            req.destroy();
            resolve({
              success: false,
              result: null,
              error: 'Response size exceeds maximum allowed',
              metadata: { tool: this.name, timestamp: new Date().toISOString() }
            });
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          let parsedBody;

          // Try to parse as JSON
          try {
            parsedBody = JSON.parse(buffer.toString());
          } catch {
            parsedBody = buffer.toString('utf8');
          }

          resolve({
            success: true,
            result: {
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              headers: res.headers,
              body: parsedBody,
              size: buffer.length
            },
            metadata: {
              tool: this.name,
              url,
              method,
              timestamp: new Date().toISOString()
            }
          });
        });

        res.on('error', (error) => {
          resolve({
            success: false,
            result: null,
            error: error.message,
            metadata: { tool: this.name, timestamp: new Date().toISOString() }
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          result: null,
          error: error.message,
          metadata: { tool: this.name, timestamp: new Date().toISOString() }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          result: null,
          error: 'Request timeout',
          metadata: { tool: this.name, timestamp: new Date().toISOString() }
        });
      });

      // Write body if present
      if (body) {
        const bodyStr = typeof body === 'object' ? JSON.stringify(body) : body;
        req.write(bodyStr);
      }

      req.end();
    });
  }

  async execute(input) {
    const { url, method, headers, body, timeout, allowRedirects } = input;

    // Security check
    if (!this.isDomainAllowed(url)) {
      return {
        success: false,
        result: null,
        error: 'Domain not allowed for security reasons',
        metadata: { tool: this.name, timestamp: new Date().toISOString() }
      };
    }

    // Follow redirects manually if allowed
    if (allowRedirects) {
      let currentUrl = url;
      let maxRedirects = 5;
      let lastResult;

      while (maxRedirects > 0) {
        lastResult = await this.makeRequest({
          url: currentUrl,
          method,
          headers,
          body,
          timeout,
          allowRedirects: false
        });

        if (!lastResult.success) {
          return lastResult;
        }

        // Check for redirect
        const location = lastResult.result.headers.location;
        if (lastResult.result.statusCode >= 300 && lastResult.result.statusCode < 400 && location) {
          // Resolve relative URLs
          currentUrl = new URL(location, currentUrl).toString();
          maxRedirects--;
        } else {
          return lastResult;
        }
      }

      return {
        success: false,
        result: null,
        error: 'Too many redirects',
        metadata: { tool: this.name, timestamp: new Date().toISOString() }
      };
    }

    return this.makeRequest({ url, method, headers, body, timeout, allowRedirects });
  }
}

module.exports = { WebFetchTool };
