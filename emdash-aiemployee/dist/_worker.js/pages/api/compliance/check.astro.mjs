globalThis.process ??= {}; globalThis.process.env ??= {};
export { renderers } from '../../../renderers.mjs';

const TAX_CODE_WEIGHTS = [31, 29, 23, 19, 17, 13, 7, 5, 3];
function validateTaxCodeFormat(taxCode) {
  const cleaned = taxCode.replace(/\D/g, "");
  if (cleaned.length < 10 || cleaned.length > 13) {
    return { valid: false, message: `MST phải có 10-13 chữ số (hiện tại: ${cleaned.length})` };
  }
  if (cleaned.length === 10) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned[i]) * TAX_CODE_WEIGHTS[i];
    }
    const check = (10 - sum % 10) % 10;
    if (check !== parseInt(cleaned[9])) {
      return { valid: false, message: "MST 10 số không hợp lệ (checksum sai)" };
    }
  }
  return { valid: true, message: "MST hợp lệ" };
}
function validateVATCalculation(totalAmount, vatAmount, vatRate) {
  const expectedVat = Math.round(totalAmount - totalAmount / (1 + vatRate / 100));
  const diff = Math.abs(vatAmount - expectedVat);
  return {
    valid: diff <= 100,
    // Allow rounding difference
    expectedVat,
    diff
  };
}
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { invoice } = body;
    if (!invoice) {
      return new Response(JSON.stringify({ error: "invoice data is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const checks = [];
    let allPassed = true;
    if (invoice.seller?.taxCode) {
      const sellerValidation = validateTaxCodeFormat(invoice.seller.taxCode);
      checks.push({
        id: "seller_tax_code",
        label: "MST người bán",
        passed: sellerValidation.valid,
        message: sellerValidation.message
      });
      if (!sellerValidation.valid) allPassed = false;
    }
    if (invoice.buyer?.taxCode) {
      const buyerValidation = validateTaxCodeFormat(invoice.buyer.taxCode);
      checks.push({
        id: "buyer_tax_code",
        label: "MST người mua",
        passed: buyerValidation.valid,
        message: buyerValidation.message
      });
      if (!buyerValidation.valid) allPassed = false;
    }
    const vatRate = invoice.vatRate || invoice.items?.[0]?.vatRate || 10;
    const validRates = [0, 5, 8, 10];
    if (!validRates.includes(vatRate)) {
      checks.push({
        id: "vat_rate",
        label: "Thuế suất VAT",
        passed: false,
        message: `Thuế suất ${vatRate}% không hợp lệ`
      });
      allPassed = false;
    } else {
      checks.push({
        id: "vat_rate",
        label: "Thuế suất VAT",
        passed: true,
        message: `${vatRate}% - hợp lệ theo quy định`
      });
    }
    if (invoice.totalAmount && invoice.vatAmount) {
      const vatValidation = validateVATCalculation(
        invoice.totalAmount,
        invoice.vatAmount,
        vatRate
      );
      checks.push({
        id: "vat_calculation",
        label: "Tính toán VAT",
        passed: vatValidation.valid,
        message: vatValidation.valid ? "Tính toán chính xác" : `Sai: mong đợi ${vatValidation.expectedVat.toLocaleString("vi-VN")} VND (chênh: ${vatValidation.diff.toLocaleString("vi-VN")} VND)`
      });
      if (!vatValidation.valid) allPassed = false;
    }
    if (!invoice.seller?.name) {
      checks.push({
        id: "seller_name",
        label: "Tên người bán",
        passed: false,
        message: "Thiếu tên người bán"
      });
      allPassed = false;
    } else {
      checks.push({
        id: "seller_name",
        label: "Tên người bán",
        passed: true,
        message: "Đã có"
      });
    }
    if (!invoice.buyer?.name) {
      checks.push({
        id: "buyer_name",
        label: "Tên người mua",
        passed: false,
        message: "Thiếu tên người mua"
      });
      allPassed = false;
    } else {
      checks.push({
        id: "buyer_name",
        label: "Tên người mua",
        passed: true,
        message: "Đã có"
      });
    }
    const result = {
      compliant: allPassed,
      checkCount: checks.length,
      passedCount: checks.filter((c) => c.passed).length,
      failedCount: checks.filter((c) => !c.passed).length,
      checks,
      reference: "Thông tư 68/2019/TT-BTC",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    return new Response(JSON.stringify({
      success: true,
      data: result,
      report: generateReport(result)
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error checking compliance:", error);
    return new Response(JSON.stringify({ error: "Failed to check compliance" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
function generateReport(result) {
  const status = result.compliant ? "✓ HỢP LỆ" : "✗ KHÔNG HỢP LỆ";
  let report = `BÁO CÁO KIỂM TRA TUÂN THỦ HÓA ĐƠN
`;
  report += `═══════════════════════════════════════

`;
  report += `Trạng thái: ${status}
`;
  report += `Kiểm tra: ${result.passedCount}/${result.checkCount} đã qua
`;
  report += `Tham chiếu: ${result.reference}

`;
  if (!result.compliant) {
    report += `CÁC LỖI PHÁT HIỆN:
`;
    report += `───────────────────────────────────────
`;
    result.checks.filter((c) => !c.passed).forEach((c) => {
      report += `• ${c.label}: ${c.message}
`;
    });
  }
  return report;
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
