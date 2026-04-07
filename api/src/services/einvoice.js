/**
 * Vietnamese E-Invoice Service
 * Part of TKP ACI Integration POC
 *
 * Demonstrates integration with Vietnamese tax/e-invoice systems
 */

class VietnameseEInvoiceService {
  constructor(config = {}) {
    this.config = {
      portalUrl: config.EINVOICE_PORTAL_URL || 'https://sandbox.einvoice.vn/api/v1',
      apiKey: config.EINVOICE_API_KEY || 'demo-key',
      clientId: config.EINVOICE_CLIENT_ID || 'demo-client',
      invoiceSeries: config.INVOICE_SERIES || 'AE/26',
      ...config
    };

    this.sequence = this.loadSequence();
  }

  loadSequence() {
    // In production, load from database
    return 1;
  }

  saveSequence(seq) {
    // In production, save to database
    this.sequence = seq;
  }

  /**
   * Generate unique invoice number in Vietnamese format
   * Format: [Series]/[Sequence 6 digits]
   * Example: AE/26/000001
   */
  generateInvoiceNumber() {
    const seq = String(this.sequence).padStart(6, '0');

    this.saveSequence(this.sequence + 1);
    return `${this.config.invoiceSeries}/${seq}`;
  }

  /**
   * Create e-invoice data structure per Vietnamese tax requirements
   * Based on Circular 68/2019/TT-BTC
   */
  createInvoiceData(orderData) {
    const invoiceNumber = this.generateInvoiceNumber();
    const now = new Date();

    const items = orderData.items.map((item, idx) => {
      const netAmount = item.unitPrice * item.quantity;
      const vatRate = item.vatRate !== undefined ? item.vatRate : 10;
      const vatAmount = Math.round(netAmount * vatRate / 100);
      const totalAmount = netAmount + vatAmount;

      return {
        lineNumber: idx + 1,
        itemCode: item.code || `ITEM${idx + 1}`,
        description: item.description,
        unitCode: item.unitCode || 'CU',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        netAmount: netAmount,
        vatRate: vatRate,
        vatAmount: vatAmount,
        totalAmount: totalAmount
      };
    });

    const netTotal = items.reduce((sum, item) => sum + item.netAmount, 0);
    const vatTotal = items.reduce((sum, item) => sum + item.vatAmount, 0);
    const grandTotal = netTotal + vatTotal;

    return {
      invoice: {
        invoiceType: 'GTGT', // VAT invoice
        invoiceSeries: this.config.invoiceSeries,
        invoiceNumber: invoiceNumber,
        invoiceIssueDate: now.toISOString().split('T')[0],
        invoiceIssueTime: now.toTimeString().split(' ')[0],

        seller: {
          taxCode: orderData.seller.taxCode,
          name: orderData.seller.name,
          address: orderData.seller.address,
          phone: orderData.seller.phone || '',
          email: orderData.seller.email || '',
          bankAccount: orderData.seller.bankAccount || '',
          bankName: orderData.seller.bankName || '',
          contactPerson: orderData.seller.contactPerson || ''
        },

        buyer: {
          taxCode: orderData.buyer.taxCode,
          name: orderData.buyer.name,
          address: orderData.buyer.address,
          phone: orderData.buyer.phone || '',
          email: orderData.buyer.email || '',
          bankAccount: orderData.buyer.bankAccount || '',
          bankName: orderData.buyer.bankName || '',
          contactPerson: orderData.buyer.contactPerson || '',
          paymentMethod: orderData.buyer.paymentMethod || 'TM'
        },

        items: items,

        totals: {
          netTotal: netTotal,
          vatTotal: vatTotal,
          grandTotal: grandTotal,
          currency: 'VND',
          amountInWords: this.numberToVietnamese(grandTotal)
        },

        payment: {
          paymentMethod: orderData.paymentMethod || 'TM',
          paymentStatus: 'CHUA_THANH_TOAN',
          dueDate: orderData.dueDate || null
        },

        taxBreakdown: {
          vatRate0: items.filter(i => i.vatRate === 0).reduce((s, i) => s + i.netAmount, 0),
          vatRate5: items.filter(i => i.vatRate === 5).reduce((s, i) => s + i.netAmount, 0),
          vatRate8: items.filter(i => i.vatRate === 8).reduce((s, i) => s + i.netAmount, 0),
          vatRate10: items.filter(i => i.vatRate === 10).reduce((s, i) => s + i.netAmount, 0)
        }
      }
    };
  }

  /**
   * Submit e-invoice to portal (mock implementation)
   */
  async submitToPortal(invoiceData) {
    // In production, this would call the actual e-invoice portal API
    console.log('Submitting e-invoice to portal:', this.config.portalUrl);

    // Simulate API call
    const mockResponse = {
      status: 'SUCCESS',
      invoiceCode: `INV${Date.now()}`,
      portalInvoiceId: `PORTAL${Date.now()}`,
      submissionTime: new Date().toISOString(),
      message: 'E-invoice submitted successfully'
    };

    return mockResponse;
  }

  /**
   * Convert number to Vietnamese words (for amount in words)
   */
  numberToVietnamese(num) {
    const units = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const places = ['', 'nghìn', 'triệu', 'tỷ'];

    if (num === 0) return 'không đồng';

    const numStr = String(Math.round(num));

    // Split into groups of 3 digits from right to left
    const groups = [];
    let remaining = numStr;
    while (remaining.length > 0) {
      groups.unshift(remaining.slice(-3));
      remaining = remaining.slice(0, -3);
    }

    const words = [];
    for (let i = 0; i < groups.length; i++) {
      const groupVal = parseInt(groups[i]);
      if (groupVal === 0) continue;

      const placeIdx = groups.length - 1 - i;
      const phrase = this.numberGroupToWords(groupVal, units);

      if (phrase) {
        words.push(phrase + (placeIdx > 0 ? ' ' + places[placeIdx] : ''));
      }
    }

    return words.join(' ') + ' đồng';
  }

  /**
   * Convert a 3-digit group to Vietnamese words
   * @param {number} num - Number from 1-999
   * @param {Array} units - Unit words array
   * @returns {string} - Words for the group
   */
  numberGroupToWords(num, units) {
    if (num === 0) return '';

    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;

    let phrase = '';

    if (hundreds > 0) {
      phrase += units[hundreds] + ' trăm';
    }

    if (remainder > 0) {
      if (hundreds > 0) {
        if (remainder < 10) {
          phrase += ' lẻ ' + units[ones];
        } else {
          phrase += ' ';
        }
      }

      if (tens === 0) {
        phrase += units[ones];
      } else if (tens === 1) {
        phrase += 'mười ' + (ones > 0 ? units[ones] : '');
      } else {
        phrase += units[tens] + ' mươi';
        if (ones > 0) {
          if (ones === 5) {
            phrase += ' lăm';
          } else if (ones === 1) {
            phrase += ' mốt';
          } else {
            phrase += ' ' + units[ones];
          }
        }
      }
    }

    return phrase.trim();
  }

  /**
   * Lookup company info by tax code (MST)
   * In production, this would call a tax authority API or third-party service
   */
  async lookupByTaxCode(taxCode) {
    // Mock database of Vietnamese companies
    const mockDatabase = {
      '0123456789': {
        taxCode: '0123456789',
        name: 'Công Ty TNHH AI Employee Việt Nam',
        address: '123 Nguyễn Trãi, Quận 1, Thành phố Hồ Chí Minh',
        phone: '02812345678',
        email: 'contact@aiemployee.vn'
      }
    };

    return mockDatabase[taxCode] || null;
  }

  /**
   * Validate invoice data before submission
   */
  validateInvoice(invoiceData) {
    const errors = [];

    if (!invoiceData.invoice.seller.taxCode) {
      errors.push('Seller tax code (MST) is required');
    }
    if (!invoiceData.invoice.buyer.taxCode) {
      errors.push('Buyer tax code (MST) is required');
    }
    if (!invoiceData.invoice.items || invoiceData.invoice.items.length === 0) {
      errors.push('At least one item is required');
    }
    if (invoiceData.invoice.totals.grandTotal <= 0) {
      errors.push('Invoice total must be greater than 0');
    }

    // Validate VAT rates
    const validVatRates = [0, 5, 8, 10];
    invoiceData.invoice.items.forEach((item, idx) => {
      if (!validVatRates.includes(item.vatRate)) {
        errors.push(`Item ${idx + 1}: Invalid VAT rate ${item.vatRate}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}

module.exports = VietnameseEInvoiceService;

// Example usage:
if (require.main === module) {
  const service = new VietnameseEInvoiceService();

  const orderData = {
    seller: {
      taxCode: '0123456789',
      name: 'Công Ty TNHH AI Employee Việt Nam',
      address: '123 Nguyễn Trãi, Quận 1, TP.HCM',
      bankAccount: '1234567890',
      bankName: 'Vietcombank'
    },
    buyer: {
      taxCode: '9876543210',
      name: 'Công Ty ABC Việt Nam',
      address: '456 Lê Lợi, Quận 1, TP.HCM'
    },
    items: [
      {
        description: 'Dịch vụ AI Employee - Gói Growth hàng tháng',
        quantity: 1,
        unitPrice: 499000,
        vatRate: 10
      }
    ],
    paymentMethod: 'CK'
  };

  const invoiceData = service.createInvoiceData(orderData);
  console.log('Generated Invoice:');
  console.log(JSON.stringify(invoiceData, null, 2));

  const validation = service.validateInvoice(invoiceData);
  console.log('\nValidation:', validation);
}
