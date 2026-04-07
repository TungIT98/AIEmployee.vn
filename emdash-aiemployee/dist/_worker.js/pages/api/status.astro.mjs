globalThis.process ??= {}; globalThis.process.env ??= {};
export { renderers } from '../../renderers.mjs';

const GET = async () => {
  return new Response(JSON.stringify({
    success: true,
    data: {
      service: "AIEmployee API",
      version: "1.0.0",
      status: "operational",
      environment: "production" ,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
