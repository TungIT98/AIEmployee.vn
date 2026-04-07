globalThis.process ??= {}; globalThis.process.env ??= {};
export { renderers } from '../../renderers.mjs';

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};
const validatePhone = (phone) => {
  if (!phone) return true;
  const re = /^[0-9\s\-\+\(\)]{8,}$/;
  return re.test(phone);
};
const contacts = [];
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, company, email, phone, plan, message } = body;
    if (!name || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Name is required (min 2 characters)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!company || company.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Company name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!email || !validateEmail(email)) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!validatePhone(phone)) {
      return new Response(JSON.stringify({ error: "Invalid phone number format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const contact = {
      id: crypto.randomUUID(),
      name: name.trim(),
      company: company.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : null,
      plan: plan || null,
      message: message ? message.trim() : null,
      status: "new",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    contacts.push(contact);
    return new Response(JSON.stringify({
      success: true,
      data: contact,
      message: "Contact form submitted successfully"
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error creating contact:", error);
    return new Response(JSON.stringify({ error: "Failed to submit contact form" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
const GET = async ({ url }) => {
  try {
    const { searchParams } = new URL(url);
    const status = searchParams.get("status");
    let filtered = [...contacts];
    if (status) {
      filtered = filtered.filter((c) => c.status === status);
    }
    return new Response(JSON.stringify({
      success: true,
      data: filtered,
      count: filtered.length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch contacts" }), {
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
