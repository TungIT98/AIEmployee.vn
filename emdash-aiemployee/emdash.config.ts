import { defineConfig } from 'emdash';
import type { Collection } from 'emdash';

const config = defineConfig({
  name: 'aiemployee-vn',
  tagline: 'Thuê Nhân Viên Ảo AI Cho Doanh Nghiệp Việt',
  url: 'https://aiemployee.vn',

  collections: {
    pages: {
      type: 'content',
      path: 'src/content/pages',
      schema: {
        title: { type: 'string', required: true },
        slug: { type: 'string', required: true },
        description: { type: 'string' },
        layout: { type: 'string', default: 'default' },
        seo: {
          title: { type: 'string' },
          description: { type: 'string' },
          canonical: { type: 'string' }
        }
      }
    } as Collection,

    plans: {
      type: 'content',
      path: 'src/content/plans',
      schema: {
        name: { type: 'string', required: true },
        price: { type: 'number', required: true },
        priceDisplay: { type: 'string', required: true },
        period: { type: 'string', default: 'tháng' },
        description: { type: 'string', required: true },
        features: { type: 'array', items: { type: 'string' } },
        taskLimit: { type: 'number' },
        employeeCount: { type: 'number', required: true },
        featured: { type: 'boolean', default: false },
        order: { type: 'number', default: 0 }
      }
    } as Collection,

    contacts: {
      type: 'data',
      path: 'src/content/data/contacts',
      schema: {
        name: { type: 'string', required: true },
        company: { type: 'string', required: true },
        email: { type: 'string', required: true },
        phone: { type: 'string' },
        plan: { type: 'string' },
        message: { type: 'string' },
        status: { type: 'string', default: 'new' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    } as Collection,

    employees: {
      type: 'data',
      path: 'src/content/data/employees',
      schema: {
        name: { type: 'string', required: true },
        role: { type: 'string', default: 'general' },
        status: { type: 'string', default: 'active' },
        subscriptionId: { type: 'string' },
        config: { type: 'object' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    } as Collection,

    tasks: {
      type: 'data',
      path: 'src/content/data/tasks',
      schema: {
        title: { type: 'string', required: true },
        description: { type: 'string' },
        status: { type: 'string', default: 'pending' },
        priority: { type: 'string', default: 'medium' },
        employeeId: { type: 'string', required: true },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    } as Collection,

    invoices: {
      type: 'data',
      path: 'src/content/data/invoices',
      schema: {
        invoiceNumber: { type: 'string' },
        seller: {
          name: { type: 'string' },
          taxCode: { type: 'string' },
          address: { type: 'string' }
        },
        buyer: {
          name: { type: 'string' },
          taxCode: { type: 'string' },
          address: { type: 'string' }
        },
        items: { type: 'array' },
        total: { type: 'number' },
        status: { type: 'string', default: 'draft' },
        portalInvoiceId: { type: 'string' },
        createdAt: { type: 'string' }
      }
    } as Collection
  },

  tools: {
    vatCalculator: {
      enabled: true,
      rates: [0, 5, 8, 10],
      defaultRate: 10
    },
    invoiceOCR: {
      enabled: true,
      language: 'vi',
      supportedFormats: ['jpeg', 'png', 'pdf']
    },
    compliance: {
      enabled: true,
      rules: 'circular68'
    }
  },

  integrations: {
    zalo: {
      enabled: false,
      testMode: true
    }
  }
});

export default config;
