import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    success: true,
    data: {
      service: 'AIEmployee API',
      version: '1.0.0',
      status: 'operational',
      environment: import.meta.env.PROD ? 'production' : 'development',
      timestamp: new Date().toISOString()
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
