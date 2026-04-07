const request = require('supertest');
const { app } = require('./server');

describe('AIEmployee API', () => {
  describe('Health Check', () => {
    it('GET /health should return ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Status Endpoint', () => {
    it('GET /api/status should return service status', async () => {
      const res = await request(app).get('/api/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.service).toBe('AIEmployee API');
      expect(res.body.data.status).toBe('operational');
    });
  });

  describe('Plans API', () => {
    it('GET /api/plans should return all plans', async () => {
      const res = await request(app).get('/api/plans');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0].id).toBe('starter');
      expect(res.body.data[1].id).toBe('growth');
      expect(res.body.data[2].id).toBe('scale');
    });

    it('GET /api/plans/:id should return specific plan', async () => {
      const res = await request(app).get('/api/plans/starter');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('starter');
      expect(res.body.data.price).toBe(199000);
    });

    it('GET /api/plans/invalid should return 404', async () => {
      const res = await request(app).get('/api/plans/invalid');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Plan not found');
    });
  });

  describe('Contacts API', () => {
    const validContact = {
      name: 'Nguyen Van A',
      company: 'Cong Ty ABC',
      email: 'test@example.com',
      phone: '0912345678',
      plan: 'growth',
      message: 'I want to learn more about your service'
    };

    it('POST /api/contacts should create contact', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .send(validContact);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Nguyen Van A');
      expect(res.body.data.email).toBe('test@example.com');
      expect(res.body.data.status).toBe('new');
      expect(res.body.data.id).toBeDefined();
    });

    it('POST /api/contacts should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .send({ ...validContact, email: 'invalid-email' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('email');
    });

    it('POST /api/contacts should reject short name', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .send({ ...validContact, name: 'A' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Name');
    });

    it('POST /api/contacts should reject missing company', async () => {
      const { company, ...noCompany } = validContact;
      const res = await request(app)
        .post('/api/contacts')
        .send(noCompany);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Company');
    });

    it('GET /api/contacts should return all contacts', async () => {
      // Create a contact first
      await request(app).post('/api/contacts').send(validContact);
      const res = await request(app).get('/api/contacts');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThan(0);
    });

    it('GET /api/contacts/:id should return specific contact', async () => {
      // First create a contact
      const createRes = await request(app)
        .post('/api/contacts')
        .send(validContact);
      const contactId = createRes.body.data.id;

      const res = await request(app).get(`/api/contacts/${contactId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(contactId);
    });

    it('GET /api/contacts/invalid-id should return 404', async () => {
      const res = await request(app).get('/api/contacts/invalid-uuid');
      expect(res.status).toBe(404);
    });

    it('PATCH /api/contacts/:id should update status', async () => {
      // First create a contact
      const createRes = await request(app)
        .post('/api/contacts')
        .send(validContact);
      const contactId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/contacts/${contactId}`)
        .send({ status: 'contacted' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('contacted');
    });

    it('PATCH /api/contacts/:id should reject invalid status', async () => {
      const createRes = await request(app)
        .post('/api/contacts')
        .send(validContact);
      const contactId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/contacts/${contactId}`)
        .send({ status: 'invalid_status' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status');
    });
  });

  describe('Employees API', () => {
    let subscriptionId;
    let contactId;

    beforeAll(async () => {
      // Create a contact and subscription first
      const contactRes = await request(app)
        .post('/api/contacts')
        .send({
          name: 'Test User',
          company: 'Test Company',
          email: 'employee-test@example.com'
        });
      contactId = contactRes.body.data.id;

      const subRes = await request(app)
        .post('/api/subscriptions')
        .send({ contactId, planId: 'scale' });
      subscriptionId = subRes.body.data.id;
    });

    it('POST /api/employees should create employee', async () => {
      const res = await request(app)
        .post('/api/employees')
        .send({
          subscriptionId,
          name: 'Test Employee',
          role: 'support'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Employee');
      expect(res.body.data.status).toBe('active');
    });

    it('POST /api/employees should reject without subscriptionId', async () => {
      const res = await request(app)
        .post('/api/employees')
        .send({ name: 'Test Employee' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Subscription ID');
    });

    it('POST /api/employees should reject without name', async () => {
      const res = await request(app)
        .post('/api/employees')
        .send({ subscriptionId });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('name');
    });

    it('GET /api/employees should return all employees', async () => {
      const res = await request(app).get('/api/employees');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThan(0);
    });

    it('GET /api/employees/:id should return specific employee', async () => {
      const createRes = await request(app)
        .post('/api/employees')
        .send({ subscriptionId, name: 'Find Me Employee' });
      const employeeId = createRes.body.data.id;

      const res = await request(app).get(`/api/employees/${employeeId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Find Me Employee');
    });

    it('PATCH /api/employees/:id should update employee', async () => {
      const createRes = await request(app)
        .post('/api/employees')
        .send({ subscriptionId, name: 'Update Test' });
      const employeeId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/employees/${employeeId}`)
        .send({ name: 'Updated Name', status: 'inactive' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.status).toBe('inactive');
    });

    it('DELETE /api/employees/:id should delete employee', async () => {
      const createRes = await request(app)
        .post('/api/employees')
        .send({ subscriptionId, name: 'Delete Me' });

      // Guard against failed creation
      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data).toBeDefined();
      expect(createRes.body.data.id).toBeDefined();

      const employeeId = createRes.body.data.id;

      const res = await request(app).delete(`/api/employees/${employeeId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deleted
      const getRes = await request(app).get(`/api/employees/${employeeId}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Tasks API', () => {
    let employeeId;
    let subscriptionId;
    let contactId;

    beforeAll(async () => {
      // Create contact, subscription, and employee first
      const contactRes = await request(app)
        .post('/api/contacts')
        .send({
          name: 'Task Test User',
          company: 'Task Test Company',
          email: 'task-test@example.com'
        });
      contactId = contactRes.body.data.id;

      const subRes = await request(app)
        .post('/api/subscriptions')
        .send({ contactId, planId: 'starter' });
      subscriptionId = subRes.body.data.id;

      const empRes = await request(app)
        .post('/api/employees')
        .send({ subscriptionId, name: 'Task Test Employee' });
      employeeId = empRes.body.data.id;
    });

    it('POST /api/tasks should create task', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({
          employeeId,
          title: 'Test Task',
          description: 'Task description',
          priority: 'high'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Test Task');
      expect(res.body.data.status).toBe('pending');
    });

    it('POST /api/tasks should reject without employeeId', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test Task' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Employee ID');
    });

    it('POST /api/tasks should reject short title', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ employeeId, title: 'AB' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('title');
    });

    it('GET /api/tasks should return all tasks', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/tasks/:id should return specific task', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .send({ employeeId, title: 'Find This Task' });
      const taskId = createRes.body.data.id;

      const res = await request(app).get(`/api/tasks/${taskId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Find This Task');
    });

    it('PATCH /api/tasks/:id should update task', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .send({ employeeId, title: 'Update Task Test' });
      const taskId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({ status: 'in_progress', priority: 'low' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('in_progress');
      expect(res.body.data.priority).toBe('low');
    });

    it('PATCH /api/tasks/:id should reject invalid status', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .send({ employeeId, title: 'Status Test Task' });
      const taskId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({ status: 'invalid_status' });
      expect(res.status).toBe(400);
    });
  });

  describe('Metrics API', () => {
    it('GET /api/metrics should return system metrics', async () => {
      const res = await request(app).get('/api/metrics');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('contacts');
      expect(res.body.data).toHaveProperty('employees');
      expect(res.body.data).toHaveProperty('tasks');
      expect(res.body.data).toHaveProperty('timestamp');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });
});
