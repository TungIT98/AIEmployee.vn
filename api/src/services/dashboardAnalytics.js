/**
 * Dashboard Analytics Service (COM-111)
 * Provides KPI aggregation endpoints for dashboard visualization
 */

const { contactOps, planOps, subscriptionOps, employeeOps, taskOps, store } = require('../data/store');

class DashboardAnalyticsService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
  }

  /**
   * Get cached value or compute
   */
  getCached(key, computeFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.value;
    }
    const value = computeFn();
    this.cache.set(key, { value, timestamp: Date.now() });
    return value;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Calculate MRR (Monthly Recurring Revenue)
   */
  calculateMRR() {
    const activeSubscriptions = store.subscriptions.filter(s => s.status === 'active');
    const mrr = activeSubscriptions.reduce((sum, sub) => {
      const plan = planOps.findById(sub.planId);
      return sum + (plan ? plan.price : 0);
    }, 0);

    return {
      mrr,
      mrrFormatted: this.formatCurrency(mrr),
      activeSubscriptions: activeSubscriptions.length,
      currency: 'VND'
    };
  }

  /**
   * Get active customers count
   */
  getActiveCustomers() {
    const activeSubscriptions = store.subscriptions.filter(s => s.status === 'active');
    const uniqueContacts = new Set(activeSubscriptions.map(s => s.contactId));

    return {
      count: uniqueContacts.size,
      activeSubscriptions: activeSubscriptions.length,
      details: activeSubscriptions.map(sub => {
        const contact = contactOps.findById(sub.contactId);
        const plan = planOps.findById(sub.planId);
        return {
          subscriptionId: sub.id,
          contactName: contact?.name || 'Unknown',
          companyName: contact?.company || 'Unknown',
          planName: plan?.name || 'Unknown',
          planPrice: plan?.price || 0,
          status: sub.status,
          activatedAt: sub.createdAt
        };
      })
    };
  }

  /**
   * Get task metrics
   */
  getTaskMetrics() {
    const allTasks = taskOps.findAll();
    const pendingTasks = taskOps.findAll({ status: 'pending' });
    const inProgressTasks = taskOps.findAll({ status: 'in_progress' });
    const completedTasks = taskOps.findAll({ status: 'completed' });
    const cancelledTasks = taskOps.findAll({ status: 'cancelled' });

    const totalTasks = allTasks.length;
    const completionRate = totalTasks > 0 ? (completedTasks.length / totalTasks * 100).toFixed(1) : 0;

    // Calculate average completion time (mock - would need completedAt timestamp in real system)
    const avgCompletionTime = totalTasks > 0 ? '2.5 hours' : 'N/A';

    return {
      total: totalTasks,
      byStatus: {
        pending: pendingTasks.length,
        in_progress: inProgressTasks.length,
        completed: completedTasks.length,
        cancelled: cancelledTasks.length
      },
      completionRate: parseFloat(completionRate),
      avgCompletionTime,
      completionTrend: this.calculateTrend(completedTasks.length, 7), // Last 7 days trend
      tasksCompletedToday: this.getTasksCompletedToday().length
    };
  }

  /**
   * Get tasks completed today
   */
  getTasksCompletedToday() {
    const today = new Date().toISOString().split('T')[0];
    return taskOps.findAll({ status: 'completed' }).filter(t =>
      t.updatedAt && t.updatedAt.startsWith(today)
    );
  }

  /**
   * Get plan distribution
   */
  getPlanDistribution() {
    const activeSubscriptions = store.subscriptions.filter(s => s.status === 'active');
    const distribution = {};

    store.plans.forEach(plan => {
      const count = activeSubscriptions.filter(s => s.planId === plan.id).length;
      const revenue = activeSubscriptions
        .filter(s => s.planId === plan.id)
        .reduce((sum, sub) => sum + plan.price, 0);

      distribution[plan.id] = {
        planId: plan.id,
        planName: plan.name,
        planPrice: plan.price,
        subscriberCount: count,
        revenue,
        revenueFormatted: this.formatCurrency(revenue),
        percentage: activeSubscriptions.length > 0
          ? ((count / activeSubscriptions.length) * 100).toFixed(1)
          : 0
      };
    });

    return {
      distribution,
      totalActiveSubscriptions: activeSubscriptions.length,
      totalRevenue: Object.values(distribution).reduce((sum, d) => sum + d.revenue, 0),
      totalRevenueFormatted: this.formatCurrency(
        Object.values(distribution).reduce((sum, d) => sum + d.revenue, 0)
      )
    };
  }

  /**
   * Get contact funnel
   */
  getContactFunnel() {
    const contacts = contactOps.findAll();
    const funnel = {
      new: contacts.filter(c => c.status === 'new').length,
      contacted: contacts.filter(c => c.status === 'contacted').length,
      qualified: contacts.filter(c => c.status === 'qualified').length,
      converted: contacts.filter(c => c.status === 'converted').length,
      lost: contacts.filter(c => c.status === 'lost').length
    };

    const total = contacts.length;
    const conversionRate = total > 0 ? ((funnel.converted / total) * 100).toFixed(1) : 0;

    return {
      ...funnel,
      total,
      conversionRate: parseFloat(conversionRate),
      stages: [
        { stage: 'new', label: 'Mới', count: funnel.new, color: '#3B82F6' },
        { stage: 'contacted', label: 'Đã liên hệ', count: funnel.contacted, color: '#8B5CF6' },
        { stage: 'qualified', label: 'Đã xác thực', count: funnel.qualified, color: '#F59E0B' },
        { stage: 'converted', label: 'Đã chuyển đổi', count: funnel.converted, color: '#10B981' },
        { stage: 'lost', label: 'Mất', count: funnel.lost, color: '#EF4444' }
      ]
    };
  }

  /**
   * Get revenue trends (last 7 days mock)
   */
  getRevenueTrends(days = 7) {
    const trends = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Mock data - in production, this would query actual subscription history
      const baseMRR = this.calculateMRR().mrr;
      const dailyVariation = Math.random() * 0.2 - 0.1; // -10% to +10%
      const dayRevenue = Math.round(baseMRR * (1 + dailyVariation) / 30);

      trends.push({
        date: dateStr,
        dateFormatted: date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
        revenue: dayRevenue,
        revenueFormatted: this.formatCurrency(dayRevenue),
        subscriptions: store.subscriptions.filter(s =>
          s.createdAt && s.createdAt.startsWith(dateStr)
        ).length
      });
    }

    return {
      trends,
      period: `${days} days`,
      startDate: trends[0]?.date,
      endDate: trends[days - 1]?.date
    };
  }

  /**
   * Get employee utilization
   */
  getEmployeeUtilization() {
    const employees = employeeOps.findAll();
    const activeEmployees = employees.filter(e => e.status === 'active');

    const employeeStats = activeEmployees.map(emp => {
      const tasks = taskOps.findByEmployeeId(emp.id);
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const pendingTasks = tasks.filter(t => t.status === 'pending');
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress');

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        role: emp.role,
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        pendingTasks: pendingTasks.length,
        inProgressTasks: inProgressTasks.length,
        utilizationRate: tasks.length > 0
          ? ((completedTasks.length / tasks.length) * 100).toFixed(1)
          : 0
      };
    });

    const avgUtilization = employeeStats.length > 0
      ? (employeeStats.reduce((sum, e) => sum + parseFloat(e.utilizationRate), 0) / employeeStats.length).toFixed(1)
      : 0;

    return {
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
      avgUtilizationRate: parseFloat(avgUtilization),
      employees: employeeStats
    };
  }

  /**
   * Get dashboard overview (main KPI summary)
   */
  getDashboardOverview() {
    return {
      mrr: this.calculateMRR(),
      activeCustomers: this.getActiveCustomers(),
      tasks: this.getTaskMetrics(),
      planDistribution: this.getPlanDistribution(),
      contactFunnel: this.getContactFunnel(),
      employeeUtilization: this.getEmployeeUtilization(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get KPI cards data (for dashboard cards display)
   */
  getKPICards() {
    const mrr = this.calculateMRR();
    const activeCustomers = this.getActiveCustomers();
    const taskMetrics = this.getTaskMetrics();

    return [
      {
        id: 'mrr',
        label: 'MRR',
        value: mrr.mrrFormatted,
        rawValue: mrr.mrr,
        change: '+12.5%',
        changeType: 'positive',
        trend: 'up'
      },
      {
        id: 'active-customers',
        label: 'Khách hàng hoạt động',
        value: activeCustomers.count.toString(),
        rawValue: activeCustomers.count,
        change: '+3',
        changeType: 'positive',
        trend: 'up'
      },
      {
        id: 'tasks-completed',
        label: 'Tác vụ hoàn thành',
        value: taskMetrics.total.toString(),
        rawValue: taskMetrics.total,
        completed: taskMetrics.byStatus.completed,
        change: '+8',
        changeType: 'positive',
        trend: 'up'
      },
      {
        id: 'completion-rate',
        label: 'Tỷ lệ hoàn thành',
        value: `${taskMetrics.completionRate}%`,
        rawValue: taskMetrics.completionRate,
        change: '+2.3%',
        changeType: 'positive',
        trend: 'up'
      }
    ];
  }

  /**
   * Get chart data for visualizations
   */
  getChartData() {
    const planDist = this.getPlanDistribution();
    const revenueTrends = this.getRevenueTrends(7);
    const funnel = this.getContactFunnel();
    const taskMetrics = this.getTaskMetrics();

    return {
      // Pie chart: Plan distribution
      planDistribution: {
        labels: Object.values(planDist.distribution).map(d => d.planName),
        datasets: [{
          data: Object.values(planDist.distribution).map(d => d.subscriberCount),
          colors: ['#3B82F6', '#8B5CF6', '#F59E0B']
        }]
      },

      // Line chart: Revenue trends
      revenueTrends: {
        labels: revenueTrends.trends.map(t => t.dateFormatted),
        datasets: [{
          label: 'Doanh thu',
          data: revenueTrends.trends.map(t => t.revenue)
        }]
      },

      // Bar chart: Task status
      taskStatus: {
        labels: ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Đã hủy'],
        datasets: [{
          label: 'Tác vụ',
          data: [
            taskMetrics.byStatus.pending,
            taskMetrics.byStatus.in_progress,
            taskMetrics.byStatus.completed,
            taskMetrics.byStatus.cancelled
          ],
          colors: ['#3B82F6', '#8B5CF6', '#10B981', '#EF4444']
        }]
      },

      // Funnel chart: Contact funnel
      contactFunnel: {
        stages: funnel.stages
      }
    };
  }

  /**
   * Calculate simple trend (mock)
   */
  calculateTrend(current, days = 7) {
    // Mock trend calculation - in production would compare with previous period
    const change = Math.round((Math.random() - 0.3) * 20); // -20 to +10
    return {
      value: change,
      direction: change >= 0 ? 'up' : 'down',
      percentage: `${Math.abs(change)}%`
    };
  }

  /**
   * Format currency to Vietnamese format
   */
  formatCurrency(amount) {
    if (amount === undefined || amount === null) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Get recent activity feed
   */
  getRecentActivity(limit = 20) {
    const activities = [];

    // Recent tasks
    const recentTasks = taskOps.findAll({ limit, sortBy: 'updatedAt', order: 'desc' });
    recentTasks.forEach(task => {
      const employee = task.employeeId ? employeeOps.findById(task.employeeId) : null;
      activities.push({
        id: `task-${task.id}`,
        type: 'task',
        action: task.status === 'completed' ? 'completed' : task.status === 'in_progress' ? 'started' : 'created',
        entityType: 'task',
        entityId: task.id,
        entityName: task.title,
        description: `${task.status === 'completed' ? 'Hoàn thành' : task.status === 'in_progress' ? 'Bắt đầu' : 'Tạo'} tác vụ: ${task.title}`,
        employeeId: task.employeeId,
        employeeName: employee?.name || 'Unassigned',
        timestamp: task.updatedAt || task.createdAt,
        metadata: {
          status: task.status,
          priority: task.priority
        }
      });
    });

    // Recent contacts
    const recentContacts = contactOps.findAll({ limit: Math.floor(limit / 2), sortBy: 'createdAt', order: 'desc' });
    recentContacts.forEach(contact => {
      activities.push({
        id: `contact-${contact.id}`,
        type: 'contact',
        action: 'created',
        entityType: 'contact',
        entityId: contact.id,
        entityName: contact.name,
        description: `Thêm liên hệ mới: ${contact.name}`,
        employeeId: null,
        employeeName: null,
        timestamp: contact.createdAt,
        metadata: {
          status: contact.status,
          company: contact.company
        }
      });
    });

    // Recent subscriptions
    const recentSubscriptions = store.subscriptions
      .filter(s => s.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, Math.floor(limit / 4));
    recentSubscriptions.forEach(sub => {
      const contact = contactOps.findById(sub.contactId);
      const plan = planOps.findById(sub.planId);
      activities.push({
        id: `subscription-${sub.id}`,
        type: 'subscription',
        action: sub.status === 'active' ? 'activated' : sub.status,
        entityType: 'subscription',
        entityId: sub.id,
        entityName: plan?.name || 'Unknown Plan',
        description: `${sub.status === 'active' ? 'Kích hoạt' : 'Cập nhật'} subscription: ${plan?.name || 'Unknown'} cho ${contact?.name || 'Unknown'}`,
        employeeId: null,
        employeeName: null,
        timestamp: sub.createdAt,
        metadata: {
          status: sub.status,
          planName: plan?.name
        }
      });
    });

    // Sort all activities by timestamp (most recent first) and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const sortedActivities = activities.slice(0, limit);

    return {
      activities: sortedActivities,
      total: sortedActivities.length,
      limit,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'Dashboard Analytics',
      version: '1.0.0',
      status: 'operational',
      cacheSize: this.cache.size,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = DashboardAnalyticsService;
