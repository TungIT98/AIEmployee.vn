/**
 * Dashboard Analytics Service Tests (COM-111)
 */

const DashboardAnalyticsService = require('./dashboardAnalytics');
const { store, contactOps, planOps, subscriptionOps, employeeOps, taskOps, resetStore } = require('../data/store');

describe('DashboardAnalyticsService', () => {
  let dashboardAnalytics;

  beforeEach(() => {
    // Reset store and create fresh dashboard instance
    resetStore();
    dashboardAnalytics = new DashboardAnalyticsService();

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

    const sub1 = subscriptionOps.create({
      contactId: contact1.id,
      planId: 'growth',
      planName: 'Growth',
      price: 499000,
      status: 'active'
    });

    const sub2 = subscriptionOps.create({
      contactId: contact2.id,
      planId: 'starter',
      planName: 'Starter',
      price: 199000,
      status: 'active'
    });

    const emp1 = employeeOps.create({
      subscriptionId: sub1.id,
      name: 'AI Employee 1',
      role: 'assistant',
      status: 'active'
    });

    const emp2 = employeeOps.create({
      subscriptionId: sub1.id,
      name: 'AI Employee 2',
      role: 'analyst',
      status: 'active'
    });

    taskOps.create({ employeeId: emp1.id, title: 'Task 1', status: 'completed' });
    taskOps.create({ employeeId: emp1.id, title: 'Task 2', status: 'completed' });
    taskOps.create({ employeeId: emp2.id, title: 'Task 3', status: 'pending' });
    taskOps.create({ employeeId: emp2.id, title: 'Task 4', status: 'in_progress' });
    taskOps.create({ employeeId: emp1.id, title: 'Task 5', status: 'cancelled' });
  });

  describe('calculateMRR', () => {
    test('should calculate MRR correctly', () => {
      const result = dashboardAnalytics.calculateMRR();

      expect(result.mrr).toBe(698000); // 499000 + 199000
      expect(result.activeSubscriptions).toBe(2);
      expect(result.currency).toBe('VND');
    });

    test('should format MRR correctly', () => {
      const result = dashboardAnalytics.calculateMRR();

      expect(result.mrrFormatted).toContain('698');
    });
  });

  describe('getActiveCustomers', () => {
    test('should return active customer count', () => {
      const result = dashboardAnalytics.getActiveCustomers();

      expect(result.count).toBe(2);
      expect(result.activeSubscriptions).toBe(2);
    });

    test('should include customer details', () => {
      const result = dashboardAnalytics.getActiveCustomers();

      expect(result.details).toHaveLength(2);
      expect(result.details[0]).toHaveProperty('contactName');
      expect(result.details[0]).toHaveProperty('planName');
      expect(result.details[0]).toHaveProperty('status');
    });
  });

  describe('getTaskMetrics', () => {
    test('should calculate task metrics correctly', () => {
      const result = dashboardAnalytics.getTaskMetrics();

      expect(result.total).toBe(5);
      expect(result.byStatus.pending).toBe(1);
      expect(result.byStatus.in_progress).toBe(1);
      expect(result.byStatus.completed).toBe(2);
      expect(result.byStatus.cancelled).toBe(1);
    });

    test('should calculate completion rate', () => {
      const result = dashboardAnalytics.getTaskMetrics();

      expect(result.completionRate).toBe(40); // 2/5 = 40%
    });
  });

  describe('getPlanDistribution', () => {
    test('should show distribution by plan', () => {
      const result = dashboardAnalytics.getPlanDistribution();

      expect(result.totalActiveSubscriptions).toBe(2);
      expect(result.distribution.growth).toBeDefined();
      expect(result.distribution.growth.subscriberCount).toBe(1);
      expect(result.distribution.growth.planPrice).toBe(499000);
      expect(result.distribution.starter.subscriberCount).toBe(1);
    });

    test('should calculate percentages correctly', () => {
      const result = dashboardAnalytics.getPlanDistribution();

      expect(result.distribution.growth.percentage).toBe('50.0');
      expect(result.distribution.starter.percentage).toBe('50.0');
    });

    test('should calculate total revenue', () => {
      const result = dashboardAnalytics.getPlanDistribution();

      expect(result.totalRevenue).toBe(698000);
    });
  });

  describe('getContactFunnel', () => {
    test('should count contacts by status', () => {
      const result = dashboardAnalytics.getContactFunnel();

      expect(result.converted).toBe(1);
      expect(result.qualified).toBe(1);
      expect(result.total).toBe(2);
    });

    test('should include funnel stages with colors', () => {
      const result = dashboardAnalytics.getContactFunnel();

      expect(result.stages).toHaveLength(5);
      expect(result.stages[0]).toHaveProperty('stage');
      expect(result.stages[0]).toHaveProperty('color');
    });

    test('should calculate conversion rate', () => {
      const result = dashboardAnalytics.getContactFunnel();

      expect(result.conversionRate).toBe(50); // 1/2 = 50%
    });
  });

  describe('getEmployeeUtilization', () => {
    test('should calculate employee utilization', () => {
      const result = dashboardAnalytics.getEmployeeUtilization();

      expect(result.totalEmployees).toBe(2);
      expect(result.activeEmployees).toBe(2);
      expect(result.employees).toHaveLength(2);
    });

    test('should show per-employee stats', () => {
      const result = dashboardAnalytics.getEmployeeUtilization();
      const emp = result.employees[0];

      expect(emp).toHaveProperty('employeeId');
      expect(emp).toHaveProperty('totalTasks');
      expect(emp).toHaveProperty('completedTasks');
      expect(emp).toHaveProperty('utilizationRate');
    });
  });

  describe('getDashboardOverview', () => {
    test('should return all dashboard data', () => {
      const result = dashboardAnalytics.getDashboardOverview();

      expect(result).toHaveProperty('mrr');
      expect(result).toHaveProperty('activeCustomers');
      expect(result).toHaveProperty('tasks');
      expect(result).toHaveProperty('planDistribution');
      expect(result).toHaveProperty('contactFunnel');
      expect(result).toHaveProperty('employeeUtilization');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('getKPICards', () => {
    test('should return 4 KPI cards', () => {
      const result = dashboardAnalytics.getKPICards();

      expect(result).toHaveLength(4);
    });

    test('should include MRR card', () => {
      const result = dashboardAnalytics.getKPICards();
      const mrrCard = result.find(c => c.id === 'mrr');

      expect(mrrCard).toBeDefined();
      expect(mrrCard.label).toBe('MRR');
      expect(mrrCard.rawValue).toBe(698000);
    });

    test('should include active customers card', () => {
      const result = dashboardAnalytics.getKPICards();
      const customersCard = result.find(c => c.id === 'active-customers');

      expect(customersCard).toBeDefined();
      expect(customersCard.label).toBe('Khách hàng hoạt động');
      expect(customersCard.rawValue).toBe(2);
    });

    test('should include completion rate card', () => {
      const result = dashboardAnalytics.getKPICards();
      const completionCard = result.find(c => c.id === 'completion-rate');

      expect(completionCard).toBeDefined();
      expect(completionCard.label).toBe('Tỷ lệ hoàn thành');
      expect(completionCard.rawValue).toBe(40);
    });
  });

  describe('getChartData', () => {
    test('should return chart data for visualizations', () => {
      const result = dashboardAnalytics.getChartData();

      expect(result).toHaveProperty('planDistribution');
      expect(result).toHaveProperty('revenueTrends');
      expect(result).toHaveProperty('taskStatus');
      expect(result).toHaveProperty('contactFunnel');
    });

    test('should have correct plan distribution structure', () => {
      const result = dashboardAnalytics.getChartData();

      expect(result.planDistribution.labels).toContain('Growth');
      expect(result.planDistribution.labels).toContain('Starter');
      expect(result.planDistribution.datasets[0].data).toHaveLength(3); // All 3 plans
    });

    test('should have correct task status structure', () => {
      const result = dashboardAnalytics.getChartData();

      expect(result.taskStatus.labels).toHaveLength(4);
      expect(result.taskStatus.datasets[0].data).toEqual([1, 1, 2, 1]);
    });
  });

  describe('getRevenueTrends', () => {
    test('should return trends for specified days', () => {
      const result = dashboardAnalytics.getRevenueTrends(7);

      expect(result.trends).toHaveLength(7);
      expect(result.period).toBe('7 days');
    });

    test('should include date and revenue for each day', () => {
      const result = dashboardAnalytics.getRevenueTrends(7);

      expect(result.trends[0]).toHaveProperty('date');
      expect(result.trends[0]).toHaveProperty('revenue');
      expect(result.trends[0]).toHaveProperty('dateFormatted');
    });
  });

  describe('cache', () => {
    test('should cache results', () => {
      const result1 = dashboardAnalytics.calculateMRR();
      const result2 = dashboardAnalytics.calculateMRR();

      expect(result1.mrr).toBe(result2.mrr);
      expect(result1.mrrFormatted).toBe(result2.mrrFormatted);
    });

    test('should clear cache', () => {
      dashboardAnalytics.calculateMRR();
      dashboardAnalytics.clearCache();

      // After clear, cache should be empty - we verify by calling again
      const result = dashboardAnalytics.calculateMRR();
      expect(result.mrr).toBeDefined();
    });
  });

  describe('getStatus', () => {
    test('should return service status', () => {
      const status = dashboardAnalytics.getStatus();

      expect(status.service).toBe('Dashboard Analytics');
      expect(status.version).toBe('1.0.0');
      expect(status.status).toBe('operational');
    });
  });

  describe('formatCurrency', () => {
    test('should format Vietnamese currency correctly', () => {
      const formatted = dashboardAnalytics.formatCurrency(698000);

      expect(formatted).toContain('698');
      expect(formatted).toContain('₫');
    });

    test('should handle zero', () => {
      const formatted = dashboardAnalytics.formatCurrency(0);

      expect(formatted).toContain('0');
      expect(formatted).toContain('₫');
    });
  });
});
