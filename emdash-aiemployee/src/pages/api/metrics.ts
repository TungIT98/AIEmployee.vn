import type { APIRoute } from 'astro';

// Reference to other stores (in real app, use D1)
const contacts: any[] = [];
const employees: any[] = [];
const tasks: any[] = [];

export const GET: APIRoute = async () => {
  const totalContacts = contacts.length;
  const newContacts = contacts.filter(c => c.status === 'new').length;
  const totalEmployees = employees.length;
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return new Response(JSON.stringify({
    success: true,
    data: {
      contacts: { total: totalContacts, new: newContacts },
      employees: { total: totalEmployees },
      tasks: {
        total: totalTasks,
        pending: pendingTasks,
        completed: completedTasks,
        completionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0
      },
      timestamp: new Date().toISOString()
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
