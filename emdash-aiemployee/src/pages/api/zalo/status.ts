import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    success: true,
    data: {
      service: 'Zalo Integration',
      status: 'configured',
      testMode: true,
      availableEndpoints: [
        'POST /api/zalo/message - Send text message',
        'POST /api/zalo/message/template - Send template message',
        'POST /api/zalo/notification/invoice - Send invoice notification',
        'POST /api/zalo/notification/payment - Send payment confirmation'
      ]
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, message, type } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mock response for test mode
    return new Response(JSON.stringify({
      success: true,
      data: {
        messageId: `zalo_${Date.now()}`,
        userId,
        type: type || 'text',
        status: 'sent',
        timestamp: new Date().toISOString()
      },
      mock: true,
      note: 'Test mode - Zalo API not connected'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error sending Zalo message:', error);
    return new Response(JSON.stringify({ error: 'Failed to send Zalo message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
