import type { APIRoute } from 'astro';

// In-memory store (replace with D1)
const subscriptions: any[] = [];

// Static plans for validation
const plans: Record<string, any> = {
  starter: { id: 'starter', name: 'Starter', price: 199000, employeeCount: 1 },
  growth: { id: 'growth', name: 'Growth', price: 499000, employeeCount: 3 },
  scale: { id: 'scale', name: 'Scale', price: 999000, employeeCount: 10 }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { contactId, planId } = body;

    if (!contactId) {
      return new Response(JSON.stringify({ error: 'Contact ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!planId) {
      return new Response(JSON.stringify({ error: 'Plan ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const plan = plans[planId];
    if (!plan) {
      return new Response(JSON.stringify({ error: 'Plan not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const subscription = {
      id: crypto.randomUUID(),
      contactId,
      planId,
      planName: plan.name,
      price: plan.price,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    subscriptions.push(subscription);

    return new Response(JSON.stringify({
      success: true,
      data: subscription,
      message: 'Subscription created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return new Response(JSON.stringify({ error: 'Failed to create subscription' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const { searchParams } = new URL(url);
    const contactId = searchParams.get('contactId');

    let filtered = [...subscriptions];
    if (contactId) {
      filtered = filtered.filter(s => s.contactId === contactId);
    }

    return new Response(JSON.stringify({
      success: true,
      data: filtered,
      count: filtered.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
