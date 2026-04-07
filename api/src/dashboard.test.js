/**
 * Dashboard E2E Tests (COM-113)
 * Tests for dashboard HTML page structure and API integration
 */

const request = require('supertest');
const { app } = require('./server');
const { resetStore, contactOps, subscriptionOps, employeeOps, taskOps } = require('./data/store');

describe('Dashboard E2E Tests', () => {
  beforeEach(() => {
    resetStore();

    // Setup test data
    const contact1 = contactOps.create({
      name: 'Test Customer',
      company: 'Test Company',
      email: 'test@example.com',
      status: 'converted'
    });

    const contact2 = contactOps.create({
      name: 'Another Customer',
      company: 'Another Company',
      email: 'another@example.com',
      status: 'qualified'
    });

    subscriptionOps.create({
      contactId: contact1.id,
      planId: 'growth',
      status: 'active'
    });

    subscriptionOps.create({
      contactId: contact2.id,
      planId: 'starter',
      status: 'active'
    });

    const emp1 = employeeOps.create({
      subscriptionId: contact1.id,
      name: 'AI Employee 1',
      role: 'assistant',
      status: 'active'
    });

    taskOps.create({ employeeId: emp1.id, title: 'Task 1', status: 'completed' });
    taskOps.create({ employeeId: emp1.id, title: 'Task 2', status: 'completed' });
    taskOps.create({ employeeId: emp1.id, title: 'Task 3', status: 'pending' });
  });

  describe('Dashboard API Endpoints', () => {
    describe('GET /api/dashboard/overview', () => {
      test('should return complete dashboard overview', async () => {
        const res = await request(app).get('/api/dashboard/overview');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('mrr');
        expect(res.body.data).toHaveProperty('activeCustomers');
        expect(res.body.data).toHaveProperty('tasks');
        expect(res.body.data).toHaveProperty('planDistribution');
        expect(res.body.data).toHaveProperty('contactFunnel');
        expect(res.body.data).toHaveProperty('employeeUtilization');
        expect(res.body.data).toHaveProperty('timestamp');
      });
    });

    describe('GET /api/dashboard/kpis', () => {
      test('should return 4 KPI cards', async () => {
        const res = await request(app).get('/api/dashboard/kpis');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(4);

        // Verify KPI card structure
        const kpis = res.body.data;
        expect(kpis.find(k => k.id === 'mrr')).toBeDefined();
        expect(kpis.find(k => k.id === 'active-customers')).toBeDefined();
        expect(kpis.find(k => k.id === 'tasks-completed')).toBeDefined();
        expect(kpis.find(k => k.id === 'completion-rate')).toBeDefined();
      });

      test('should include trend information in KPI cards', async () => {
        const res = await request(app).get('/api/dashboard/kpis');

        const mrrCard = res.body.data.find(k => k.id === 'mrr');
        expect(mrrCard).toHaveProperty('change');
        expect(mrrCard).toHaveProperty('trend');
        expect(['up', 'down']).toContain(mrrCard.trend);
      });
    });

    describe('GET /api/dashboard/mrr', () => {
      test('should return MRR data', async () => {
        const res = await request(app).get('/api/dashboard/mrr');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('mrr');
        expect(res.body.data).toHaveProperty('mrrFormatted');
        expect(res.body.data).toHaveProperty('activeSubscriptions');
        expect(res.body.data).toHaveProperty('currency');
        expect(res.body.data.currency).toBe('VND');
      });

      test('should calculate MRR correctly', async () => {
        const res = await request(app).get('/api/dashboard/mrr');

        // growth (499000) + starter (199000) = 698000
        expect(res.body.data.mrr).toBe(698000);
        expect(res.body.data.activeSubscriptions).toBe(2);
      });
    });

    describe('GET /api/dashboard/customers', () => {
      test('should return active customer data', async () => {
        const res = await request(app).get('/api/dashboard/customers');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('count');
        expect(res.body.data).toHaveProperty('activeSubscriptions');
        expect(res.body.data.count).toBe(2);
      });
    });

    describe('GET /api/dashboard/tasks', () => {
      test('should return task metrics', async () => {
        const res = await request(app).get('/api/dashboard/tasks');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('total');
        expect(res.body.data).toHaveProperty('byStatus');
        expect(res.body.data).toHaveProperty('completionRate');
        expect(res.body.data.total).toBe(3);
        expect(res.body.data.byStatus.completed).toBe(2);
        expect(res.body.data.byStatus.pending).toBe(1);
      });

      test('should calculate completion rate', async () => {
        const res = await request(app).get('/api/dashboard/tasks');

        // 2 completed / 3 total = 66.7%
        expect(res.body.data.completionRate).toBe(66.7);
      });
    });

    describe('GET /api/dashboard/plans', () => {
      test('should return plan distribution', async () => {
        const res = await request(app).get('/api/dashboard/plans');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('distribution');
        expect(res.body.data).toHaveProperty('totalActiveSubscriptions');
        expect(res.body.data.totalActiveSubscriptions).toBe(2);
      });

      test('should include plan details', async () => {
        const res = await request(app).get('/api/dashboard/plans');
        const dist = res.body.data.distribution;

        expect(dist.growth).toBeDefined();
        expect(dist.growth.subscriberCount).toBe(1);
        expect(dist.starter).toBeDefined();
        expect(dist.starter.subscriberCount).toBe(1);
      });
    });

    describe('GET /api/dashboard/funnel', () => {
      test('should return contact funnel data', async () => {
        const res = await request(app).get('/api/dashboard/funnel');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('stages');
        expect(res.body.data.stages).toHaveLength(5);
        expect(res.body.data.total).toBe(2);
      });

      test('should have funnel stages with colors', async () => {
        const res = await request(app).get('/api/dashboard/funnel');

        const stages = res.body.data.stages;
        expect(stages[0]).toHaveProperty('stage');
        expect(stages[0]).toHaveProperty('color');
        expect(stages[0]).toHaveProperty('count');
      });
    });

    describe('GET /api/dashboard/revenue-trends', () => {
      test('should return revenue trends', async () => {
        const res = await request(app).get('/api/dashboard/revenue-trends?days=7');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('trends');
        expect(res.body.data).toHaveProperty('period');
        expect(res.body.data.period).toBe('7 days');
      });

      test('should respect days parameter', async () => {
        const res = await request(app).get('/api/dashboard/revenue-trends?days=30');

        expect(res.body.data.trends).toHaveLength(30);
        expect(res.body.data.period).toBe('30 days');
      });

      test('should default to 7 days', async () => {
        const res = await request(app).get('/api/dashboard/revenue-trends');

        expect(res.body.data.trends).toHaveLength(7);
      });
    });

    describe('GET /api/dashboard/employees', () => {
      test('should return employee utilization', async () => {
        const res = await request(app).get('/api/dashboard/employees');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('totalEmployees');
        expect(res.body.data).toHaveProperty('activeEmployees');
        expect(res.body.data).toHaveProperty('employees');
        expect(res.body.data.employees).toHaveLength(1);
      });
    });

    describe('GET /api/dashboard/charts', () => {
      test('should return chart data for visualizations', async () => {
        const res = await request(app).get('/api/dashboard/charts');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('planDistribution');
        expect(res.body.data).toHaveProperty('revenueTrends');
        expect(res.body.data).toHaveProperty('taskStatus');
        expect(res.body.data).toHaveProperty('contactFunnel');
      });

      test('should have correct chart data structure', async () => {
        const res = await request(app).get('/api/dashboard/charts');
        const charts = res.body.data;

        // Plan distribution should have labels and datasets
        expect(charts.planDistribution.labels).toBeDefined();
        expect(charts.planDistribution.datasets).toBeDefined();

        // Task status should have 4 labels
        expect(charts.taskStatus.labels).toHaveLength(4);
        expect(charts.taskStatus.labels).toEqual(['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Đã hủy']);
      });
    });

    describe('DELETE /api/dashboard/cache', () => {
      test('should clear dashboard cache', async () => {
        // First call to populate cache
        await request(app).get('/api/dashboard/overview');

        // Clear cache
        const res = await request(app).delete('/api/dashboard/cache');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Dashboard cache cleared');
      });
    });

    describe('GET /api/dashboard/status', () => {
      test('should return service status', async () => {
        const res = await request(app).get('/api/dashboard/status');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.service).toBe('Dashboard Analytics');
        expect(res.body.data.status).toBe('operational');
      });
    });
  });

  describe('Dashboard HTML Structure Tests', () => {
    const fs = require('fs');
    const path = require('path');
    const dashboardHtml = fs.readFileSync(
      path.join(__dirname, '../../products/aiemployee-vn/dashboard.html'),
      'utf8'
    );

    test('should have correct DOCTYPE and charset', () => {
      expect(dashboardHtml).toMatch(/<!DOCTYPE html>/);
      expect(dashboardHtml).toMatch(/<meta charset="UTF-8">/);
    });

    test('should include Inter font', () => {
      expect(dashboardHtml).toMatch(/fonts\.googleapis\.com.*Inter/);
    });

    test('should have responsive viewport', () => {
      expect(dashboardHtml).toMatch(/viewport.*width=device-width/);
    });

    test('should have sidebar navigation', () => {
      expect(dashboardHtml).toMatch(/class="sidebar"/);
      expect(dashboardHtml).toMatch(/Dashboard/);
    });

    test('should have KPI grid with 4 cards', () => {
      expect(dashboardHtml).toMatch(/class="kpi-grid"/);
      expect(dashboardHtml).toMatch(/class="kpi-card"/);
    });

    test('should have chart containers', () => {
      expect(dashboardHtml).toMatch(/class="chart-card"/);
      expect(dashboardHtml).toMatch(/id="lineChart"/);
      expect(dashboardHtml).toMatch(/id="donutChart"/);
    });

    test('should have period selector buttons', () => {
      expect(dashboardHtml).toMatch(/data-period="7d"/);
      expect(dashboardHtml).toMatch(/data-period="30d"/);
      expect(dashboardHtml).toMatch(/data-period="90d"/);
    });

    test('should have responsive CSS media queries', () => {
      expect(dashboardHtml).toMatch(/@media.*max-width.*1200px/);
      expect(dashboardHtml).toMatch(/@media.*max-width.*1024px/);
      expect(dashboardHtml).toMatch(/@media.*max-width.*768px/);
    });

    test('should have mobile menu button', () => {
      expect(dashboardHtml).toMatch(/id="mobileMenuBtn"/);
    });

    test('should have data table for recent activity', () => {
      expect(dashboardHtml).toMatch(/class="data-table"/);
      expect(dashboardHtml).toMatch(/<th>.*Nhân viên ảo/);
    });

    test('should have quick action buttons', () => {
      expect(dashboardHtml).toMatch(/class="quick-actions"/);
      expect(dashboardHtml).toMatch(/Tạo công việc mới/);
    });

    test('should have CSS design tokens', () => {
      expect(dashboardHtml).toMatch(/--primary:\s*#2563eb/);
      expect(dashboardHtml).toMatch(/--secondary:\s*#10b981/);
      expect(dashboardHtml).toMatch(/--font-family/);
    });

    test('should have Vietnamese localization', () => {
      expect(dashboardHtml).toMatch(/Doanh thu theo thời gian/);
      expect(dashboardHtml).toMatch(/Phân bố theo gói dịch vụ/);
      expect(dashboardHtml).toMatch(/Nhân viên ảo đang hoạt động/);
    });
  });

  describe('Dashboard Data Integration', () => {
    test('should integrate KPI cards with API data', async () => {
      const kpiRes = await request(app).get('/api/dashboard/kpis');
      const overviewRes = await request(app).get('/api/dashboard/overview');

      expect(kpiRes.body.data).toHaveLength(4);
      expect(overviewRes.body.data.mrr).toBeDefined();
    });

    test('should provide consistent data across endpoints', async () => {
      const overviewRes = await request(app).get('/api/dashboard/overview');
      const mrrRes = await request(app).get('/api/dashboard/mrr');
      const customersRes = await request(app).get('/api/dashboard/customers');
      const tasksRes = await request(app).get('/api/dashboard/tasks');

      expect(overviewRes.body.data.mrr.mrr).toBe(mrrRes.body.data.mrr);
      expect(overviewRes.body.data.activeCustomers.count).toBe(customersRes.body.data.count);
      expect(overviewRes.body.data.tasks.total).toBe(tasksRes.body.data.total);
    });
  });
});
