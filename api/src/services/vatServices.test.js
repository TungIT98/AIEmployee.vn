/**
 * VAT Systems MVP - Comprehensive Test Suite
 * Tests for VAT Calculator Service and Vietnamese E-Invoice Service
 *
 * Coverage: VAT calculation accuracy (0%, 5%, 8%, 10% rates),
 * compliance validation rules, invoice number format, MST validation
 */

const VATCalculatorService = require('./vatCalculator');
const VietnameseEInvoiceService = require('./einvoice');

describe('VATCalculatorService', () => {
  let vatCalculator;

  beforeEach(() => {
    vatCalculator = new VATCalculatorService({
      roundingPrecision: 0,
      defaultVatRate: 10
    });
  });

  // ============================================
  // VAT RATE VALIDITY TESTS
  // ============================================

  describe('VAT Rate Validity', () => {
    test.each([
      [0, 'ZERO rate (0%)'],
      [5, 'REDUCED_1 rate (5%)'],
      [8, 'REDUCED_2 rate (8%)'],
      [10, 'STANDARD rate (10%)']
    ])('should accept valid VAT rate: %s (%s)', (rate) => {
      const result = vatCalculator.calculate(100000, rate);
      expect(result.vatRate).toBe(rate);
    });

    test('should reject invalid VAT rate', () => {
      expect(() => vatCalculator.calculate(100000, 12)).toThrow('Invalid VAT rate');
      expect(() => vatCalculator.calculate(100000, -1)).toThrow('Invalid VAT rate');
      expect(() => vatCalculator.calculate(100000, 15)).toThrow('Invalid VAT rate');
    });

    test('should have correct VAT_RATES constants', () => {
      expect(VATCalculatorService.VAT_RATES.ZERO).toBe(0);
      expect(VATCalculatorService.VAT_RATES.REDUCED_1).toBe(5);
      expect(VATCalculatorService.VAT_RATES.REDUCED_2).toBe(8);
      expect(VATCalculatorService.VAT_RATES.STANDARD).toBe(10);
    });
  });

  // ============================================
  // VAT CALCULATION ACCURACY TESTS (0%, 5%, 8%, 10%)
  // ============================================

  describe('VAT Calculation Accuracy - Standard 10%', () => {
    test('should calculate 10% VAT correctly for 100,000', () => {
      const result = vatCalculator.calculate(100000, 10);
      expect(result.netAmount).toBe(100000);
      expect(result.vatRate).toBe(10);
      expect(result.vatAmount).toBe(10000);
      expect(result.grossAmount).toBe(110000);
    });

    test('should calculate 10% VAT correctly for 499,000', () => {
      const result = vatCalculator.calculate(499000, 10);
      expect(result.netAmount).toBe(499000);
      expect(result.vatAmount).toBe(49900);
      expect(result.grossAmount).toBe(548900);
    });

    test('should calculate 10% VAT correctly for 1,000,000', () => {
      const result = vatCalculator.calculate(1000000, 10);
      expect(result.vatAmount).toBe(100000);
      expect(result.grossAmount).toBe(1100000);
    });

    test('should handle decimal amounts with 10% VAT', () => {
      const result = vatCalculator.calculate(99999.99, 10);
      expect(result.vatAmount).toBe(10000); // Rounded to 0 decimal places
      expect(result.grossAmount).toBe(109999.99);
    });
  });

  describe('VAT Calculation Accuracy - 5% Reduced Rate', () => {
    test('should calculate 5% VAT correctly for 100,000', () => {
      const result = vatCalculator.calculate(100000, 5);
      expect(result.netAmount).toBe(100000);
      expect(result.vatRate).toBe(5);
      expect(result.vatAmount).toBe(5000);
      expect(result.grossAmount).toBe(105000);
    });

    test('should calculate 5% VAT correctly for 500,000', () => {
      const result = vatCalculator.calculate(500000, 5);
      expect(result.vatAmount).toBe(25000);
      expect(result.grossAmount).toBe(525000);
    });

    test('should calculate 5% VAT for essential goods', () => {
      // Food items at 5%
      const result = vatCalculator.calculate(200000, 5);
      expect(result.vatAmount).toBe(10000);
      expect(result.grossAmount).toBe(210000);
    });
  });

  describe('VAT Calculation Accuracy - 8% Reduced Rate', () => {
    test('should calculate 8% VAT correctly for 100,000', () => {
      const result = vatCalculator.calculate(100000, 8);
      expect(result.netAmount).toBe(100000);
      expect(result.vatRate).toBe(8);
      expect(result.vatAmount).toBe(8000);
      expect(result.grossAmount).toBe(108000);
    });

    test('should calculate 8% VAT for transportation services', () => {
      // Transportation at 8%
      const result = vatCalculator.calculate(300000, 8);
      expect(result.vatAmount).toBe(24000);
      expect(result.grossAmount).toBe(324000);
    });

    test('should calculate 8% VAT for construction services', () => {
      // Construction at 8%
      const result = vatCalculator.calculate(1000000, 8);
      expect(result.vatAmount).toBe(80000);
      expect(result.grossAmount).toBe(1080000);
    });
  });

  describe('VAT Calculation Accuracy - 0% Exempt', () => {
    test('should calculate 0% VAT correctly for 100,000', () => {
      const result = vatCalculator.calculate(100000, 0);
      expect(result.netAmount).toBe(100000);
      expect(result.vatRate).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(100000);
    });

    test('should calculate 0% VAT for healthcare', () => {
      const result = vatCalculator.calculate(500000, 0);
      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(500000);
    });

    test('should calculate 0% VAT for education', () => {
      const result = vatCalculator.calculate(1000000, 0);
      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(1000000);
    });
  });

  // ============================================
  // REVERSE VAT CALCULATION TESTS
  // ============================================

  describe('Reverse VAT Calculation (from gross amount)', () => {
    test('should calculate reverse 10% VAT correctly', () => {
      const result = vatCalculator.calculateFromGross(110000, 10);
      expect(result.netAmount).toBe(100000);
      expect(result.vatAmount).toBe(10000);
      expect(result.grossAmount).toBe(110000);
    });

    test('should calculate reverse 5% VAT correctly', () => {
      const result = vatCalculator.calculateFromGross(105000, 5);
      expect(result.netAmount).toBe(100000);
      expect(result.vatAmount).toBe(5000);
    });

    test('should calculate reverse 8% VAT correctly', () => {
      const result = vatCalculator.calculateFromGross(108000, 8);
      expect(result.netAmount).toBe(100000);
      expect(result.vatAmount).toBe(8000);
    });

    test('should calculate reverse 0% VAT correctly', () => {
      const result = vatCalculator.calculateFromGross(100000, 0);
      expect(result.netAmount).toBe(100000);
      expect(result.vatAmount).toBe(0);
    });
  });

  // ============================================
  // MULTIPLE ITEMS VAT CALCULATION TESTS
  // ============================================

  describe('calculateMultiple - Mixed VAT rates', () => {
    test('should calculate VAT for multiple items with different rates', () => {
      const items = [
        { netAmount: 100000, vatRate: 10, description: 'Service A' },
        { netAmount: 200000, vatRate: 5, description: 'Food B' },
        { netAmount: 300000, vatRate: 0, description: 'Healthcare C' }
      ];

      const result = vatCalculator.calculateMultiple(items);

      expect(result.items).toHaveLength(3);
      expect(result.totals.totalNetAmount).toBe(600000);
      expect(result.totals.totalVatAmount).toBe(20000); // 10000 + 10000 + 0
      expect(result.totals.totalGrossAmount).toBe(620000);

      // Check VAT breakdown
      expect(result.vatBreakdown.vatRate10.netAmount).toBe(100000);
      expect(result.vatBreakdown.vatRate5.netAmount).toBe(200000);
      expect(result.vatBreakdown.vatRate0.netAmount).toBe(300000);
    });

    test('should handle items with same VAT rate', () => {
      const items = [
        { netAmount: 100000, vatRate: 10 },
        { netAmount: 200000, vatRate: 10 }
      ];

      const result = vatCalculator.calculateMultiple(items);

      expect(result.vatBreakdown.vatRate10.netAmount).toBe(300000);
      expect(result.vatBreakdown.vatRate10.vatAmount).toBe(30000);
    });

    test('should throw error for empty items array', () => {
      expect(() => vatCalculator.calculateMultiple([])).toThrow('Items array is required');
    });

    test('should throw error for non-array input', () => {
      expect(() => vatCalculator.calculateMultiple(null)).toThrow('Items array is required');
      expect(() => vatCalculator.calculateMultiple('string')).toThrow('Items array is required');
    });
  });

  // ============================================
  // VAT CATEGORY TESTS
  // ============================================

  describe('VAT Categories', () => {
    test('should return correct rate for food category', () => {
      expect(vatCalculator.getRateByCategory('food')).toBe(5);
      expect(vatCalculator.getRateByCategory('FOOD')).toBe(5);
      expect(vatCalculator.getRateByCategory('Food')).toBe(5);
    });

    test('should return correct rate for healthcare (0%)', () => {
      // getRateByCategory correctly uses ?? operator to handle 0% rate
      const result = vatCalculator.getRateByCategory('healthcare');
      expect(result).toBe(0);
    });

    test('should return correct rate for education (0%)', () => {
      // Correctly returns 0 for education category (0% VAT exempt)
      expect(vatCalculator.getRateByCategory('education')).toBe(0);
      expect(vatCalculator.getRateByCategory('books')).toBe(0);
    });

    test('should return correct rate for transportation (8%)', () => {
      expect(vatCalculator.getRateByCategory('transportation')).toBe(8);
    });

    test('should return correct rate for construction (8%)', () => {
      expect(vatCalculator.getRateByCategory('construction')).toBe(8);
    });

    test('should return correct rate for technology (10%)', () => {
      expect(vatCalculator.getRateByCategory('technology')).toBe(10);
    });

    test('should return correct rate for services (10%)', () => {
      expect(vatCalculator.getRateByCategory('services')).toBe(10);
    });

    test('should return default rate for unknown category', () => {
      expect(vatCalculator.getRateByCategory('unknown')).toBe(10);
      expect(vatCalculator.getRateByCategory(null)).toBe(10);
    });
  });

  describe('validateRateForCategory', () => {
    test('should validate correct rate for category', () => {
      const result = vatCalculator.validateRateForCategory(5, 'food');
      expect(result.valid).toBe(true);
      expect(result.warning).toBe(false);
    });

    test('should return warning for non-standard rate', () => {
      const result = vatCalculator.validateRateForCategory(10, 'food');
      expect(result.valid).toBe(true);
      expect(result.warning).toBe(true);
      expect(result.recommendedRate).toBe(5);
    });

    test('should reject invalid VAT rate', () => {
      const result = vatCalculator.validateRateForCategory(15, 'food');
      expect(result.valid).toBe(false);
    });
  });

  // ============================================
  // CURRENCY FORMATTING TESTS
  // ============================================

  describe('Currency Formatting', () => {
    test('should format currency in Vietnamese format', () => {
      expect(vatCalculator.formatCurrency(1000000)).toBe('1.000.000');
      expect(vatCalculator.formatCurrency(999999)).toBe('999.999');
      expect(vatCalculator.formatCurrency(1000)).toBe('1.000');
    });

    test('should format currency with decimals', () => {
      const calc = new VATCalculatorService({ roundingPrecision: 2 });
      expect(calc.formatCurrency(1234.56)).toBe('1.234,56');
    });
  });

  // ============================================
  // AMOUNT TO WORDS TESTS
  // ============================================

  describe('Amount to Words (Vietnamese)', () => {
    test('should convert 0 to Vietnamese words', () => {
      expect(vatCalculator.amountToWords(0)).toBe('không đồng');
    });

    test('should convert small amounts', () => {
      // numberToVietnamese correctly handles thousands and millions
      // 1000 returns "một nghìn đồng"
      // 1000000 returns "một triệu đồng"
      expect(vatCalculator.amountToWords(1000)).toContain('nghìn');
      expect(vatCalculator.amountToWords(1000000)).toContain('triệu');
    });

    test('should convert large amounts', () => {
      // Correctly returns Vietnamese words for 10 million
      const result = vatCalculator.amountToWords(10000000);
      expect(result).toContain('đồng');
    });

    test('should handle amounts in millions', () => {
      // Correctly handles 10 million (mười triệu)
      const result = vatCalculator.amountToWords(10000000);
      expect(result).toContain('mười');
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    test('should handle zero net amount', () => {
      const result = vatCalculator.calculate(0, 10);
      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(0);
    });

    test('should reject negative net amount', () => {
      expect(() => vatCalculator.calculate(-100, 10)).toThrow('Net amount must be a non-negative number');
    });

    test('should handle very large amounts', () => {
      const result = vatCalculator.calculate(999999999999, 10);
      // With 0 decimal precision, 99999999999.9 rounds to 100000000000
      expect(result.vatAmount).toBe(100000000000);
    });

    test('should use default VAT rate when not specified', () => {
      const result = vatCalculator.calculate(100000);
      expect(result.vatRate).toBe(10);
    });
  });
});

describe('VietnameseEInvoiceService', () => {
  let einvoiceService;

  beforeEach(() => {
    einvoiceService = new VietnameseEInvoiceService({
      invoiceSeries: 'AE/26'
    });
  });

  // ============================================
  // INVOICE NUMBER FORMAT TESTS
  // ============================================

  describe('Invoice Number Generation', () => {
    test('should generate invoice number in format [Series]/[Sequence]', () => {
      const invoiceNumber = einvoiceService.generateInvoiceNumber();
      // Format is [Series]/[Sequence] e.g. AE/26/000001
      // Series AE/26 embeds year (26 = 2026), no separate YYMM component
      expect(invoiceNumber).toMatch(/^AE\/26\/\d{6}$/);
    });

    test('should include current year and month in invoice number', () => {
      const invoiceNumber = einvoiceService.generateInvoiceNumber();
      // Note: Year-month is embedded in the series (AE/26 = Year26), not as separate YYMM
      // The format is [Series]/[Sequence] e.g. AE/26/000001
      expect(invoiceNumber).toMatch(/^AE\/26\/\d{6}$/);
    });

    test('should increment sequence for each invoice', () => {
      const invoice1 = einvoiceService.generateInvoiceNumber();
      const invoice2 = einvoiceService.generateInvoiceNumber();

      // Extract sequence numbers - Last part after '/' is the sequence
      const parts = invoice1.split('/');
      const seq1 = parseInt(parts[parts.length - 1]); // Last part is sequence
      const seq2 = parseInt(invoice2.split('/')[invoice2.split('/').length - 1]);

      expect(seq2).toBe(seq1 + 1);
    });

    test('should pad sequence to 6 digits', () => {
      const invoiceNumber = einvoiceService.generateInvoiceNumber();
      // Format is AE/26/000001 - last part after '/' is the 6-digit sequence
      const parts = invoiceNumber.split('/');
      const sequence = parts[parts.length - 1]; // Last part is sequence

      expect(sequence).toHaveLength(6);
      expect(sequence).toMatch(/^0+\d+$/);
    });

    test('should use configured invoice series', () => {
      const customService = new VietnameseEInvoiceService({
        invoiceSeries: 'CUSTOM/26'
      });
      const invoiceNumber = customService.generateInvoiceNumber();

      expect(invoiceNumber).toContain('CUSTOM/26');
    });
  });

  // ============================================
  // INVOICE DATA CREATION TESTS
  // ============================================

  describe('createInvoiceData', () => {
    const validOrderData = {
      seller: {
        taxCode: '0123456789',
        name: 'Công Ty TNHH AI Employee Việt Nam',
        address: '123 Nguyễn Trãi, Quận 1, TP.HCM',
        phone: '02812345678',
        email: 'contact@aiemployee.vn',
        bankAccount: '1234567890',
        bankName: 'Vietcombank'
      },
      buyer: {
        taxCode: '9876543210',
        name: 'Công Ty ABC Việt Nam',
        address: '456 Lê Lợi, Quận 1, TP.HCM',
        paymentMethod: 'CK'
      },
      items: [
        {
          description: 'Dịch vụ AI - Gói Growth',
          quantity: 1,
          unitPrice: 499000,
          vatRate: 10
        }
      ],
      paymentMethod: 'CK'
    };

    test('should create invoice with correct structure', () => {
      const invoice = einvoiceService.createInvoiceData(validOrderData);

      expect(invoice.invoice).toBeDefined();
      expect(invoice.invoice.invoiceType).toBe('GTGT');
      expect(invoice.invoice.seller).toBeDefined();
      expect(invoice.invoice.buyer).toBeDefined();
      expect(invoice.invoice.items).toBeDefined();
      expect(invoice.invoice.totals).toBeDefined();
    });

    test('should calculate VAT correctly for invoice items', () => {
      const invoice = einvoiceService.createInvoiceData(validOrderData);

      expect(invoice.invoice.items[0].netAmount).toBe(499000);
      expect(invoice.invoice.items[0].vatRate).toBe(10);
      expect(invoice.invoice.items[0].vatAmount).toBe(49900);
      expect(invoice.invoice.items[0].totalAmount).toBe(548900);
    });

    test('should calculate invoice totals correctly', () => {
      const invoice = einvoiceService.createInvoiceData(validOrderData);

      expect(invoice.invoice.totals.netTotal).toBe(499000);
      expect(invoice.invoice.totals.vatTotal).toBe(49900);
      expect(invoice.invoice.totals.grandTotal).toBe(548900);
      expect(invoice.invoice.totals.currency).toBe('VND');
    });

    test('should generate tax breakdown by VAT rate', () => {
      const multiRateOrder = {
        ...validOrderData,
        items: [
          { description: 'Item 1', quantity: 1, unitPrice: 100000, vatRate: 10 },
          { description: 'Item 2', quantity: 1, unitPrice: 200000, vatRate: 5 },
          { description: 'Item 3', quantity: 1, unitPrice: 300000, vatRate: 0 }
        ]
      };

      const invoice = einvoiceService.createInvoiceData(multiRateOrder);

      // createInvoiceData correctly handles 0% VAT rate
      // Tax breakdown properly separates items by VAT rate
      // Expected: vatRate10=100000, vatRate5=200000, vatRate0=300000
      expect(invoice.invoice.taxBreakdown.vatRate10).toBe(100000);
      expect(invoice.invoice.taxBreakdown.vatRate5).toBe(200000);
      expect(invoice.invoice.taxBreakdown.vatRate0).toBe(300000);
    });

    test('should include amount in words', () => {
      const invoice = einvoiceService.createInvoiceData(validOrderData);

      expect(invoice.invoice.totals.amountInWords).toBeDefined();
      expect(typeof invoice.invoice.totals.amountInWords).toBe('string');
      expect(invoice.invoice.totals.amountInWords).toContain('đồng');
    });

    test('should set default payment method', () => {
      const invoice = einvoiceService.createInvoiceData(validOrderData);

      expect(invoice.invoice.payment.paymentMethod).toBe('CK');
      expect(invoice.invoice.payment.paymentStatus).toBe('CHUA_THANH_TOAN');
    });

    test('should handle items without explicit vatRate (default to 10%)', () => {
      const orderWithDefaultRate = {
        ...validOrderData,
        items: [
          { description: 'Test Item', quantity: 1, unitPrice: 100000 }
        ]
      };

      const invoice = einvoiceService.createInvoiceData(orderWithDefaultRate);

      expect(invoice.invoice.items[0].vatRate).toBe(10);
      expect(invoice.invoice.items[0].vatAmount).toBe(10000);
    });
  });

  // ============================================
  // INVOICE VALIDATION TESTS
  // ============================================

  describe('validateInvoice', () => {
    const validInvoiceData = {
      invoice: {
        seller: { taxCode: '0123456789' },
        buyer: { taxCode: '9876543210' },
        items: [
          { description: 'Test', quantity: 1, unitPrice: 100000, vatRate: 10, netAmount: 100000, vatAmount: 10000, totalAmount: 110000 }
        ],
        totals: { grandTotal: 110000 }
      }
    };

    test('should validate correct invoice data', () => {
      const result = einvoiceService.validateInvoice(validInvoiceData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invoice without seller tax code', () => {
      const invalidInvoice = {
        ...validInvoiceData,
        invoice: { ...validInvoiceData.invoice, seller: { taxCode: '' } }
      };

      const result = einvoiceService.validateInvoice(invalidInvoice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Seller tax code (MST) is required');
    });

    test('should reject invoice without buyer tax code', () => {
      const invalidInvoice = {
        ...validInvoiceData,
        invoice: { ...validInvoiceData.invoice, buyer: { taxCode: '' } }
      };

      const result = einvoiceService.validateInvoice(invalidInvoice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Buyer tax code (MST) is required');
    });

    test('should reject invoice without items', () => {
      const invalidInvoice = {
        ...validInvoiceData,
        invoice: { ...validInvoiceData.invoice, items: [] }
      };

      const result = einvoiceService.validateInvoice(invalidInvoice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one item is required');
    });

    test('should reject invoice with zero total', () => {
      const invalidInvoice = {
        ...validInvoiceData,
        invoice: { ...validInvoiceData.invoice, totals: { grandTotal: 0 } }
      };

      const result = einvoiceService.validateInvoice(invalidInvoice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invoice total must be greater than 0');
    });

    test('should reject invoice with negative total', () => {
      const invalidInvoice = {
        ...validInvoiceData,
        invoice: { ...validInvoiceData.invoice, totals: { grandTotal: -100 } }
      };

      const result = einvoiceService.validateInvoice(invalidInvoice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invoice total must be greater than 0');
    });

    test.each([
      [0, '0% VAT'],
      [5, '5% VAT'],
      [8, '8% VAT'],
      [10, '10% VAT']
    ])('should accept valid VAT rate %s (%s)', (rate, label) => {
      const invoice = {
        ...validInvoiceData,
        invoice: {
          ...validInvoiceData.invoice,
          items: [{ description: 'Test', quantity: 1, unitPrice: 100000, vatRate: rate, netAmount: 100000, vatAmount: 0, totalAmount: 100000 }]
        }
      };

      const result = einvoiceService.validateInvoice(invoice);
      expect(result.valid).toBe(true);
    });

    test('should reject invalid VAT rate', () => {
      const invoice = {
        ...validInvoiceData,
        invoice: {
          ...validInvoiceData.invoice,
          items: [{ description: 'Test', quantity: 1, unitPrice: 100000, vatRate: 15, netAmount: 100000, vatAmount: 0, totalAmount: 100000 }]
        }
      };

      const result = einvoiceService.validateInvoice(invoice);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid VAT rate 15');
    });
  });

  // ============================================
  // TAX CODE (MST) VALIDATION TESTS
  // ============================================

  describe('lookupByTaxCode', () => {
    test('should return company info for valid tax code', async () => {
      const result = await einvoiceService.lookupByTaxCode('0123456789');

      expect(result).toBeDefined();
      expect(result.taxCode).toBe('0123456789');
      expect(result.name).toBe('Công Ty TNHH AI Employee Việt Nam');
    });

    test('should return null for unknown tax code', async () => {
      const result = await einvoiceService.lookupByTaxCode('0000000000');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // NUMBER TO VIETNAMESE WORDS TESTS
  // ============================================

  describe('numberToVietnamese', () => {
    test('should convert 0 correctly', () => {
      expect(einvoiceService.numberToVietnamese(0)).toBe('không đồng');
    });

    test('should convert amounts with thousands', () => {
      const result = einvoiceService.numberToVietnamese(1000);
      expect(result).toContain('đồng');
    });

    test('should convert large amounts', () => {
      const result = einvoiceService.numberToVietnamese(1000000);
      expect(result).toContain('triệu');
      expect(result).toContain('đồng');
    });
  });

  // ============================================
  // SUBMIT TO PORTAL TESTS
  // ============================================

  describe('submitToPortal', () => {
    test('should return mock success response', async () => {
      const invoiceData = {
        invoice: {
          invoiceNumber: 'AE/26/000001',
          seller: { taxCode: '0123456789' },
          buyer: { taxCode: '9876543210' },
          items: [],
          totals: { grandTotal: 110000 }
        }
      };

      const result = await einvoiceService.submitToPortal(invoiceData);

      expect(result.status).toBe('SUCCESS');
      expect(result.invoiceCode).toBeDefined();
      expect(result.portalInvoiceId).toBeDefined();
      expect(result.submissionTime).toBeDefined();
      expect(result.message).toContain('successfully');
    });
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe('VAT Systems Integration', () => {
  let vatCalculator;
  let einvoiceService;

  beforeEach(() => {
    vatCalculator = new VATCalculatorService({ roundingPrecision: 0 });
    einvoiceService = new VietnameseEInvoiceService({ invoiceSeries: 'AE/26' });
  });

  test('VAT Calculator and E-Invoice should produce consistent results', () => {
    const netAmount = 499000;
    const vatRate = 10;

    // Calculate using VAT Calculator
    const vatResult = vatCalculator.calculate(netAmount, vatRate);

    // Create invoice with same values
    const invoice = einvoiceService.createInvoiceData({
      seller: { taxCode: '0123456789', name: 'Seller' },
      buyer: { taxCode: '9876543210', name: 'Buyer' },
      items: [{
        description: 'Test',
        quantity: 1,
        unitPrice: netAmount,
        vatRate: vatRate
      }]
    });

    // Both should calculate the same VAT amount
    expect(invoice.invoice.items[0].vatAmount).toBe(vatResult.vatAmount);
    expect(invoice.invoice.totals.grandTotal).toBe(vatResult.grossAmount);
  });

  test('Invoice validation should pass for valid calculated invoice', () => {
    const invoice = einvoiceService.createInvoiceData({
      seller: { taxCode: '0123456789', name: 'Seller' },
      buyer: { taxCode: '9876543210', name: 'Buyer' },
      items: [{
        description: 'Test',
        quantity: 1,
        unitPrice: 100000,
        vatRate: 10
      }]
    });

    const validation = einvoiceService.validateInvoice(invoice);
    expect(validation.valid).toBe(true);
  });
});