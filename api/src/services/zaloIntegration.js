/**
 * Zalo Integration Service
 * Part of VAT Systems MVP (COM-82)
 *
 * Provides integration with Zalo API for notifications and messaging.
 * Zalo is Vietnam's most popular messaging platform with significant
 * business API capabilities.
 */

class ZaloIntegrationService {
  constructor(config = {}) {
    this.config = {
      // Zalo API credentials
      appId: config.ZALO_APP_ID || '',
      appSecret: config.ZALO_APP_SECRET || '',
      accessToken: config.ZALO_ACCESS_TOKEN || '',

      // API endpoints
      apiBaseUrl: config.ZALO_API_URL || 'https://graph.zalo.me/v2.0',

      // Message settings
      defaultTemplateId: config.ZALO_DEFAULT_TEMPLATE || '',
      testMode: config.testMode || true, // Mock responses when true
      ...config
    };

    // Message templates (in production, these would be fetched from Zalo)
    this.templates = {
      invoice_created: {
        id: this.config.defaultTemplateId || 'INV_CREATED_001',
        name: 'Invoice Created',
        variables: ['invoice_number', 'customer_name', 'amount', 'date']
      },
      invoice_paid: {
        id: 'INV_PAID_001',
        name: 'Invoice Paid',
        variables: ['invoice_number', 'payment_date', 'amount']
      },
      payment_reminder: {
        id: 'PAYMENT_REM_001',
        name: 'Payment Reminder',
        variables: ['customer_name', 'invoice_number', 'due_date', 'amount']
      },
      welcome: {
        id: 'WELCOME_001',
        name: 'Welcome Message',
        variables: ['customer_name', 'company_name']
      }
    };
  }

  /**
   * Send a Zalo message to a user
   * @param {object} params - Message parameters
   * @returns {Promise<object>} - Send result
   */
  async sendMessage(params) {
    const { userId, message, templateId, templateData, type = 'text' } = params;

    if (!userId) {
      throw new Error('User ID (uid) is required');
    }

    if (this.config.testMode) {
      return this.mockSendMessage(userId, message, type);
    }

    try {
      const endpoint = `${this.config.apiBaseUrl}/me/message`;

      const payload = {
        uid: userId,
        message: type === 'text' ? { text: message } : undefined,
        templateid: templateId || undefined,
        templateData: templateData || undefined,
        type: type
      };

      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      return {
        success: true,
        data: response,
        message: 'Message sent successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to send message'
      };
    }
  }

  /**
   * Send text message
   * @param {string} userId - Zalo user ID
   * @param {string} text - Message text
   * @returns {Promise<object>} - Send result
   */
  async sendTextMessage(userId, text) {
    return this.sendMessage({ userId, message: text, type: 'text' });
  }

  /**
   * Send template message
   * @param {string} userId - Zalo user ID
   * @param {string} templateId - Template ID
   * @param {object} templateData - Template variables
   * @returns {Promise<object>} - Send result
   */
  async sendTemplateMessage(userId, templateId, templateData) {
    return this.sendMessage({ userId, templateId, templateData, type: 'template' });
  }

  /**
   * Send invoice notification
   * @param {object} invoice - Invoice data
   * @param {string} userId - Zalo user ID
   * @returns {Promise<object>} - Send result
   */
  async sendInvoiceNotification(invoice, userId) {
    const templateId = this.templates.invoice_created.id;
    const templateData = {
      invoice_number: invoice.invoiceNumber || invoice.invoice_number,
      customer_name: invoice.buyer?.name || invoice.customer_name,
      amount: this.formatCurrency(invoice.totals?.grandTotal || invoice.amount),
      date: invoice.invoiceIssueDate || invoice.date || new Date().toISOString().split('T')[0]
    };

    return this.sendTemplateMessage(userId, templateId, templateData);
  }

  /**
   * Send payment confirmation
   * @param {object} payment - Payment data
   * @param {string} userId - Zalo user ID
   * @returns {Promise<object>} - Send result
   */
  async sendPaymentConfirmation(payment, userId) {
    const templateId = this.templates.invoice_paid.id;
    const templateData = {
      invoice_number: payment.invoiceNumber || payment.invoice_number,
      payment_date: payment.paymentDate || new Date().toISOString().split('T')[0],
      amount: this.formatCurrency(payment.amount || payment.totalAmount)
    };

    return this.sendTemplateMessage(userId, templateId, templateData);
  }

  /**
   * Send payment reminder
   * @param {object} reminder - Reminder data
   * @param {string} userId - Zalo user ID
   * @returns {Promise<object>} - Send result
   */
  async sendPaymentReminder(reminder, userId) {
    const templateId = this.templates.payment_reminder.id;
    const templateData = {
      customer_name: reminder.customerName || reminder.customer_name,
      invoice_number: reminder.invoiceNumber || reminder.invoice_number,
      due_date: reminder.dueDate || reminder.due_date,
      amount: this.formatCurrency(reminder.amount || reminder.totalAmount)
    };

    return this.sendTemplateMessage(userId, templateId, templateData);
  }

  /**
   * Get user profile information
   * @param {string} userId - Zalo user ID
   * @returns {Promise<object>} - User profile
   */
  async getUserProfile(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (this.config.testMode) {
      return {
        success: true,
        data: {
          uid: userId,
          name: 'Test User',
          birthday: '01/01/1990',
          gender: 'male',
          phone: '+84XXXXXXXXX',
          address: 'Vietnam',
          city: 'Ho Chi Minh City',
          testMode: true
        }
      };
    }

    try {
      const endpoint = `${this.config.apiBaseUrl}/me?fields=id,name,birthday,gender,phone,address`;
      const response = await this.makeRequest(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`
        }
      });

      return {
        success: true,
        data: response
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create/Register a Zalo user/OA following relationship
   * @param {string} userId - Zalo user ID
   * @param {string} name - User name
   * @param {string} phone - User phone (optional)
   * @returns {Promise<object>} - Creation result
   */
  async createUser(userId, name, phone = null) {
    const userData = {
      uid: userId,
      name: name,
      phone: phone
    };

    if (this.config.testMode) {
      return {
        success: true,
        data: {
          ...userData,
          createdAt: new Date().toISOString(),
          testMode: true
        },
        message: 'User created successfully (test mode)'
      };
    }

    try {
      // In production, this would call Zalo API to create/update user
      const endpoint = `${this.config.apiBaseUrl}/user`;
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      return {
        success: true,
        data: response
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send file/image attachment
   * @param {string} userId - Zalo user ID
   * @param {string} attachmentUrl - URL of the attachment
   * @param {string} attachmentType - 'image', 'file', 'video'
   * @returns {Promise<object>} - Send result
   */
  async sendAttachment(userId, attachmentUrl, attachmentType = 'image') {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!attachmentUrl) {
      throw new Error('Attachment URL is required');
    }

    if (this.config.testMode) {
      return {
        success: true,
        data: {
          uid: userId,
          attachmentType,
          attachmentUrl,
          messageId: `MSG_${Date.now()}`,
          testMode: true
        },
        message: 'Attachment sent successfully (test mode)'
      };
    }

    try {
      const endpoint = `${this.config.apiBaseUrl}/me/message`;

      const payload = {
        uid: userId,
        attachment: {
          type: attachmentType,
          url: attachmentUrl
        }
      };

      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      return {
        success: true,
        data: response
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send invoice PDF attachment
   * @param {string} userId - Zalo user ID
   * @param {string} invoicePdfUrl - URL of the invoice PDF
   * @returns {Promise<object>} - Send result
   */
  async sendInvoicePDF(userId, invoicePdfUrl) {
    return this.sendAttachment(userId, invoicePdfUrl, 'file');
  }

  /**
   * Get message delivery status
   * @param {string} messageId - Message ID
   * @returns {Promise<object>} - Delivery status
   */
  async getMessageStatus(messageId) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    if (this.config.testMode) {
      return {
        success: true,
        data: {
          messageId,
          status: 'delivered',
          deliveredAt: new Date().toISOString(),
          testMode: true
        }
      };
    }

    try {
      const endpoint = `${this.config.apiBaseUrl}/message/${messageId}`;
      const response = await this.makeRequest(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`
        }
      });

      return {
        success: true,
        data: response
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify webhook signature from Zalo
   * @param {string} signature - Webhook signature
   * @param {string} body - Raw request body
   * @returns {boolean} - True if signature is valid
   */
  verifyWebhookSignature(signature, body) {
    // Zalo webhook signature verification
    // In production, implement proper HMAC verification
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.appSecret)
      .update(body)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Process incoming webhook
   * @param {object} payload - Webhook payload
   * @returns {object} - Processed event
   */
  processWebhook(payload) {
    const { event, message } = payload;

    if (event === 'user_send_text') {
      return {
        type: 'text_message',
        userId: message.fromuid,
        content: message.text,
        timestamp: message.timestamp
      };
    }

    if (event === 'user_send_image') {
      return {
        type: 'image_message',
        userId: message.fromuid,
        mediaId: message.media_id,
        timestamp: message.timestamp
      };
    }

    if (event === 'follow') {
      return {
        type: 'follow',
        userId: payload.follower?.uid,
        timestamp: payload.timestamp
      };
    }

    if (event === 'unfollow') {
      return {
        type: 'unfollow',
        userId: payload.follower?.uid,
        timestamp: payload.timestamp
      };
    }

    return {
      type: 'unknown',
      raw: payload
    };
  }

  /**
   * Mock send message for testing
   * @param {string} userId - User ID
   * @param {string} message - Message text
   * @param {string} type - Message type
   * @returns {Promise<object>} - Mock result
   */
  async mockSendMessage(userId, message, type) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay

    return {
      success: true,
      data: {
        uid: userId,
        message: message,
        type: type,
        messageId: `MSG_${Date.now()}`,
        status: 'sent',
        sentAt: new Date().toISOString(),
        testMode: true
      },
      message: 'Message sent successfully (test mode)'
    };
  }

  /**
   * Make API request
   * @param {string} url - Request URL
   * @param {object} options - Request options
   * @returns {Promise<object>} - Response data
   */
  async makeRequest(url, options = {}) {
    // In production, implement actual HTTP request
    // For now, throw error indicating production implementation needed
    throw new Error('Production Zalo API not implemented. Set testMode=true for development.');
  }

  /**
   * Format currency for display
   * @param {number} amount - Amount to format
   * @returns {string} - Formatted amount
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' VND';
  }

  /**
   * Get available message templates
   * @returns {Array} - List of templates
   */
  getTemplates() {
    return Object.entries(this.templates).map(([key, template]) => ({
      key,
      ...template
    }));
  }

  /**
   * Check if service is configured
   * @returns {boolean} - True if properly configured
   */
  isConfigured() {
    return !!(this.config.appId && this.config.appSecret);
  }

  /**
   * Get service status
   * @returns {object} - Status information
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      testMode: this.config.testMode,
      apiUrl: this.config.apiBaseUrl,
      templates: Object.keys(this.templates).length,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ZaloIntegrationService;