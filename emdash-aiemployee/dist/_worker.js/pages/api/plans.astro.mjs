globalThis.process ??= {}; globalThis.process.env ??= {};
export { renderers } from '../../renderers.mjs';

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 199e3,
    priceDisplay: "199K",
    period: "tháng",
    description: "1 nhân viên AI cơ bản",
    features: [
      "1 AI Employee",
      "Xử lý 100 tác vụ/ngày",
      "Hỗ trợ chat cơ bản",
      "Báo cáo tuần"
    ],
    taskLimit: 100,
    employeeCount: 1,
    featured: false,
    order: 1
  },
  {
    id: "growth",
    name: "Growth",
    price: 499e3,
    priceDisplay: "499K",
    period: "tháng",
    description: "3 nhân viên AI nâng cao",
    features: [
      "3 AI Employees",
      "Xử lý 500 tác vụ/ngày",
      "Hỗ trợ đa ngôn ngữ",
      "Tích hợp API",
      "Báo cáo realtime"
    ],
    taskLimit: 500,
    employeeCount: 3,
    featured: true,
    order: 2
  },
  {
    id: "scale",
    name: "Scale",
    price: 999e3,
    priceDisplay: "999K",
    period: "tháng",
    description: "10 nhân viên AI toàn diện",
    features: [
      "10 AI Employees",
      "Xử lý không giới hạn",
      "AI tự học theo doanh nghiệp",
      "Priority support 24/7",
      "Dedicated account manager"
    ],
    taskLimit: Infinity,
    employeeCount: 10,
    featured: false,
    order: 3
  }
];
const GET = async () => {
  return new Response(JSON.stringify({
    success: true,
    data: plans
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
