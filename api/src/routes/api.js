const express = require('express');
const router = express.Router();
const { contactOps, planOps, subscriptionOps, employeeOps, taskOps } = require('../data/store');

// Validation helpers
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePhone = (phone) => {
  if (!phone) return true; // Optional
  const re = /^[0-9\s\-\+\(\)]{8,}$/;
  return re.test(phone);
};

// ============================================
// CONTACT ROUTES
// ============================================

// POST /api/contacts - Submit contact form
router.post('/contacts', (req, res) => {
  try {
    const { name, company, email, phone, plan, message } = req.body;

    // Validation
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name is required (min 2 characters)' });
    }
    if (!company || company.trim().length < 2) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!validatePhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const contact = contactOps.create({
      name: name.trim(),
      company: company.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : null,
      plan: plan || null,
      message: message ? message.trim() : null
    });

    res.status(201).json({
      success: true,
      data: contact,
      message: 'Contact form submitted successfully'
    });
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to submit contact form' });
  }
});

// GET /api/contacts - List all contacts (with optional filters)
router.get('/contacts', (req, res) => {
  try {
    const { status } = req.query;
    const contacts = contactOps.findAll({ status });
    res.json({ success: true, data: contacts, count: contacts.length });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET /api/contacts/:id - Get contact by ID
router.get('/contacts/:id', (req, res) => {
  try {
    const contact = contactOps.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// PATCH /api/contacts/:id - Update contact status
router.patch('/contacts/:id', (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const contact = contactOps.update(req.params.id, { status });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// ============================================
// PLAN ROUTES
// ============================================

// GET /api/plans - List all available plans
router.get('/plans', (req, res) => {
  try {
    const plans = planOps.findAll();
    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// GET /api/plans/:id - Get plan by ID
router.get('/plans/:id', (req, res) => {
  try {
    const plan = planOps.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

// ============================================
// SUBSCRIPTION ROUTES
// ============================================

// POST /api/subscriptions - Create new subscription
router.post('/subscriptions', (req, res) => {
  try {
    const { contactId, planId } = req.body;

    if (!contactId) {
      return res.status(400).json({ error: 'Contact ID is required' });
    }
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    const contact = contactOps.findById(contactId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const plan = planOps.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const subscription = subscriptionOps.create({
      contactId,
      planId,
      planName: plan.name,
      price: plan.price
    });

    res.status(201).json({
      success: true,
      data: subscription,
      message: 'Subscription created successfully'
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// GET /api/subscriptions/:id - Get subscription by ID
router.get('/subscriptions/:id', (req, res) => {
  try {
    const subscription = subscriptionOps.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.json({ success: true, data: subscription });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// ============================================
// EMPLOYEE ROUTES
// ============================================

// POST /api/employees - Create new AI employee
router.post('/employees', (req, res) => {
  try {
    const { subscriptionId, name, role, config } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Employee name is required' });
    }

    const subscription = subscriptionOps.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Check employee limit based on plan
    const plan = planOps.findById(subscription.planId);
    const currentEmployees = employeeOps.findBySubscriptionId(subscriptionId);
    if (plan && currentEmployees.length >= plan.employeeCount) {
      return res.status(400).json({
        error: `Employee limit reached for ${plan.name} plan`,
        limit: plan.employeeCount,
        current: currentEmployees.length
      });
    }

    const employee = employeeOps.create({
      subscriptionId,
      name: name.trim(),
      role: role || 'general',
      config: config || {}
    });

    res.status(201).json({
      success: true,
      data: employee,
      message: 'Employee created successfully'
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// GET /api/employees - List all employees
router.get('/employees', (req, res) => {
  try {
    const employees = employeeOps.findAll();
    res.json({ success: true, data: employees, count: employees.length });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// GET /api/employees/:id - Get employee by ID
router.get('/employees/:id', (req, res) => {
  try {
    const employee = employeeOps.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ success: true, data: employee });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// PATCH /api/employees/:id - Update employee
router.patch('/employees/:id', (req, res) => {
  try {
    const { name, role, status, config } = req.body;
    const employee = employeeOps.update(req.params.id, { name, role, status, config });
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ success: true, data: employee });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// DELETE /api/employees/:id - Delete employee
router.delete('/employees/:id', (req, res) => {
  try {
    const deleted = employeeOps.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// ============================================
// TASK ROUTES
// ============================================

// POST /api/tasks - Create new task
router.post('/tasks', (req, res) => {
  try {
    const { employeeId, title, description, priority } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }
    if (!title || title.trim().length < 3) {
      return res.status(400).json({ error: 'Task title is required (min 3 characters)' });
    }

    const employee = employeeOps.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const task = taskOps.create({
      employeeId,
      title: title.trim(),
      description: description ? description.trim() : null,
      priority: priority || 'medium'
    });

    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /api/tasks - List all tasks (with optional filters)
router.get('/tasks', (req, res) => {
  try {
    const { status, employeeId } = req.query;
    const tasks = taskOps.findAll({ status, employeeId });
    res.json({ success: true, data: tasks, count: tasks.length });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/:id - Get task by ID
router.get('/tasks/:id', (req, res) => {
  try {
    const task = taskOps.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// PATCH /api/tasks/:id - Update task
router.patch('/tasks/:id', (req, res) => {
  try {
    const { status, title, description, priority } = req.body;
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const task = taskOps.update(req.params.id, { status, title, description, priority });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// ============================================
// METRICS ROUTES
// ============================================

// GET /api/metrics - Get system metrics
router.get('/metrics', (req, res) => {
  try {
    const totalContacts = contactOps.findAll().length;
    const newContacts = contactOps.findAll({ status: 'new' }).length;
    const totalEmployees = employeeOps.findAll().length;
    const totalTasks = taskOps.findAll().length;
    const pendingTasks = taskOps.findAll({ status: 'pending' }).length;
    const completedTasks = taskOps.findAll({ status: 'completed' }).length;

    res.json({
      success: true,
      data: {
        contacts: { total: totalContacts, new: newContacts },
        employees: { total: totalEmployees },
        tasks: {
          total: totalTasks,
          pending: pendingTasks,
          completed: completedTasks,
          completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// ============================================
// STATUS ROUTES
// ============================================

// GET /api/status - Service status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'AIEmployee API',
      version: '1.0.0',
      status: 'operational',
      timestamp: new Date().toISOString()
    }
  });
});

// ============================================
// INVOICE ROUTES (TKP ACI Integration)
// ============================================

const VietnameseEInvoiceService = require('../services/einvoice');
const invoiceService = new VietnameseEInvoiceService();

// In-memory invoice store (in production, use database)
const invoices = [];

// POST /api/invoices - Create e-invoice
router.post('/invoices', async (req, res) => {
  try {
    const { seller, buyer, items, paymentMethod, dueDate } = req.body;

    // Validate required fields
    if (!seller || !seller.taxCode) {
      return res.status(400).json({ error: 'Seller tax code (MST) is required' });
    }
    if (!buyer || !buyer.taxCode) {
      return res.status(400).json({ error: 'Buyer tax code (MST) is required' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    const orderData = { seller, buyer, items, paymentMethod, dueDate };
    const invoiceData = invoiceService.createInvoiceData(orderData);
    const validation = invoiceService.validateInvoice(invoiceData);

    if (!validation.valid) {
      return res.status(400).json({ error: 'Invoice validation failed', details: validation.errors });
    }

    // Submit to portal (mock)
    const submissionResult = await invoiceService.submitToPortal(invoiceData);

    const invoice = {
      id: `INV-${Date.now()}`,
      invoiceNumber: invoiceData.invoice.invoiceNumber,
      status: submissionResult.status === 'SUCCESS' ? 'issued' : 'failed',
      portalInvoiceId: submissionResult.portalInvoiceId,
      invoiceCode: submissionResult.invoiceCode,
      data: invoiceData.invoice,
      createdAt: new Date().toISOString()
    };

    invoices.push(invoice);

    res.status(201).json({
      success: true,
      data: invoice,
      message: 'E-invoice created and submitted successfully'
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// GET /api/invoices - List all invoices
router.get('/invoices', (req, res) => {
  try {
    const { status, sellerTaxCode, buyerTaxCode } = req.query;
    let filtered = [...invoices];

    if (status) {
      filtered = filtered.filter(inv => inv.status === status);
    }
    if (sellerTaxCode) {
      filtered = filtered.filter(inv => inv.data.seller.taxCode === sellerTaxCode);
    }
    if (buyerTaxCode) {
      filtered = filtered.filter(inv => inv.data.buyer.taxCode === buyerTaxCode);
    }

    res.json({ success: true, data: filtered, count: filtered.length });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoices/:id - Get invoice by ID
router.get('/invoices/:id', (req, res) => {
  try {
    const invoice = invoices.find(inv => inv.id === req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST /api/webhooks/einvoice-status - Handle e-invoice status updates
router.post('/webhooks/einvoice-status', (req, res) => {
  try {
    const { invoiceCode, status, message, timestamp } = req.body;

    const invoice = invoices.find(inv => inv.invoiceCode === invoiceCode);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    invoice.data.status = status;
    invoice.data.statusMessage = message;
    invoice.data.statusTimestamp = timestamp;

    res.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// GET /api/invoices/lookup/taxcode/:taxCode - Lookup company by tax code
router.get('/invoices/lookup/taxcode/:taxCode', async (req, res) => {
  try {
    const company = await invoiceService.lookupByTaxCode(req.params.taxCode);
    if (!company) {
      return res.status(404).json({ error: 'Company not found for given tax code' });
    }
    res.json({ success: true, data: company });
  } catch (error) {
    console.error('Error looking up tax code:', error);
    res.status(500).json({ error: 'Failed to lookup tax code' });
  }
});

// ============================================
// VAT CALCULATOR ROUTES (COM-80)
// ============================================

const VATCalculatorService = require('../services/vatCalculator');
const vatCalculator = new VATCalculatorService();

// POST /api/vat/calculate - Calculate VAT from net amount
router.post('/vat/calculate', (req, res) => {
  try {
    const { netAmount, vatRate } = req.body;

    if (netAmount === undefined || netAmount === null) {
      return res.status(400).json({ error: 'netAmount is required' });
    }

    const result = vatCalculator.calculate(netAmount, vatRate);
    result.amountInWords = vatCalculator.amountToWords(result.grossAmount);
    result.formattedNet = vatCalculator.formatCurrency(result.netAmount);
    result.formattedVat = vatCalculator.formatCurrency(result.vatAmount);
    result.formattedGross = vatCalculator.formatCurrency(result.grossAmount);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error calculating VAT:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/vat/calculate-from-gross - Calculate VAT from gross amount
router.post('/vat/calculate-from-gross', (req, res) => {
  try {
    const { grossAmount, vatRate } = req.body;

    if (grossAmount === undefined || grossAmount === null) {
      return res.status(400).json({ error: 'grossAmount is required' });
    }

    const result = vatCalculator.calculateFromGross(grossAmount, vatRate);
    result.amountInWords = vatCalculator.amountToWords(result.grossAmount);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error calculating VAT:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/vat/calculate-multiple - Calculate VAT for multiple items
router.post('/vat/calculate-multiple', (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const result = vatCalculator.calculateMultiple(items);
    result.totals.formattedNet = vatCalculator.formatCurrency(result.totals.totalNetAmount);
    result.totals.formattedVat = vatCalculator.formatCurrency(result.totals.totalVatAmount);
    result.totals.formattedGross = vatCalculator.formatCurrency(result.totals.totalGrossAmount);
    result.totals.amountInWords = vatCalculator.amountToWords(result.totals.totalGrossAmount);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error calculating VAT:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/vat/rates - Get supported VAT rates
router.get('/vat/rates', (req, res) => {
  res.json({ success: true, data: vatCalculator.getSupportedRates() });
});

// GET /api/vat/rate/:category - Get VAT rate for a category
router.get('/vat/rate/:category', (req, res) => {
  const rate = vatCalculator.getRateByCategory(req.params.category);
  const validation = vatCalculator.validateRateForCategory(rate, req.params.category);
  res.json({
    success: true,
    data: {
      category: req.params.category,
      rate: rate,
      ...validation
    }
  });
});

// ============================================
// INVOICE OCR ROUTES (COM-79)
// ============================================

const InvoiceOCRService = require('../services/invoiceOCR');
const invoiceOCR = new InvoiceOCRService();

// POST /api/ocr/invoice - Process invoice image/PDF with OCR
router.post('/ocr/invoice', async (req, res) => {
  try {
    const { fileData, fileType, options } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: 'fileData is required (base64 encoded or URL)' });
    }

    const result = await invoiceOCR.processInvoice(fileData, options || {});

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error processing OCR:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ocr/templates - Get OCR preprocessing options
router.get('/ocr/templates', (req, res) => {
  res.json({
    success: true,
    data: {
      supportedFormats: ['jpeg', 'png', 'pdf'],
      language: 'vi',
      extractTables: true,
      detectCurrency: true,
      validateTaxCode: true,
      validateInvoiceFormat: true
    }
  });
});

// ============================================
// TAX COMPLIANCE ROUTES (COM-81)
// ============================================

const TaxComplianceService = require('../services/taxCompliance');
const taxCompliance = new TaxComplianceService();

// POST /api/compliance/check - Check invoice compliance
router.post('/compliance/check', (req, res) => {
  try {
    const { invoice } = req.body;

    if (!invoice) {
      return res.status(400).json({ error: 'invoice data is required' });
    }

    const result = taxCompliance.checkInvoiceCompliance(invoice);

    res.json({
      success: true,
      data: result,
      report: taxCompliance.generateReport(result)
    });
  } catch (error) {
    console.error('Error checking compliance:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/compliance/validate-taxcode - Validate Vietnamese tax code
router.post('/compliance/validate-taxcode', (req, res) => {
  try {
    const { taxCode, entityType } = req.body;

    if (!taxCode) {
      return res.status(400).json({ error: 'taxCode is required' });
    }

    const result = taxCompliance.validateTaxCode(taxCode, entityType || 'Entity');

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error validating tax code:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/compliance/rules - Get compliance rules
router.get('/compliance/rules', (req, res) => {
  res.json({
    success: true,
    data: {
      circular: taxCompliance.config.circular68,
      allowedVatRates: taxCompliance.config.allowedVatRates,
      timingRules: taxCompliance.config.timingRules,
      taxCodeRules: taxCompliance.config.taxCodeRules
    }
  });
});

// ============================================
// ZALO INTEGRATION ROUTES (COM-82)
// ============================================

const ZaloIntegrationService = require('../services/zaloIntegration');
const zaloService = new ZaloIntegrationService({ testMode: true });

// ============================================
// DATA QUALITY ROUTES (COM-102 / COM-200)
// ============================================

const DataQualityService = require('../services/dataQuality');
const dataQuality = new DataQualityService();

// POST /api/quality/validate - Validate input data against rules
router.post('/quality/validate', (req, res) => {
  try {
    const { data, rules } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'data is required' });
    }
    if (!rules) {
      return res.status(400).json({ error: 'rules is required' });
    }

    const result = dataQuality.validateInput(data, rules);

    res.json({
      success: true,
      data: result,
      message: result.valid ? 'Validation passed' : 'Validation failed'
    });
  } catch (error) {
    console.error('Error validating data:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/quality/validate/schema - Validate data against JSON Schema
router.post('/quality/validate/schema', (req, res) => {
  try {
    const { data, schema } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'data is required' });
    }
    if (!schema) {
      return res.status(400).json({ error: 'schema is required' });
    }

    const result = dataQuality.validateSchema(data, schema);

    res.json({
      success: true,
      data: result,
      message: result.valid ? 'Schema validation passed' : 'Schema validation failed'
    });
  } catch (error) {
    console.error('Error validating schema:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/quality/normalize - Normalize data
router.post('/quality/normalize', (req, res) => {
  try {
    const { data, rules } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'data is required' });
    }

    const normalized = rules
      ? dataQuality.normalizeRecord(data, rules)
      : dataQuality.normalizeRecord(data, {
          email: { trim: true, toLowerCase: true },
          phone: { trim: true, standardizePhone: true }
        });

    res.json({
      success: true,
      data: { normalized },
      message: 'Data normalized successfully'
    });
  } catch (error) {
    console.error('Error normalizing data:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/quality/freshness - Check data freshness
router.post('/quality/freshness', (req, res) => {
  try {
    const { data, options } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'data is required' });
    }

    const result = dataQuality.checkFreshness(data, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking freshness:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/quality/freshness/batch - Batch freshness check
router.post('/quality/freshness/batch', (req, res) => {
  try {
    const { items, options } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const results = dataQuality.checkBatchFreshness(items, options);

    res.json({
      success: true,
      data: {
        results,
        summary: {
          fresh: results.filter(r => r.isFresh).length,
          stale: results.filter(r => !r.isFresh).length,
          total: results.length
        }
      }
    });
  } catch (error) {
    console.error('Error checking batch freshness:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/quality/duplicate - Check for duplicates
router.post('/quality/duplicate', (req, res) => {
  try {
    const { data, keyFields, options } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'data is required' });
    }

    const result = dataQuality.checkDuplicate(data, { keyFields, ...options });

    res.json({
      success: true,
      data: result,
      message: result.isDuplicate ? 'Duplicate detected' : 'No duplicate found'
    });
  } catch (error) {
    console.error('Error checking duplicate:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/quality/duplicate/find - Find duplicates in dataset
router.post('/quality/duplicate/find', (req, res) => {
  try {
    const { items, keyFields } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const result = dataQuality.findDuplicatesInDataset(items, keyFields);

    res.json({
      success: true,
      data: result,
      message: `Found ${result.count} duplicate(s)`
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/quality/duplicate/cache - Clear duplicate detection cache
router.delete('/quality/duplicate/cache', (req, res) => {
  dataQuality.clearDuplicateCache();
  res.json({
    success: true,
    message: 'Duplicate detection cache cleared'
  });
});

// GET /api/quality/status - Get data quality service status
router.get('/quality/status', (req, res) => {
  res.json({
    success: true,
    data: dataQuality.getStatus()
  });
});

// GET /api/quality/types - Get supported validation types
router.get('/quality/types', (req, res) => {
  res.json({
    success: true,
    data: {
      types: dataQuality.getSupportedTypes(),
      formats: dataQuality.getSupportedFormats()
    }
  });
});

// GET /api/zalo/status - Get Zalo service status
router.get('/zalo/status', (req, res) => {
  res.json({ success: true, data: zaloService.getStatus() });
});

// GET /api/zalo/templates - Get available message templates
router.get('/zalo/templates', (req, res) => {
  res.json({ success: true, data: zaloService.getTemplates() });
});

// POST /zalo/message - Send Zalo message
router.post('/zalo/message', async (req, res) => {
  try {
    const { userId, message, templateId, templateData, type } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const result = await zaloService.sendMessage({ userId, message, templateId, templateData, type });
    res.json(result);
  } catch (error) {
    console.error('Error sending Zalo message:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /zalo/message/text - Send text message
router.post('/zalo/message/text', async (req, res) => {
  try {
    const { userId, text } = req.body;

    if (!userId || !text) {
      return res.status(400).json({ error: 'userId and text are required' });
    }

    const result = await zaloService.sendTextMessage(userId, text);
    res.json(result);
  } catch (error) {
    console.error('Error sending text message:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /zalo/message/template - Send template message
router.post('/zalo/message/template', async (req, res) => {
  try {
    const { userId, templateId, templateData } = req.body;

    if (!userId || !templateId) {
      return res.status(400).json({ error: 'userId and templateId are required' });
    }

    const result = await zaloService.sendTemplateMessage(userId, templateId, templateData);
    res.json(result);
  } catch (error) {
    console.error('Error sending template message:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /zalo/notification/invoice - Send invoice notification
router.post('/zalo/notification/invoice', async (req, res) => {
  try {
    const { invoice, userId } = req.body;

    if (!userId || !invoice) {
      return res.status(400).json({ error: 'userId and invoice are required' });
    }

    const result = await zaloService.sendInvoiceNotification(invoice, userId);
    res.json(result);
  } catch (error) {
    console.error('Error sending invoice notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /zalo/notification/payment - Send payment confirmation
router.post('/zalo/notification/payment', async (req, res) => {
  try {
    const { payment, userId } = req.body;

    if (!userId || !payment) {
      return res.status(400).json({ error: 'userId and payment are required' });
    }

    const result = await zaloService.sendPaymentConfirmation(payment, userId);
    res.json(result);
  } catch (error) {
    console.error('Error sending payment notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /zalo/notification/reminder - Send payment reminder
router.post('/zalo/notification/reminder', async (req, res) => {
  try {
    const { reminder, userId } = req.body;

    if (!userId || !reminder) {
      return res.status(400).json({ error: 'userId and reminder are required' });
    }

    const result = await zaloService.sendPaymentReminder(reminder, userId);
    res.json(result);
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /zalo/webhook - Process Zalo webhook
router.post('/zalo/webhook', (req, res) => {
  try {
    const event = zaloService.processWebhook(req.body);
    res.json({ success: true, event: event });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ALERTING ROUTES (COM-201)
// ============================================

const AlertingService = require('../services/alerting');
const alertingService = new AlertingService();

// POST /api/alerts - Create a new alert
router.post('/alerts', (req, res) => {
  try {
    const { title, message, level, source, metadata, tags } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (!level) {
      return res.status(400).json({ error: 'level is required (critical, alert, warning)' });
    }

    const alert = alertingService.createAlert({ title, message, level, source, metadata, tags });

    res.status(201).json({
      success: true,
      data: alert,
      message: 'Alert created successfully'
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/alerts - List all alerts with filtering
router.get('/alerts', (req, res) => {
  try {
    const { level, status, source, tags, fromDate, toDate, limit, offset } = req.query;

    const filters = {};
    if (level) filters.level = level;
    if (status) filters.status = status;
    if (source) filters.source = source;
    if (tags) filters.tags = tags.split(',');
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const result = alertingService.getAlerts(filters);

    res.json({
      success: true,
      data: result.alerts,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/stats - Get alert statistics
router.get('/alerts/stats', (req, res) => {
  try {
    const stats = alertingService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/active - Get active alerts
router.get('/alerts/active', (req, res) => {
  try {
    const alerts = alertingService.getActiveAlerts();
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('Error fetching active alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/:id - Get alert by ID
router.get('/alerts/:id', (req, res) => {
  try {
    const alert = alertingService.getAlert(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ success: true, data: alert });
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/alerts/:id - Update alert
router.patch('/alerts/:id', (req, res) => {
  try {
    const { title, message, level, source, metadata, tags } = req.body;

    const alert = alertingService.updateAlert(req.params.id, {
      title, message, level, source, metadata, tags
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({
      success: true,
      data: alert,
      message: 'Alert updated successfully'
    });
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/alerts/:id/acknowledge - Acknowledge alert
router.post('/alerts/:id/acknowledge', (req, res) => {
  try {
    const { acknowledgedBy } = req.body;
    const alert = alertingService.acknowledgeAlert(req.params.id, acknowledgedBy);
    res.json({
      success: true,
      data: alert,
      message: 'Alert acknowledged'
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/alerts/:id/resolve - Resolve alert
router.post('/alerts/:id/resolve', (req, res) => {
  try {
    const { resolvedBy, resolutionNote } = req.body;
    const alert = alertingService.resolveAlert(req.params.id, resolvedBy, resolutionNote);
    res.json({
      success: true,
      data: alert,
      message: 'Alert resolved'
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/alerts/:id/escalate - Escalate alert
router.post('/alerts/:id/escalate', (req, res) => {
  try {
    const alert = alertingService.escalateAlert(req.params.id);
    res.json({
      success: true,
      data: alert,
      message: 'Alert escalated'
    });
  } catch (error) {
    console.error('Error escalating alert:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/alerts/:id/comments - Add comment to alert
router.post('/alerts/:id/comments', (req, res) => {
  try {
    const { comment, author } = req.body;
    if (!comment) {
      return res.status(400).json({ error: 'comment is required' });
    }

    const alert = alertingService.addComment(req.params.id, comment, author);
    res.json({
      success: true,
      data: alert,
      message: 'Comment added'
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/alerts/:id/history - Get alert history
router.get('/alerts/:id/history', (req, res) => {
  try {
    const history = alertingService.getAlertHistory(req.params.id);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching alert history:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/alerts/:id - Delete alert
router.delete('/alerts/:id', (req, res) => {
  try {
    alertingService.deleteAlert(req.params.id);
    res.json({
      success: true,
      message: 'Alert deleted'
    });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/alerts/bulk/acknowledge - Bulk acknowledge
router.post('/alerts/bulk/acknowledge', (req, res) => {
  try {
    const { alertIds, acknowledgedBy } = req.body;
    if (!alertIds || !Array.isArray(alertIds)) {
      return res.status(400).json({ error: 'alertIds array is required' });
    }

    const results = alertingService.bulkAcknowledge(alertIds, acknowledgedBy);
    res.json({
      success: true,
      data: results,
      summary: {
        total: results.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error) {
    console.error('Error bulk acknowledging:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/bulk/resolve - Bulk resolve
router.post('/alerts/bulk/resolve', (req, res) => {
  try {
    const { alertIds, resolvedBy, resolutionNote } = req.body;
    if (!alertIds || !Array.isArray(alertIds)) {
      return res.status(400).json({ error: 'alertIds array is required' });
    }

    const results = alertingService.bulkResolve(alertIds, resolvedBy, resolutionNote);
    res.json({
      success: true,
      data: results,
      summary: {
        total: results.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error) {
    console.error('Error bulk resolving:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/levels - Get alert levels
router.get('/alerts/levels', (req, res) => {
  res.json({
    success: true,
    data: alertingService.getLevels()
  });
});

// GET /api/alerts/export - Export alerts
router.get('/alerts/export', (req, res) => {
  try {
    const { format, level, status } = req.query;
    const filters = {};
    if (level) filters.level = level;
    if (status) filters.status = status;

    const data = alertingService.exportAlerts(format || 'json', filters);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=alerts.csv');
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error exporting alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/webhooks - Register webhook
router.post('/alerts/webhooks', (req, res) => {
  try {
    const { url, events } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    const webhook = alertingService.registerWebhook(url, events || ['all']);
    res.status(201).json({
      success: true,
      data: webhook,
      message: 'Webhook registered'
    });
  } catch (error) {
    console.error('Error registering webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/webhooks - List webhooks
router.get('/alerts/webhooks', (req, res) => {
  res.json({
    success: true,
    data: alertingService.getWebhooks()
  });
});

// DELETE /api/alerts/webhooks/:id - Remove webhook
router.delete('/alerts/webhooks/:id', (req, res) => {
  try {
    alertingService.removeWebhook(req.params.id);
    res.json({
      success: true,
      message: 'Webhook removed'
    });
  } catch (error) {
    console.error('Error removing webhook:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/alerts/cleanup - Cleanup old alerts
router.delete('/alerts/cleanup', (req, res) => {
  try {
    const { olderThanDays } = req.body;
    const result = alertingService.cleanup(olderThanDays || 30);
    res.json({
      success: true,
      data: result,
      message: `Cleaned up ${result.deleted} alerts`
    });
  } catch (error) {
    console.error('Error cleaning up alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/status - Get alerting service status
router.get('/alerts/status', (req, res) => {
  res.json({
    success: true,
    data: alertingService.getStatus()
  });
});

// ============================================
// BACKUP ROUTES (COM-204)
// 3-2-1 Strategy: 3 copies, 2 media types, 1 offsite
// ============================================

const BackupService = require('../services/backup');
const backupService = new BackupService();

// POST /api/backups - Create a full backup
router.post('/backups', (req, res) => {
  try {
    const { data, metadata } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'data is required' });
    }

    const backup = backupService.createFullBackup(data, metadata);

    res.status(201).json({
      success: true,
      data: backup,
      message: 'Full backup created successfully'
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/backups/incremental - Create incremental backup
router.post('/backups/incremental', (req, res) => {
  try {
    const { data, baseBackupId, metadata } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'data is required' });
    }
    if (!baseBackupId) {
      return res.status(400).json({ error: 'baseBackupId is required' });
    }

    const backup = backupService.createIncrementalBackup(data, baseBackupId, metadata);

    res.status(201).json({
      success: true,
      data: backup,
      message: 'Incremental backup created successfully'
    });
  } catch (error) {
    console.error('Error creating incremental backup:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/backups/differential - Create differential backup
router.post('/backups/differential', (req, res) => {
  try {
    const { data, baseBackupId, metadata } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'data is required' });
    }
    if (!baseBackupId) {
      return res.status(400).json({ error: 'baseBackupId is required' });
    }

    const backup = backupService.createDifferentialBackup(data, baseBackupId, metadata);

    res.status(201).json({
      success: true,
      data: backup,
      message: 'Differential backup created successfully'
    });
  } catch (error) {
    console.error('Error creating differential backup:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/backups - List all backups
router.get('/backups', (req, res) => {
  try {
    const { type, status, fromDate, toDate, limit, offset } = req.query;

    const filters = {};
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const result = backupService.getBackups(filters);

    res.json({
      success: true,
      data: result.backups,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore
      }
    });
  } catch (error) {
    console.error('Error fetching backups:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/backups/stats - Get backup statistics
router.get('/backups/stats', (req, res) => {
  try {
    const stats = backupService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/backups/:id - Get backup by ID
router.get('/backups/:id', (req, res) => {
  try {
    const backup = backupService.getBackup(req.params.id);
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    res.json({ success: true, data: backup });
  } catch (error) {
    console.error('Error fetching backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/backups/:id/restore - Restore from backup
router.post('/backups/:id/restore', (req, res) => {
  try {
    const result = backupService.restore(req.params.id);
    res.json({
      success: true,
      data: result,
      message: 'Backup restored successfully'
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/backups/:id/verify - Verify backup integrity
router.get('/backups/:id/verify', (req, res) => {
  try {
    const verification = backupService.verifyBackup(req.params.id);
    res.json({
      success: true,
      data: verification,
      message: verification.status === 'verified' ? 'Backup verified' : 'Backup verification failed'
    });
  } catch (error) {
    console.error('Error verifying backup:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/backups/:id - Delete backup
router.delete('/backups/:id', (req, res) => {
  try {
    const result = backupService.deleteBackup(req.params.id);
    res.json({
      success: true,
      message: 'Backup deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/backups/cleanup - Cleanup expired backups
router.post('/backups/cleanup', (req, res) => {
  try {
    const result = backupService.cleanup();
    res.json({
      success: true,
      data: result,
      message: `Cleanup complete: ${result.deleted} backups deleted`
    });
  } catch (error) {
    console.error('Error cleaning up backups:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/backups/schedule - Get backup schedule
router.get('/backups/schedule', (req, res) => {
  res.json({
    success: true,
    data: backupService.getSchedule()
  });
});

// GET /api/backups/config - Get backup configuration
router.get('/backups/config', (req, res) => {
  res.json({
    success: true,
    data: backupService.getConfig()
  });
});

// PATCH /api/backups/config - Update backup configuration
router.patch('/backups/config', (req, res) => {
  try {
    const { retention, schedule, compression, encryption } = req.body;
    const updated = backupService.updateConfig({ retention, schedule, compression, encryption });
    res.json({
      success: true,
      data: updated,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/backups/status - Get backup service status
router.get('/backups/status', (req, res) => {
  res.json({
    success: true,
    data: backupService.getStatus()
  });
});

// ============================================
// HEALTH CHECK & HEARTBEAT ROUTES (COM-119)
// ============================================

const HealthCheckService = require('../services/healthCheck');
const healthCheck = new HealthCheckService();

// GET /api/health - Basic health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

// GET /api/health/detailed - Detailed system health
router.get('/health/detailed', (req, res) => {
  try {
    const health = healthCheck.getDetailedHealth();
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error fetching health:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/health/services - List all monitored services
router.get('/health/services', (req, res) => {
  try {
    const services = [];
    for (const [id, service] of healthCheck.services) {
      services.push({
        id,
        name: service.name,
        status: service.status,
        type: service.type,
        lastCheck: service.lastCheck,
        responseTime: service.responseTime,
        consecutiveFailures: service.consecutiveFailures
      });
    }
    res.json({
      success: true,
      data: services,
      count: services.length
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/health/services/:id - Get specific service health
router.get('/health/services/:id', (req, res) => {
  try {
    const result = healthCheck.checkService(req.params.id);
    if (result.status === 'unknown') {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking service:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/health/heartbeat/:serviceId - Record a heartbeat
router.post('/health/heartbeat/:serviceId', (req, res) => {
  try {
    const { metadata } = req.body;
    const heartbeat = healthCheck.recordHeartbeat(req.params.serviceId, metadata || {});
    res.json({
      success: true,
      data: heartbeat,
      message: 'Heartbeat recorded'
    });
  } catch (error) {
    console.error('Error recording heartbeat:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/health/heartbeats - List all heartbeats
router.get('/health/heartbeats', (req, res) => {
  try {
    const heartbeats = [];
    for (const [serviceId, hb] of healthCheck.heartbeats) {
      heartbeats.push({
        serviceId,
        lastHeartbeat: hb.lastHeartbeat,
        interval: hb.interval,
        consecutiveMissed: hb.consecutiveMissed,
        isAlive: healthCheck.isServiceAlive(serviceId)
      });
    }
    res.json({
      success: true,
      data: heartbeats,
      count: heartbeats.length
    });
  } catch (error) {
    console.error('Error fetching heartbeats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/health/unhealthy - Get unhealthy services
router.get('/health/unhealthy', (req, res) => {
  try {
    const unhealthy = healthCheck.getUnhealthyServices();
    res.json({
      success: true,
      data: unhealthy,
      count: unhealthy.length
    });
  } catch (error) {
    console.error('Error fetching unhealthy services:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/health/services/:id/reset - Reset service health
router.post('/health/services/:id/reset', (req, res) => {
  try {
    const success = healthCheck.resetServiceHealth(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json({
      success: true,
      message: 'Service health reset'
    });
  } catch (error) {
    console.error('Error resetting service health:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/health/check - Trigger full health check
router.post('/health/check', async (req, res) => {
  try {
    const results = await healthCheck.checkAllServices();
    const systemHealth = healthCheck.getSystemHealth();
    res.json({
      success: true,
      data: {
        results,
        system: systemHealth
      }
    });
  } catch (error) {
    console.error('Error performing health check:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/health/status - Get health service status
router.get('/health/status', (req, res) => {
  res.json({
    success: true,
    data: healthCheck.getStatus()
  });
});

// ============================================
// CIRCUIT BREAKER ROUTES (COM-120)
// ============================================

const { CircuitBreakerService, CircuitOpenError } = require('../services/circuitBreaker');
const circuitBreaker = new CircuitBreakerService();

// GET /api/circuit-breaker - Get all circuits
router.get('/circuit-breaker', (req, res) => {
  try {
    const circuits = circuitBreaker.getAllCircuits();
    const health = circuitBreaker.getHealthSummary();
    res.json({
      success: true,
      data: {
        circuits,
        health
      }
    });
  } catch (error) {
    console.error('Error fetching circuits:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/circuit-breaker/:serviceName - Get specific circuit
router.get('/circuit-breaker/:serviceName', (req, res) => {
  try {
    const status = circuitBreaker.getStatus(req.params.serviceName);
    if (!status) {
      return res.status(404).json({ error: 'Circuit not found' });
    }
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching circuit:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/circuit-breaker/:serviceName/execute - Execute with circuit breaker
router.post('/circuit-breaker/:serviceName/execute', async (req, res) => {
  try {
    const { fn, config } = req.body;
    if (!fn) {
      return res.status(400).json({ error: 'fn (function) is required' });
    }

    // Note: In real usage, fn would be executed on server
    // Here we provide a mock response for demonstration
    const result = await circuitBreaker.execute(req.params.serviceName, async () => {
      return { success: true, message: 'Function executed', fnResult: fn };
    }, config);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      return res.status(503).json({
        success: false,
        error: error.message,
        serviceName: error.serviceName,
        retryAfter: error.retryAfter
      });
    }
    console.error('Error executing with circuit breaker:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/circuit-breaker/:serviceName/history - Get circuit history
router.get('/circuit-breaker/:serviceName/history', (req, res) => {
  try {
    const { limit } = req.query;
    const history = circuitBreaker.getHistory(req.params.serviceName, parseInt(limit) || 50);
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/circuit-breaker/:serviceName/trip - Manually trip a circuit
router.post('/circuit-breaker/:serviceName/trip', (req, res) => {
  try {
    const success = circuitBreaker.trip(req.params.serviceName);
    if (!success) {
      return res.status(404).json({ error: 'Circuit not found' });
    }
    res.json({
      success: true,
      message: 'Circuit tripped'
    });
  } catch (error) {
    console.error('Error tripping circuit:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/circuit-breaker/:serviceName/reset - Reset a circuit
router.post('/circuit-breaker/:serviceName/reset', (req, res) => {
  try {
    const success = circuitBreaker.reset(req.params.serviceName);
    if (!success) {
      return res.status(404).json({ error: 'Circuit not found' });
    }
    res.json({
      success: true,
      message: 'Circuit reset'
    });
  } catch (error) {
    console.error('Error resetting circuit:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/circuit-breaker/:serviceName - Remove a circuit
router.delete('/circuit-breaker/:serviceName', (req, res) => {
  try {
    const success = circuitBreaker.remove(req.params.serviceName);
    if (!success) {
      return res.status(404).json({ error: 'Circuit not found' });
    }
    res.json({
      success: true,
      message: 'Circuit removed'
    });
  } catch (error) {
    console.error('Error removing circuit:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/circuit-breaker/status - Get circuit breaker service status
router.get('/circuit-breaker/status', (req, res) => {
  res.json({
    success: true,
    data: circuitBreaker.getServiceStatus()
  });
});

// ============================================
// AUTO-RECOVERY ROUTES (COM-121)
// ============================================

const AutoRecoveryService = require('../services/autoRecovery');
const autoRecovery = new AutoRecoveryService();

// GET /api/recovery/strategies - Get all recovery strategies
router.get('/recovery/strategies', (req, res) => {
  try {
    const strategies = autoRecovery.getStrategies();
    res.json({
      success: true,
      data: strategies,
      count: strategies.length
    });
  } catch (error) {
    console.error('Error fetching strategies:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/recovery/strategies - Register a new recovery strategy
router.post('/recovery/strategies', (req, res) => {
  try {
    const { id, name, maxRetries, retryDelay, backoffMultiplier, strategies } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Strategy ID is required' });
    }

    autoRecovery.registerStrategy(id, {
      name: name || id,
      maxRetries,
      retryDelay,
      backoffMultiplier,
      strategies
    });

    res.status(201).json({
      success: true,
      message: 'Strategy registered',
      data: autoRecovery.recoveryStrategies.get(id)
    });
  } catch (error) {
    console.error('Error registering strategy:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/recovery/tasks - Get active recovery tasks
router.get('/recovery/tasks', (req, res) => {
  try {
    const tasks = autoRecovery.getActiveTasks();
    res.json({
      success: true,
      data: tasks,
      count: tasks.length
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/recovery/tasks/:taskId - Get specific recovery task
router.get('/recovery/tasks/:taskId', (req, res) => {
  try {
    const task = autoRecovery.getTaskStatus(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/recovery/tasks/:taskId/cancel - Cancel a recovery task
router.post('/recovery/tasks/:taskId/cancel', (req, res) => {
  try {
    const success = autoRecovery.cancelTask(req.params.taskId);
    if (!success) {
      return res.status(400).json({ error: 'Task cannot be cancelled' });
    }
    res.json({
      success: true,
      message: 'Task cancelled'
    });
  } catch (error) {
    console.error('Error cancelling task:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/recovery/dead-letter - Get dead letter queue
router.get('/recovery/dead-letter', (req, res) => {
  try {
    const { limit } = req.query;
    const queue = autoRecovery.getDeadLetterQueue(parseInt(limit) || 50);
    res.json({
      success: true,
      data: queue,
      count: queue.length
    });
  } catch (error) {
    console.error('Error fetching dead letter queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/recovery/dead-letter/:taskId/retry - Retry a dead letter task
router.post('/recovery/dead-letter/:taskId/retry', async (req, res) => {
  try {
    const result = await autoRecovery.retryDeadLetter(req.params.taskId);
    res.json({
      success: true,
      data: result,
      message: 'Task retried successfully'
    });
  } catch (error) {
    console.error('Error retrying task:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/recovery/dead-letter - Clear dead letter queue
router.delete('/recovery/dead-letter', (req, res) => {
  try {
    const count = autoRecovery.clearDeadLetterQueue();
    res.json({
      success: true,
      message: `Dead letter queue cleared (${count} items)`
    });
  } catch (error) {
    console.error('Error clearing dead letter queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/recovery/execute - Execute recovery for an operation
router.post('/recovery/execute', async (req, res) => {
  try {
    const { strategyId, context } = req.body;

    if (!strategyId) {
      return res.status(400).json({ error: 'strategyId is required' });
    }

    // Create a recovery function that simulates the failed operation
    // In real usage, the actual failed operation would be passed
    const failedOperation = async () => {
      // Mock failed operation that will be retried
      return { recovered: true, timestamp: new Date().toISOString() };
    };

    const result = await autoRecovery.executeRecovery(strategyId, failedOperation, context);

    res.json({
      success: true,
      data: result,
      message: 'Recovery executed'
    });
  } catch (error) {
    console.error('Error executing recovery:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/recovery/stats - Get recovery statistics
router.get('/recovery/stats', (req, res) => {
  try {
    const stats = autoRecovery.getStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/recovery/status - Get auto-recovery service status
router.get('/recovery/status', (req, res) => {
  res.json({
    success: true,
    data: autoRecovery.getStatus()
  });
});

// ============================================
// DASHBOARD ANALYTICS ROUTES (COM-111)
// KPI Aggregation Endpoints for Dashboard
// ============================================

const DashboardAnalyticsService = require('../services/dashboardAnalytics');
const dashboardAnalytics = new DashboardAnalyticsService();

// GET /api/dashboard/overview - Get full dashboard overview
router.get('/dashboard/overview', (req, res) => {
  try {
    const overview = dashboardAnalytics.getDashboardOverview();
    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/kpis - Get KPI cards for dashboard
router.get('/dashboard/kpis', (req, res) => {
  try {
    const kpis = dashboardAnalytics.getKPICards();
    res.json({
      success: true,
      data: kpis
    });
  } catch (error) {
    console.error('Error fetching KPI cards:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/mrr - Get MRR (Monthly Recurring Revenue)
router.get('/dashboard/mrr', (req, res) => {
  try {
    const mrr = dashboardAnalytics.calculateMRR();
    res.json({
      success: true,
      data: mrr
    });
  } catch (error) {
    console.error('Error fetching MRR:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/customers - Get active customers
router.get('/dashboard/customers', (req, res) => {
  try {
    const customers = dashboardAnalytics.getActiveCustomers();
    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/tasks - Get task metrics
router.get('/dashboard/tasks', (req, res) => {
  try {
    const tasks = dashboardAnalytics.getTaskMetrics();
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Error fetching task metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/plans - Get plan distribution
router.get('/dashboard/plans', (req, res) => {
  try {
    const plans = dashboardAnalytics.getPlanDistribution();
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error fetching plan distribution:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/funnel - Get contact funnel
router.get('/dashboard/funnel', (req, res) => {
  try {
    const funnel = dashboardAnalytics.getContactFunnel();
    res.json({
      success: true,
      data: funnel
    });
  } catch (error) {
    console.error('Error fetching contact funnel:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/revenue-trends - Get revenue trends
router.get('/dashboard/revenue-trends', (req, res) => {
  try {
    const { days } = req.query;
    const trends = dashboardAnalytics.getRevenueTrends(parseInt(days) || 7);
    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Error fetching revenue trends:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/employees - Get employee utilization
router.get('/dashboard/employees', (req, res) => {
  try {
    const employees = dashboardAnalytics.getEmployeeUtilization();
    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    console.error('Error fetching employee utilization:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/charts - Get chart data for visualizations
router.get('/dashboard/charts', (req, res) => {
  try {
    const charts = dashboardAnalytics.getChartData();
    res.json({
      success: true,
      data: charts
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/dashboard/cache - Clear dashboard cache
router.delete('/dashboard/cache', (req, res) => {
  dashboardAnalytics.clearCache();
  res.json({
    success: true,
    message: 'Dashboard cache cleared'
  });
});

// GET /api/dashboard/activity/recent - Get recent activity feed
router.get('/dashboard/activity/recent', (req, res) => {
  try {
    const { limit } = req.query;
    const activity = dashboardAnalytics.getRecentActivity(parseInt(limit) || 20);
    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/status - Get dashboard service status
router.get('/dashboard/status', (req, res) => {
  res.json({
    success: true,
    data: dashboardAnalytics.getStatus()
  });
});

// ============================================
// MARKETING ANALYTICS ROUTES (COM-120)
// ============================================
const MarketingAnalyticsService = require('../services/marketingAnalytics');
const marketingAnalytics = new MarketingAnalyticsService();

// GET /api/marketing/overview - Get full marketing analytics overview
router.get('/marketing/overview', (req, res) => {
  try {
    const overview = marketingAnalytics.getMarketingAnalyticsOverview();
    res.json({ success: true, data: overview });
  } catch (error) {
    console.error('Error fetching marketing overview:', error);
    res.status(500).json({ error: 'Failed to fetch marketing analytics overview' });
  }
});

// GET /api/marketing/ga4/status - Get GA4 configuration status
router.get('/marketing/ga4/status', (req, res) => {
  res.json({ success: true, data: marketingAnalytics.getGA4Status() });
});

// POST /api/marketing/ga4/configure - Configure Google Analytics
router.post('/marketing/ga4/configure', (req, res) => {
  try {
    const { propertyId, apiSecret, credentialsPath } = req.body;
    const config = marketingAnalytics.configureGA4({ propertyId, apiSecret, credentialsPath });
    res.json({ success: true, data: config, message: 'GA4 configured successfully' });
  } catch (error) {
    console.error('Error configuring GA4:', error);
    res.status(500).json({ error: 'Failed to configure GA4' });
  }
});

// GET /api/marketing/ga4/analytics - Get website analytics from GA4
router.get('/marketing/ga4/analytics', (req, res) => {
  try {
    const analytics = marketingAnalytics.getWebsiteAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Error fetching GA4 analytics:', error);
    res.status(500).json({ error: 'Failed to fetch GA4 analytics' });
  }
});

// GET /api/marketing/ab-tests - Get all A/B tests
router.get('/marketing/ab-tests', (req, res) => {
  try {
    const { status } = req.query;
    const tests = marketingAnalytics.getABTests(status ? { status } : {});
    res.json({ success: true, data: tests });
  } catch (error) {
    console.error('Error fetching A/B tests:', error);
    res.status(500).json({ error: 'Failed to fetch A/B tests' });
  }
});

// POST /api/marketing/ab-tests - Create a new A/B test
router.post('/marketing/ab-tests', (req, res) => {
  try {
    const { name, description, variantAValue, variantBValue, variantAName, variantBName, variantCValue, variantCName } = req.body;
    if (!name || !variantAValue || !variantBValue) {
      return res.status(400).json({ error: 'Name and both variant values are required' });
    }
    const test = marketingAnalytics.createABTest({
      name, description, variantAValue, variantBValue, variantAName, variantBName, variantCValue, variantCName
    });
    res.status(201).json({ success: true, data: test });
  } catch (error) {
    console.error('Error creating A/B test:', error);
    res.status(500).json({ error: 'Failed to create A/B test' });
  }
});

// GET /api/marketing/ab-tests/:testId - Get specific A/B test
router.get('/marketing/ab-tests/:testId', (req, res) => {
  try {
    const test = marketingAnalytics.getABTest(req.params.testId);
    if (!test) return res.status(404).json({ error: 'A/B test not found' });
    res.json({ success: true, data: marketingAnalytics.getABTestResults(req.params.testId) });
  } catch (error) {
    console.error('Error fetching A/B test:', error);
    res.status(500).json({ error: 'Failed to fetch A/B test' });
  }
});

// POST /api/marketing/ab-tests/:testId/start - Start an A/B test
router.post('/marketing/ab-tests/:testId/start', (req, res) => {
  try {
    const test = marketingAnalytics.startABTest(req.params.testId);
    if (!test) return res.status(404).json({ error: 'A/B test not found or already running' });
    res.json({ success: true, data: test });
  } catch (error) {
    console.error('Error starting A/B test:', error);
    res.status(500).json({ error: 'Failed to start A/B test' });
  }
});

// POST /api/marketing/ab-tests/:testId/complete - Complete an A/B test
router.post('/marketing/ab-tests/:testId/complete', (req, res) => {
  try {
    const test = marketingAnalytics.completeABTest(req.params.testId);
    if (!test) return res.status(404).json({ error: 'A/B test not found' });
    res.json({ success: true, data: marketingAnalytics.getABTestResults(req.params.testId) });
  } catch (error) {
    console.error('Error completing A/B test:', error);
    res.status(500).json({ error: 'Failed to complete A/B test' });
  }
});

// GET /api/marketing/campaigns - Get all campaigns with ROI metrics
router.get('/marketing/campaigns', (req, res) => {
  try {
    const { platform, status } = req.query;
    const filters = {};
    if (platform) filters.platform = platform;
    if (status) filters.status = status;
    const campaigns = marketingAnalytics.getCampaigns(filters);

    // Enrich with ROI data
    const enrichedCampaigns = campaigns.map(c => ({
      ...c,
      roi: marketingAnalytics.calculateCampaignROI(c.id)
    }));

    res.json({ success: true, data: enrichedCampaigns });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /api/marketing/campaigns/:campaignId - Get specific campaign ROI
router.get('/marketing/campaigns/:campaignId', (req, res) => {
  try {
    const roi = marketingAnalytics.calculateCampaignROI(req.params.campaignId);
    if (!roi) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ success: true, data: roi });
  } catch (error) {
    console.error('Error fetching campaign ROI:', error);
    res.status(500).json({ error: 'Failed to fetch campaign ROI' });
  }
});

// GET /api/marketing/metrics - Get aggregate marketing metrics
router.get('/marketing/metrics', (req, res) => {
  try {
    const metrics = marketingAnalytics.getMarketingMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error fetching marketing metrics:', error);
    res.status(500).json({ error: 'Failed to fetch marketing metrics' });
  }
});

// GET /api/marketing/platforms - Get platform comparison
router.get('/marketing/platforms', (req, res) => {
  try {
    const comparison = marketingAnalytics.getPlatformComparison();
    res.json({ success: true, data: comparison });
  } catch (error) {
    console.error('Error fetching platform comparison:', error);
    res.status(500).json({ error: 'Failed to fetch platform comparison' });
  }
});

// GET /api/marketing/conversions - Get conversion data
router.get('/marketing/conversions', (req, res) => {
  try {
    const { source, type, startDate, endDate } = req.query;
    const filters = {};
    if (source) filters.source = source;
    if (type) filters.type = type;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    const conversions = marketingAnalytics.getConversions(filters);
    res.json({ success: true, data: conversions });
  } catch (error) {
    console.error('Error fetching conversions:', error);
    res.status(500).json({ error: 'Failed to fetch conversions' });
  }
});

// POST /api/marketing/conversions - Record a conversion
router.post('/marketing/conversions', (req, res) => {
  try {
    const { source, type, value, campaignId, metadata } = req.body;
    if (!source || !type) {
      return res.status(400).json({ error: 'Source and type are required' });
    }
    const conversion = marketingAnalytics.recordConversion({ source, type, value, campaignId, metadata });
    res.status(201).json({ success: true, data: conversion });
  } catch (error) {
    console.error('Error recording conversion:', error);
    res.status(500).json({ error: 'Failed to record conversion' });
  }
});

// GET /api/marketing/funnel - Get conversion funnel
router.get('/marketing/funnel', (req, res) => {
  try {
    const funnel = marketingAnalytics.getConversionFunnel();
    res.json({ success: true, data: funnel });
  } catch (error) {
    console.error('Error fetching conversion funnel:', error);
    res.status(500).json({ error: 'Failed to fetch conversion funnel' });
  }
});

// GET /api/marketing/predictions - Get predictive analytics
router.get('/marketing/predictions', (req, res) => {
  try {
    const predictions = marketingAnalytics.predictCustomerBehavior();
    res.json({ success: true, data: predictions });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

// GET /api/marketing/budget-recommendations - Get budget allocation recommendations
router.get('/marketing/budget-recommendations', (req, res) => {
  try {
    const recommendations = marketingAnalytics.getBudgetRecommendations();
    res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Error fetching budget recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch budget recommendations' });
  }
});

// GET /api/marketing/cro-recommendations - Get CRO recommendations
router.get('/marketing/cro-recommendations', (req, res) => {
  try {
    const recommendations = marketingAnalytics.getCRORecommendations();
    res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Error fetching CRO recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch CRO recommendations' });
  }
});

// GET /api/marketing/cro/status - Get CRO framework status
router.get('/marketing/cro/status', (req, res) => {
  try {
    const status = marketingAnalytics.getCROFrameworkStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Error fetching CRO status:', error);
    res.status(500).json({ error: 'Failed to fetch CRO framework status' });
  }
});

// ============================================
// RATE LIMITING STATUS ROUTES
// ============================================

// GET /api/rate-limit/status - Get rate limiting status
router.get('/rate-limit/status', async (req, res) => {
  try {
    const ApiSecurityService = require('../services/apiSecurity');
    const apiSecurity = new ApiSecurityService();

    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const status = await apiSecurity.rateLimiter.getStatus(ip);

    res.json({
      success: true,
      data: {
        identifier: ip,
        ...status,
        configuredLimits: {
          windowMs: apiSecurity.defaultRateLimit.windowMs,
          maxRequests: apiSecurity.defaultRateLimit.maxRequests
        }
      }
    });
  } catch (error) {
    console.error('Error fetching rate limit status:', error);
    res.status(500).json({ error: 'Failed to fetch rate limit status' });
  }
});

// GET /api/rate-limit/config - Get rate limit configuration
router.get('/rate-limit/config', (req, res) => {
  res.json({
    success: true,
    data: {
      defaultLimit: {
        windowMs: 60000,
        maxRequests: 100
      },
      endpointLimits: {
        '/auth/login': { maxRequests: 10, windowMs: 60000, description: 'Strict limit for login attempts' },
        '/auth/register': { maxRequests: 10, windowMs: 60000, description: 'Strict limit for registration' },
        '/auth/reset-password': { maxRequests: 5, windowMs: 60000, description: 'Very strict for password reset' },
        '/contacts': { maxRequests: 30, windowMs: 60000 },
        '/subscriptions': { maxRequests: 30, windowMs: 60000 },
        '/employees': { maxRequests: 50, windowMs: 60000 },
        '/tasks': { maxRequests: 50, windowMs: 60000 }
      },
      headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-RateLimit-Window', 'Retry-After']
    }
  });
});

module.exports = router;
