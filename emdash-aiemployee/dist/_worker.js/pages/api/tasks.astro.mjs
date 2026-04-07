globalThis.process ??= {}; globalThis.process.env ??= {};
export { renderers } from '../../renderers.mjs';

const tasks = [];
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { employeeId, title, description, priority } = body;
    if (!employeeId) {
      return new Response(JSON.stringify({ error: "Employee ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!title || title.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Task title is required (min 3 characters)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const task = {
      id: crypto.randomUUID(),
      employeeId,
      title: title.trim(),
      description: description ? description.trim() : null,
      status: "pending",
      priority: priority || "medium",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    tasks.push(task);
    return new Response(JSON.stringify({
      success: true,
      data: task,
      message: "Task created successfully"
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error creating task:", error);
    return new Response(JSON.stringify({ error: "Failed to create task" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
const GET = async ({ url }) => {
  try {
    const { searchParams } = new URL(url);
    const status = searchParams.get("status");
    const employeeId = searchParams.get("employeeId");
    let filtered = [...tasks];
    if (status) {
      filtered = filtered.filter((t) => t.status === status);
    }
    if (employeeId) {
      filtered = filtered.filter((t) => t.employeeId === employeeId);
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
    console.error("Error fetching tasks:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch tasks" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
const PATCH = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, status, title, description, priority } = body;
    if (!id) {
      return new Response(JSON.stringify({ error: "Task ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    const validStatuses = ["pending", "in_progress", "completed", "cancelled"];
    if (status && !validStatuses.includes(status)) {
      return new Response(JSON.stringify({
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    tasks[index] = {
      ...tasks[index],
      ...status && { status },
      ...title && { title: title.trim() },
      ...description !== void 0 && { description: description?.trim() || null },
      ...priority && { priority },
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return new Response(JSON.stringify({
      success: true,
      data: tasks[index]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error updating task:", error);
    return new Response(JSON.stringify({ error: "Failed to update task" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  PATCH,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
