import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  company: text('company').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  plan: text('plan'),
  message: text('message'),
  status: text('status').default('new').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  priceDisplay: text('price_display').notNull(),
  period: text('period').default('tháng').notNull(),
  description: text('description').notNull(),
  features: text('features'), // JSON array
  taskLimit: integer('task_limit'),
  employeeCount: integer('employee_count').notNull(),
  featured: integer('featured', { mode: 'boolean' }).default(false),
  order: integer('order').default(0)
});

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  contactId: text('contact_id').notNull(),
  planId: text('plan_id').notNull(),
  planName: text('plan_name').notNull(),
  price: integer('price').notNull(),
  status: text('status').default('active').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  subscriptionId: text('subscription_id').notNull(),
  name: text('name').notNull(),
  role: text('role').default('general').notNull(),
  status: text('status').default('active').notNull(),
  config: text('config'), // JSON object
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('pending').notNull(),
  priority: text('priority').default('medium').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number'),
  sellerName: text('seller_name'),
  sellerTaxCode: text('seller_tax_code'),
  sellerAddress: text('seller_address'),
  buyerName: text('buyer_name'),
  buyerTaxCode: text('buyer_tax_code'),
  buyerAddress: text('buyer_address'),
  items: text('items'), // JSON array
  total: real('total'),
  status: text('status').default('draft').notNull(),
  portalInvoiceId: text('portal_invoice_id'),
  createdAt: text('created_at').notNull()
});

export type Contact = typeof contacts.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
