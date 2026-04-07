import type { APIRoute } from 'astro';

// Vietnamese tax code validation rules per Circular 68/2019
const TAX_CODE_WEIGHTS = [31, 29, 23, 19, 17, 13, 7, 5, 3];

function validateTaxCodeFormat(taxCode: string): { valid: boolean; message: string } {
  const cleaned = taxCode.replace(/\D/g, '');

  if (cleaned.length < 10 || cleaned.length > 13) {
    return { valid: false, message: `MST phải có 10-13 chữ số (hiện tại: ${cleaned.length})` };
  }

  // Checksum validation for 10-digit MST
  if (cleaned.length === 10) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned[i]) * TAX_CODE_WEIGHTS[i];
    }
    const check = (10 - (sum % 10)) % 10;
    if (check !== parseInt(cleaned[9])) {
      return { valid: false, message: 'MST 10 số không hợp lệ (checksum sai)' };
    }
  }

  return { valid: true, message: 'MST hợp lệ' };
}

function validateVATCalculation(totalAmount: number, vatAmount: number, vatRate: number): { valid: boolean; expectedVat: number; diff: number } {
  const expectedVat = Math.round(totalAmount - (totalAmount / (1 + vatRate / 100)));
  const diff = Math.abs(vatAmount - expectedVat);

  return {
    valid: diff <= 100, // Allow rounding difference
    expectedVat,
    diff
  };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { invoice } = body;

    if (!invoice) {
      return new Response(JSON.stringify({ error: 'invoice data is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const checks: Array<{ id: string; label: string; passed: boolean; message: string }> = [];
    let allPassed = true;

    // 1. Validate seller tax code
    if (invoice.seller?.taxCode) {
      const sellerValidation = validateTaxCodeFormat(invoice.seller.taxCode);
      checks.push({
        id: 'seller_tax_code',
        label: 'MST người bán',
        passed: sellerValidation.valid,
        message: sellerValidation.message
      });
      if (!sellerValidation.valid) allPassed = false;
    }

    // 2. Validate buyer tax code
    if (invoice.buyer?.taxCode) {
      const buyerValidation = validateTaxCodeFormat(invoice.buyer.taxCode);
      checks.push({
        id: 'buyer_tax_code',
        label: 'MST người mua',
        passed: buyerValidation.valid,
        message: buyerValidation.message
      });
      if (!buyerValidation.valid) allPassed = false;
    }

    // 3. Validate VAT rate
    const vatRate = invoice.vatRate || invoice.items?.[0]?.vatRate || 10;
    const validRates = [0, 5, 8, 10];
    if (!validRates.includes(vatRate)) {
      checks.push({
        id: 'vat_rate',
        label: 'Thuế suất VAT',
        passed: false,
        message: `Thuế suất ${vatRate}% không hợp lệ`
      });
      allPassed = false;
    } else {
      checks.push({
        id: 'vat_rate',
        label: 'Thuế suất VAT',
        passed: true,
        message: `${vatRate}% - hợp lệ theo quy định`
      });
    }

    // 4. Validate VAT calculation
    if (invoice.totalAmount && invoice.vatAmount) {
      const vatValidation = validateVATCalculation(
        invoice.totalAmount,
        invoice.vatAmount,
        vatRate
      );
      checks.push({
        id: 'vat_calculation',
        label: 'Tính toán VAT',
        passed: vatValidation.valid,
        message: vatValidation.valid
          ? 'Tính toán chính xác'
          : `Sai: mong đợi ${vatValidation.expectedVat.toLocaleString('vi-VN')} VND (chênh: ${vatValidation.diff.toLocaleString('vi-VN')} VND)`
      });
      if (!vatValidation.valid) allPassed = false;
    }

    // 5. Validate required fields
    if (!invoice.seller?.name) {
      checks.push({
        id: 'seller_name',
        label: 'Tên người bán',
        passed: false,
        message: 'Thiếu tên người bán'
      });
      allPassed = false;
    } else {
      checks.push({
        id: 'seller_name',
        label: 'Tên người bán',
        passed: true,
        message: 'Đã có'
      });
    }

    if (!invoice.buyer?.name) {
      checks.push({
        id: 'buyer_name',
        label: 'Tên người mua',
        passed: false,
        message: 'Thiếu tên người mua'
      });
      allPassed = false;
    } else {
      checks.push({
        id: 'buyer_name',
        label: 'Tên người mua',
        passed: true,
        message: 'Đã có'
      });
    }

    const result = {
      compliant: allPassed,
      checkCount: checks.length,
      passedCount: checks.filter(c => c.passed).length,
      failedCount: checks.filter(c => !c.passed).length,
      checks,
      reference: 'Thông tư 68/2019/TT-BTC',
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify({
      success: true,
      data: result,
      report: generateReport(result)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error checking compliance:', error);
    return new Response(JSON.stringify({ error: 'Failed to check compliance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

function generateReport(result: any): string {
  const status = result.compliant ? '✓ HỢP LỆ' : '✗ KHÔNG HỢP LỆ';
  let report = `BÁO CÁO KIỂM TRA TUÂN THỦ HÓA ĐƠN\n`;
  report += `═══════════════════════════════════════\n\n`;
  report += `Trạng thái: ${status}\n`;
  report += `Kiểm tra: ${result.passedCount}/${result.checkCount} đã qua\n`;
  report += `Tham chiếu: ${result.reference}\n\n`;

  if (!result.compliant) {
    report += `CÁC LỖI PHÁT HIỆN:\n`;
    report += `───────────────────────────────────────\n`;
    result.checks
      .filter((c: any) => !c.passed)
      .forEach((c: any) => {
        report += `• ${c.label}: ${c.message}\n`;
      });
  }

  return report;
}
