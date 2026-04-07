import type { APIRoute } from 'astro';

// In-memory store (replace with D1)
const employees: any[] = [];

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { subscriptionId, name, role, config } = body;

    if (!subscriptionId) {
      return new Response(JSON.stringify({ error: 'Subscription ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!name || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Employee name is required (min 2 characters)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const employee = {
      id: crypto.randomUUID(),
      subscriptionId,
      name: name.trim(),
      role: role || 'general',
      status: 'active',
      config: config || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    employees.push(employee);

    return new Response(JSON.stringify({
      success: true,
      data: employee,
      message: 'Employee created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    return new Response(JSON.stringify({ error: 'Failed to create employee' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const { searchParams } = new URL(url);
    const subscriptionId = searchParams.get('subscriptionId');

    let filtered = [...employees];
    if (subscriptionId) {
      filtered = filtered.filter(e => e.subscriptionId === subscriptionId);
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
    console.error('Error fetching employees:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch employees' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
