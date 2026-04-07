globalThis.process ??= {}; globalThis.process.env ??= {};
export { renderers } from '../../renderers.mjs';

const contacts = [];
const employees = [];
const tasks = [];
const GET = async () => {
  const totalContacts = contacts.length;
  const newContacts = contacts.filter((c) => c.status === "new").length;
  const totalEmployees = employees.length;
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter((t) => t.status === "pending").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  return new Response(JSON.stringify({
    success: true,
    data: {
      contacts: { total: totalContacts, new: newContacts },
      employees: { total: totalEmployees },
      tasks: {
        total: totalTasks,
        pending: pendingTasks,
        completed: completedTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0
      },
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
