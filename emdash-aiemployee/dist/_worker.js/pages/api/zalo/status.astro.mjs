globalThis.process ??= {}; globalThis.process.env ??= {};
export { renderers } from '../../../renderers.mjs';

const GET = async () => {
  return new Response(JSON.stringify({
    success: true,
    data: {
      service: "Zalo Integration",
      status: "configured",
      testMode: true,
      availableEndpoints: [
        "POST /api/zalo/message - Send text message",
        "POST /api/zalo/message/template - Send template message",
        "POST /api/zalo/notification/invoice - Send invoice notification",
        "POST /api/zalo/notification/payment - Send payment confirmation"
      ]
    }
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, message, type } = body;
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      data: {
        messageId: `zalo_${Date.now()}`,
        userId,
        type: type || "text",
        status: "sent",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      },
      mock: true,
      note: "Test mode - Zalo API not connected"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error sending Zalo message:", error);
    return new Response(JSON.stringify({ error: "Failed to send Zalo message" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
