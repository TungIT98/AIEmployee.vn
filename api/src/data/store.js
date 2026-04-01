const { v4: uuidv4 } = require('uuid');

// In-memory data store for MVP
// Replace with real database in production
const store = {
  contacts: [],
  subscriptions: [],
  plans: [
    {
      id: 'starter',
      name: 'Starter',
      price: 199000,
      priceDisplay: '199K',
      period: 'tháng',
      description: '1 nhân viên AI cơ bản',
      features: [
        '1 AI Employee',
        'Xử lý 100 tác vụ/ngày',
        'Hỗ trợ chat cơ bản',
        'Báo cáo tuần'
      ],
      taskLimit: 100,
      employeeCount: 1
    },
    {
      id: 'growth',
      name: 'Growth',
      price: 499000,
      priceDisplay: '499K',
      period: 'tháng',
      description: '3 nhân viên AI nâng cao',
      features: [
        '3 AI Employees',
        'Xử lý 500 tác vụ/ngày',
        'Hỗ trợ đa ngôn ngữ',
        'Tích hợp API',
        'Báo cáo realtime'
      ],
      taskLimit: 500,
      employeeCount: 3
    },
    {
      id: 'scale',
      name: 'Scale',
      price: 999000,
      priceDisplay: '999K',
      period: 'tháng',
      description: '10 nhân viên AI toàn diện',
      features: [
        '10 AI Employees',
        'Xử lý không giới hạn',
        'AI tự học theo doanh nghiệp',
        'Priority support 24/7',
        'Dedicated account manager'
      ],
      taskLimit: Infinity,
      employeeCount: 10
    }
  ],
  employees: [],
  tasks: []
};

// Contact operations
const contactOps = {
  create: (data) => {
    const contact = {
      id: uuidv4(),
      ...data,
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.contacts.push(contact);
    return contact;
  },

  findById: (id) => {
    return store.contacts.find(c => c.id === id);
  },

  findAll: (filters = {}) => {
    let results = [...store.contacts];
    if (filters.status) {
      results = results.filter(c => c.status === filters.status);
    }
    return results;
  },

  update: (id, data) => {
    const index = store.contacts.findIndex(c => c.id === id);
    if (index === -1) return null;
    store.contacts[index] = {
      ...store.contacts[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    return store.contacts[index];
  }
};

// Plan operations
const planOps = {
  findAll: () => store.plans,

  findById: (id) => store.plans.find(p => p.id === id)
};

// Subscription operations
const subscriptionOps = {
  create: (data) => {
    const subscription = {
      id: uuidv4(),
      ...data,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.subscriptions.push(subscription);
    return subscription;
  },

  findById: (id) => store.subscriptions.find(s => s.id === id),

  findByContactId: (contactId) => store.subscriptions.filter(s => s.contactId === contactId),

  update: (id, data) => {
    const index = store.subscriptions.findIndex(s => s.id === id);
    if (index === -1) return null;
    store.subscriptions[index] = {
      ...store.subscriptions[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    return store.subscriptions[index];
  }
};

// Employee operations
const employeeOps = {
  create: (data) => {
    const employee = {
      id: uuidv4(),
      ...data,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.employees.push(employee);
    return employee;
  },

  findById: (id) => store.employees.find(e => e.id === id),

  findBySubscriptionId: (subscriptionId) => store.employees.filter(e => e.subscriptionId === subscriptionId),

  findAll: () => store.employees,

  update: (id, data) => {
    const index = store.employees.findIndex(e => e.id === id);
    if (index === -1) return null;
    store.employees[index] = {
      ...store.employees[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    return store.employees[index];
  },

  delete: (id) => {
    const index = store.employees.findIndex(e => e.id === id);
    if (index === -1) return false;
    store.employees.splice(index, 1);
    return true;
  }
};

// Task operations
const taskOps = {
  create: (data) => {
    const task = {
      id: uuidv4(),
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.tasks.push(task);
    return task;
  },

  findById: (id) => store.tasks.find(t => t.id === id),

  findByEmployeeId: (employeeId) => store.tasks.filter(t => t.employeeId === employeeId),

  findAll: (filters = {}) => {
    let results = [...store.tasks];
    if (filters.status) {
      results = results.filter(t => t.status === filters.status);
    }
    if (filters.employeeId) {
      results = results.filter(t => t.employeeId === filters.employeeId);
    }
    return results;
  },

  update: (id, data) => {
    const index = store.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;
    store.tasks[index] = {
      ...store.tasks[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    return store.tasks[index];
  }
};

module.exports = {
  store,
  contactOps,
  planOps,
  subscriptionOps,
  employeeOps,
  taskOps
};
