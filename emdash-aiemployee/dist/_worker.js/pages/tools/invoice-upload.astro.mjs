globalThis.process ??= {}; globalThis.process.env ??= {};
/* empty css                                    */
import { e as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../../chunks/astro/server_Cfu44OFc.mjs';
import { $ as $$Base } from '../../chunks/Base_APq2YZNl.mjs';
/* empty css                                             */
export { renderers } from '../../renderers.mjs';

const $$InvoiceUpload = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Base", $$Base, { "title": "T\u1EA3i l\xEAn h\xF3a \u0111\u01A1n | AIEmployee.vn", "description": "Upload h\xF3a \u0111\u01A1n \u0111\u1EC3 tr\xEDch xu\u1EA5t th\xF4ng tin t\u1EF1 \u0111\u1ED9ng b\u1EB1ng OCR", "canonical": "https://aiemployee.vn/tools/invoice-upload", "data-astro-cid-chukuv5l": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="container" style="padding-top: 120px; padding-bottom: 60px; max-width: 1000px;" data-astro-cid-chukuv5l> <div class="page-header" data-astro-cid-chukuv5l> <h1 data-astro-cid-chukuv5l>Tải lên hóa đơn</h1> <p data-astro-cid-chukuv5l>OCR tự động trích xuất thông tin từ hóa đơn VAT Việt Nam</p> </div> <div class="upload-card" data-astro-cid-chukuv5l> <div class="dropzone" id="dropzone" data-astro-cid-chukuv5l> <input type="file" id="fileInput" accept="image/*,.pdf" style="display: none;" data-astro-cid-chukuv5l> <div class="dropzone-icon" data-astro-cid-chukuv5l>📄</div> <h3 data-astro-cid-chukuv5l>Kéo thả file vào đây</h3> <p data-astro-cid-chukuv5l>hoặc click để chọn file</p> <p class="file-types" data-astro-cid-chukuv5l>Hỗ trợ: JPEG, PNG, PDF</p> </div> <div class="upload-progress" id="uploadProgress" style="display: none;" data-astro-cid-chukuv5l> <div class="progress-bar" data-astro-cid-chukuv5l> <div class="progress-fill" id="progressFill" data-astro-cid-chukuv5l></div> </div> <p class="progress-text" id="progressText" data-astro-cid-chukuv5l>Đang xử lý...</p> </div> </div> <div class="results-card" id="resultsCard" style="display: none;" data-astro-cid-chukuv5l> <h2 data-astro-cid-chukuv5l>Kết quả OCR</h2> <div class="result-fields" id="resultFields" data-astro-cid-chukuv5l></div> <div class="result-actions" data-astro-cid-chukuv5l> <button class="btn btn-primary" id="copyResultBtn" data-astro-cid-chukuv5l> <span data-astro-cid-chukuv5l>📋</span> Sao chép kết quả
</button> <button class="btn btn-secondary" id="newUploadBtn" data-astro-cid-chukuv5l> <span data-astro-cid-chukuv5l>↺</span> Upload mới
</button> </div> </div> <div class="info-card" data-astro-cid-chukuv5l> <h3 data-astro-cid-chukuv5l>📋 Hướng dẫn</h3> <ul data-astro-cid-chukuv5l> <li data-astro-cid-chukuv5l>Upload hình ảnh hóa đơn VAT rõ ràng, có đủ thông tin</li> <li data-astro-cid-chukuv5l>Đảm bảo ánh sáng tốt, không bị mờ hoặc che khuất</li> <li data-astro-cid-chukuv5l>Hệ thống sẽ trích xuất: Tên công ty, MST, địa chỉ, các mặt hàng</li> <li data-astro-cid-chukuv5l>Kiểm tra lại thông tin trước khi sử dụng</li> </ul> </div> </div> ` })}  ${renderScript($$result, "C:/Users/PC/.paperclip/instances/default/workspaces/company-os/emdash-aiemployee/src/pages/tools/invoice-upload.astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/Users/PC/.paperclip/instances/default/workspaces/company-os/emdash-aiemployee/src/pages/tools/invoice-upload.astro", void 0);

const $$file = "C:/Users/PC/.paperclip/instances/default/workspaces/company-os/emdash-aiemployee/src/pages/tools/invoice-upload.astro";
const $$url = "/tools/invoice-upload";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$InvoiceUpload,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
