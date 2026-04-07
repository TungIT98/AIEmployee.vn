/**
 * Invoice OCR Service - Proof of Concept
 * Part of VAT Systems MVP (COM-79)
 *
 * This is a POC demonstrating OCR capability for Vietnamese invoices.
 * In production, this would integrate with a real OCR service provider
 * like Google Cloud Vision, AWS Textract, or Vietnamese-specific services.
 */

class InvoiceOCRService {
  constructor(config = {}) {
    this.config = {
      // OCR provider configuration
      provider: config.provider || 'mock', // 'mock', 'google', 'aws', 'vietnamese-ocr'
      apiKey: config.OCR_API_KEY || '',
      endpoint: config.OCR_ENDPOINT || '',

      // Processing options
      language: config.language || 'vi', // Vietnamese
      extractTables: config.extractTables !== false,
      detectCurrency: config.detectCurrency !== false,

      // Validation options
      validateTaxCode: config.validateTaxCode !== false,
      validateInvoiceFormat: config.validateInvoiceFormat !== false,
      ...config
    };

    // Vietnamese invoice number format patterns
    this.invoicePatterns = {
      // GDT/GDTG (Hóa đơn điện tử) - Electronic invoice
      electronic: /^(AE|TK|HD|HDT)\/\d{2}\/\d{2,4}\/\d{6}$/i,
      // Traditional invoice format
      traditional: /^\d{3}\/\d{3}\/\d{3,6}$/i,
      // Municipal invoice format
      municipal: /^(MST|MS)\d{10}$/i
    };

    // Vietnamese tax code pattern (10 digits)
    this.taxCodePattern = /^\d{10}$/;
  }

  /**
   * Process an invoice image/PDF and extract structured data
   * @param {Buffer|string} fileData - Image or PDF file data (base64 or path)
   * @param {object} options - Processing options
   * @returns {Promise<object>} - Extracted invoice data
   */
  async processInvoice(fileData, options = {}) {
    const startTime = Date.now();

    try {
      // Step 1: Pre-process the image
      const preprocessed = await this.preprocess(fileData, options);

      // Step 2: OCR extraction
      const rawText = await this.extractText(preprocessed, options);

      // Step 3: Parse structured data from raw text
      const parsed = this.parseInvoiceData(rawText, options);

      // Step 4: Validate extracted data
      const validation = this.validateExtractedData(parsed);

      // Step 5: Enrich with additional data
      const enriched = await this.enrichData(parsed);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          ...enriched,
          rawText: this.config.provider === 'mock' ? rawText : undefined,
          confidence: enriched.confidence || 0.85,
          fields: enriched.fields || {}
        },
        validation: validation,
        metadata: {
          provider: this.config.provider,
          processingTimeMs: processingTime,
          language: this.config.language,
          processedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to process invoice',
        metadata: {
          provider: this.config.provider,
          processingTimeMs: Date.now() - startTime,
          processedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Preprocess image for better OCR accuracy
   * @param {Buffer|string} fileData - Raw file data
   * @param {object} options - Processing options
   * @returns {Promise<object>} - Preprocessed image data
   */
  async preprocess(fileData, options = {}) {
    // In production, this would:
    // - Convert PDF to image
    // - Enhance contrast
    // - Deskew/rotate if needed
    // - Remove noise

    return {
      originalData: fileData,
      format: this.detectFormat(fileData),
      dimensions: { width: 0, height: 0 }, // Would be extracted in production
      preprocessed: true
    };
  }

  /**
   * Extract text from image using OCR
   * @param {object} preprocessed - Preprocessed image data
   * @param {object} options - Processing options
   * @returns {Promise<string>} - Extracted raw text
   */
  async extractText(preprocessed, options = {}) {
    // Mock implementation for POC
    // In production, integrate with real OCR service

    if (this.config.provider === 'mock') {
      return this.generateMockOCRResult();
    }

    // Google Cloud Vision integration placeholder
    if (this.config.provider === 'google') {
      // Would use @google-cloud/vision
      throw new Error('Google OCR not implemented - provide API key');
    }

    // AWS Textract integration placeholder
    if (this.config.provider === 'aws') {
      throw new Error('AWS OCR not implemented - provide credentials');
    }

    throw new Error(`Unknown OCR provider: ${this.config.provider}`);
  }

  /**
   * Parse Vietnamese invoice data from OCR text
   * @param {string} rawText - Raw OCR text
   * @param {object} options - Processing options
   * @returns {object} - Parsed invoice data
   */
  parseInvoiceData(rawText, options = {}) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);

    const result = {
      invoiceNumber: this.extractField(lines, ['số hóa đơn', 'invoice no', 'so hoa don', 'số:']),
      invoiceDate: this.extractField(lines, ['ngày', 'date', 'ngày phát hành']),
      seller: {
        name: this.extractField(lines, ['tên người bán', 'seller', 'người bán', 'đơn vị bán']),
        taxCode: this.extractTaxCode(lines),
        address: this.extractField(lines, ['địa chỉ', 'address', 'địa chỉ người bán']),
        phone: this.extractField(lines, ['điện thoại', 'phone', 'tel']),
        email: this.extractField(lines, ['email'])
      },
      buyer: {
        name: this.extractField(lines, ['tên người mua', 'buyer', 'người mua', 'đơn vị mua']),
        taxCode: this.extractField(lines, ['mã số thuế người mua', 'buyer tax code', 'mst người mua'], 1),
        address: this.extractField(lines, ['địa chỉ người mua', 'buyer address']),
        phone: this.extractField(lines, ['điện thoại người mua', 'buyer phone'])
      },
      items: this.extractLineItems(lines),
      totals: this.extractTotals(lines),
      payment: this.extractPaymentInfo(lines),
      rawText: rawText
    };

    return result;
  }

  /**
   * Extract a field from text lines using multiple possible keywords
   * @param {Array} lines - Text lines to search
   * @param {Array} keywords - Possible keywords for the field
   * @param {number} extractMode - 0: extract after, 1: extract next line, 2: extract same line
   */
  extractField(lines, keywords, extractMode = 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      for (const keyword of keywords) {
        if (line.includes(keyword.toLowerCase())) {
          if (extractMode === 0) {
            // Extract value after colon or keyword
            const parts = lines[i].split(/[:\-]/);
            if (parts.length > 1) {
              return parts.slice(1).join(':').trim();
            }
          } else if (extractMode === 1 && i + 1 < lines.length) {
            // Extract from next line
            return lines[i + 1].trim();
          }
        }
      }
    }
    return null;
  }

  /**
   * Extract Vietnamese tax code (MST) from text
   * @param {Array} lines - Text lines
   * @returns {string|null} - Tax code or null
   */
  extractTaxCode(lines) {
    const taxCodeRegex = /\b(\d{10})\b/g;
    for (const line of lines) {
      const match = line.match(taxCodeRegex);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Extract line items from invoice
   * @param {Array} lines - Text lines
   * @returns {Array} - Extracted line items
   */
  extractLineItems(lines) {
    const items = [];
    const itemPatterns = [
      /^\d+\s+(.+?)\s+(\d+)\s+([\d\.,]+)\s+([\d\.,]+)/, // Quantity, unit price, total
      /^(.+?)\s+(\d+)\s+([\d\.]+)\s+(\d+)%/  // Name, qty, price, VAT%
    ];

    for (const line of lines) {
      for (const pattern of itemPatterns) {
        const match = line.match(pattern);
        if (match) {
          items.push({
            description: match[1].trim(),
            quantity: parseInt(match[2]) || 1,
            unitPrice: this.parseNumber(match[3]),
            amount: this.parseNumber(match[4])
          });
          break;
        }
      }
    }

    return items;
  }

  /**
   * Extract totals from invoice
   * @param {Array} lines - Text lines
   * @returns {object} - Extracted totals
   */
  extractTotals(lines) {
    let netTotal = 0;
    let vatTotal = 0;
    let grossTotal = 0;
    let vatRate = 10;

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('cộng tiền') || lowerLine.includes('subtotal') || lowerLine.includes('total before tax')) {
        netTotal = this.extractNumber(line);
      }
      if (lowerLine.includes('thuế') || lowerLine.includes('tax') || lowerLine.includes('vat')) {
        vatTotal = this.extractNumber(line);
        const vatMatch = line.match(/(\d+)%/);
        if (vatMatch) vatRate = parseInt(vatMatch[1]);
      }
      if (lowerLine.includes('tổng cộng') || lowerLine.includes('grand total') || lowerLine.includes('total')) {
        grossTotal = this.extractNumber(line);
      }
    }

    return { netTotal, vatTotal, grossTotal, vatRate };
  }

  /**
   * Extract payment information
   * @param {Array} lines - Text lines
   * @returns {object} - Payment info
   */
  extractPaymentInfo(lines) {
    return {
      method: this.extractField(lines, ['phương thức', 'payment method', 'pt thanh toán']),
      status: 'pending', // Would be extracted from invoice
      dueDate: this.extractField(lines, ['hạn thanh toán', 'due date', 'ngày thanh toán'])
    };
  }

  /**
   * Validate extracted data
   * @param {object} data - Parsed invoice data
   * @returns {object} - Validation result
   */
  validateExtractedData(data) {
    const errors = [];
    const warnings = [];

    // Validate tax codes
    if (this.config.validateTaxCode) {
      if (data.seller?.taxCode && !this.taxCodePattern.test(data.seller.taxCode)) {
        warnings.push('Seller tax code format may be invalid (expected 10 digits)');
      }
      if (data.buyer?.taxCode && !this.taxCodePattern.test(data.buyer.taxCode)) {
        warnings.push('Buyer tax code format may be invalid (expected 10 digits)');
      }
    }

    // Validate invoice format
    if (this.config.validateInvoiceFormat) {
      if (data.invoiceNumber && !this.isValidInvoiceFormat(data.invoiceNumber)) {
        warnings.push('Invoice number format may not match standard Vietnamese e-invoice format');
      }
    }

    // Validate required fields
    if (!data.seller?.name) errors.push('Seller name is required');
    if (!data.seller?.taxCode) errors.push('Seller tax code is required');
    if (!data.invoiceNumber) errors.push('Invoice number is required');

    // Validate totals
    if (data.totals?.grossTotal && data.totals?.grossTotal <= 0) {
      errors.push('Invoice total must be greater than 0');
    }

    // Calculate confidence based on missing fields
    const requiredFields = ['invoiceNumber', 'invoiceDate', 'seller.name', 'seller.taxCode', 'totals.grossTotal'];
    const missingFields = requiredFields.filter(f => {
      const value = f.split('.').reduce((obj, key) => obj?.[key], data);
      return !value;
    });
    const confidence = 1 - (missingFields.length * 0.1);

    return {
      valid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      confidence: Math.max(0, Math.min(1, confidence)),
      missingFields: missingFields
    };
  }

  /**
   * Check if invoice number matches known patterns
   * @param {string} invoiceNumber - Invoice number
   * @returns {boolean} - True if valid format
   */
  isValidInvoiceFormat(invoiceNumber) {
    return Object.values(this.invoicePatterns).some(pattern => pattern.test(invoiceNumber));
  }

  /**
   * Enrich data with additional calculations and normalized values
   * @param {object} data - Parsed invoice data
   * @returns {Promise<object>} - Enriched data
   */
  async enrichData(data) {
    // Recalculate totals for verification
    if (data.items && data.items.length > 0) {
      const calculatedNet = data.items.reduce((sum, item) => sum + (item.amount || 0), 0);
      const calculatedVat = data.totals?.vatRate ?
        Math.round(calculatedNet * data.totals.vatRate / 100) : 0;
      const calculatedGross = calculatedNet + calculatedVat;

      data.verification = {
        netTotal: calculatedNet,
        vatTotal: calculatedVat,
        grossTotal: calculatedGross,
        totalsMatch: Math.abs(calculatedGross - (data.totals?.grossTotal || 0)) < 100,
        recalculated: {
          netTotal: calculatedNet,
          vatTotal: calculatedVat,
          grossTotal: calculatedGross
        }
      };
    }

    // Normalize field names
    data.normalizedFields = {
      invoiceNumber: data.invoiceNumber,
      invoiceDate: this.normalizeDate(data.invoiceDate),
      sellerName: data.seller?.name,
      sellerTaxCode: data.seller?.taxCode,
      buyerName: data.buyer?.name,
      buyerTaxCode: data.buyer?.taxCode,
      grandTotal: data.totals?.grossTotal,
      vatAmount: data.totals?.vatTotal,
      vatRate: data.totals?.vatRate,
      itemCount: data.items?.length || 0
    };

    return data;
  }

  /**
   * Normalize date string to ISO format
   * @param {string} dateStr - Date string
   * @returns {string|null} - ISO date or null
   */
  normalizeDate(dateStr) {
    if (!dateStr) return null;

    // Handle common Vietnamese date formats: DD/MM/YYYY, DD-MM-YYYY
    const parts = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (parts) {
      const day = parts[1].padStart(2, '0');
      const month = parts[2].padStart(2, '0');
      let year = parts[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${month}-${day}`;
    }

    return dateStr;
  }

  /**
   * Detect file format from data
   * @param {Buffer|string} data - File data
   * @returns {string} - Format (jpg, png, pdf, etc.)
   */
  detectFormat(data) {
    if (Buffer.isBuffer(data)) {
      // Check magic bytes
      if (data[0] === 0xFF && data[1] === 0xD8) return 'jpeg';
      if (data[0] === 0x89 && data[1] === 0x50) return 'png';
      if (data[0] === 0x25 && data[1] === 0x50) return 'pdf';
    }
    if (typeof data === 'string') {
      if (data.startsWith('data:image')) return data.split(';')[0].split('/')[1];
      if (data.match(/^https?:\/\/.+\.(jpg|jpeg|png|pdf)/i)) return 'url';
    }
    return 'unknown';
  }

  /**
   * Parse number from string (handles Vietnamese format with dots)
   * @param {string} numStr - Number string
   * @returns {number} - Parsed number
   */
  parseNumber(numStr) {
    if (typeof numStr === 'number') return numStr;
    if (!numStr) return 0;
    return parseInt(numStr.replace(/\./g, '').replace(/,/g, '.')) || 0;
  }

  /**
   * Extract number from a line of text
   * @param {string} line - Text line containing a number
   * @returns {number} - Extracted number
   */
  extractNumber(line) {
    const match = line.match(/([\d\.]+)/);
    return match ? this.parseNumber(match[1]) : 0;
  }

  /**
   * Generate mock OCR result for POC purposes
   * @returns {string} - Mock OCR text
   */
  generateMockOCRResult() {
    return `
HÓA ĐƠN GIÁ TRỊ GIA TĂNG
VAT INVOICE

Số: AE/26/2604/000001
Ngày: 02/04/2026

NGƯỜI BÁN / SELLER:
Công Ty TNHH AI Employee Việt Nam
Mã số thuế: 0123456789
Địa chỉ: 123 Nguyễn Trãi, Quận 1, TP.HCM
Điện thoại: 02812345678

NGƯỜI MUA / BUYER:
Công Ty ABC Việt Nam
Mã số thuế: 9876543210
Địa chỉ: 456 Lê Lợi, Quận 1, TP.HCM

STT  Tên hàng hóa, dịch vụ      Số lượng  Đơn giá     Thành tiền
1    Dịch vụ AI Employee         1          499.000      499.000
     Gói Growth hàng tháng

Cộng tiền hàng:                     499.000
Thuế GTGT 10%:                       49.900
Tổng cộng:                          548.900

Số tiền bằng chữ: Năm trăm bốn mươi tám chín trăm đồng

Phương thức thanh toán: Chuyển khoản
Ngày thanh toán: 02/04/2026
`;
  }
}

module.exports = InvoiceOCRService;