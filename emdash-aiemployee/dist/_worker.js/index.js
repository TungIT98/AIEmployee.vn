globalThis.process ??= {}; globalThis.process.env ??= {};
import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_C3a5m-hZ.mjs';
import { manifest } from './manifest_CIUtYvtQ.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/api/compliance/check.astro.mjs');
const _page2 = () => import('./pages/api/contacts.astro.mjs');
const _page3 = () => import('./pages/api/employees.astro.mjs');
const _page4 = () => import('./pages/api/invoices.astro.mjs');
const _page5 = () => import('./pages/api/metrics.astro.mjs');
const _page6 = () => import('./pages/api/plans.astro.mjs');
const _page7 = () => import('./pages/api/status.astro.mjs');
const _page8 = () => import('./pages/api/subscriptions.astro.mjs');
const _page9 = () => import('./pages/api/tasks.astro.mjs');
const _page10 = () => import('./pages/api/vat/calculate.astro.mjs');
const _page11 = () => import('./pages/api/zalo/status.astro.mjs');
const _page12 = () => import('./pages/tools/compliance.astro.mjs');
const _page13 = () => import('./pages/tools/invoice-upload.astro.mjs');
const _page14 = () => import('./pages/tools/vat-calculator.astro.mjs');
const _page15 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/.pnpm/@astrojs+cloudflare@12.6.13_b323a51ac2ab57725146cdd914d6865b/node_modules/@astrojs/cloudflare/dist/entrypoints/image-endpoint.js", _page0],
    ["src/pages/api/compliance/check.ts", _page1],
    ["src/pages/api/contacts.ts", _page2],
    ["src/pages/api/employees.ts", _page3],
    ["src/pages/api/invoices.ts", _page4],
    ["src/pages/api/metrics.ts", _page5],
    ["src/pages/api/plans.ts", _page6],
    ["src/pages/api/status.ts", _page7],
    ["src/pages/api/subscriptions.ts", _page8],
    ["src/pages/api/tasks.ts", _page9],
    ["src/pages/api/vat/calculate.ts", _page10],
    ["src/pages/api/zalo/status.ts", _page11],
    ["src/pages/tools/compliance.astro", _page12],
    ["src/pages/tools/invoice-upload.astro", _page13],
    ["src/pages/tools/vat-calculator.astro", _page14],
    ["src/pages/index.astro", _page15]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_astro-internal_middleware.mjs')
});
const _args = undefined;
const _exports = createExports(_manifest);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { __astrojsSsrVirtualEntry as default, pageMap };
