/**
 * Vietnamese Tax Compliance Checker Service
 * Part of VAT Systems MVP (COM-81)
 *
 * Validates invoices and transactions against Vietnamese tax regulations
 * Based on Circular 68/2019/TT-BTC and related tax laws
 */

class TaxComplianceService {
  constructor(config = {}) {
    this.config = {
      // Validation strictness
      strictMode: config.strictMode || false, // If true, warnings become errors
      allowZeroRatedExempt: config.allowZeroRatedExempt !== false,

      // Regulatory references
      circular68: '68/2019/TT-BTC',
      circular119: '119/2014/TT-BTC',

      // VAT rates allowed
      allowedVatRates: [0, 5, 8, 10],
      ...config
    };

    // Tax code validation rules
    this.taxCodeRules = {
      length: 10,
      mustBeNumeric: true,
      checkDigit: false // Vietnam doesn't use a check digit system
    };

    // Invoice timing rules
    this.timingRules = {
      maxDaysFuture: 5,      // Can issue invoice up to 5 days in future
      maxDaysPast: 30,       // Should issue within 30 days of supply
      deadlineDays: 10      // Must submit to tax authority within 10 days
    };
  }

  /**
   * Check compliance for a complete invoice
   * @param {object} invoice - Invoice data to check
   * @returns {object} - Compliance check result
   */
  checkInvoiceCompliance(invoice) {
    const results = {
      compliant: true,
      errors: [],
      warnings: [],
      info: [],
      score: 100,
      breakdown: {}
    };

    // Run all checks
    results.breakdown = {
      structure: this.checkStructure(invoice),
      seller: this.checkSeller(invoice.seller),
      buyer: this.checkBuyer(invoice.buyer),
      items: this.checkItems(invoice.items),
      totals: this.checkTotals(invoice),
      timing: this.checkTiming(invoice),
      format: this.checkFormat(invoice)
    };

    // Aggregate results
    let errorCount = 0;
    let warningCount = 0;

    Object.values(results.breakdown).forEach(check => {
      if (check.errors) {
        results.errors.push(...check.errors.map(e => ({ ...e, category: check.category })));
        errorCount += check.errors.length;
      }
      if (check.warnings) {
        results.warnings.push(...check.warnings.map(w => ({ ...w, category: check.category })));
        warningCount += check.warnings.length;
      }
      if (check.info) {
        results.info.push(...check.info.map(i => ({ ...i, category: check.category })));
      }
    });

    // Calculate compliance score
    results.score = Math.max(0, 100 - (errorCount * 20) - (warningCount * 5));

    // Determine overall compliance
    results.compliant = errorCount === 0 && (this.config.strictMode ? warningCount === 0 : true);

    // Add summary
    results.summary = {
      totalErrors: errorCount,
      totalWarnings: warningCount,
      maxScore: 100,
      passedChecks: Object.values(results.breakdown).filter(c => !c.errors?.length).length,
      totalChecks: Object.keys(results.breakdown).length
    };

    return results;
  }

  /**
   * Check structural requirements
   * @param {object} invoice - Invoice data
   * @returns {object} - Check result with errors/warnings
   */
  checkStructure(invoice) {
    const errors = [];
    const warnings = [];
    const info = [];

    if (!invoice) {
      errors.push('Invoice data is required');
      return { errors, warnings, info, category: 'structure' };
    }

    const requiredFields = [
      'invoiceNumber',
      'invoiceType',
      'invoiceIssueDate',
      'seller',
      'buyer',
      'items'
    ];

    requiredFields.forEach(field => {
      if (!invoice[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Check invoice type
    const validTypes = ['GTGT', 'TICO', 'BINHTHUONG']; // VAT, Export, Regular
    if (invoice.invoiceType && !validTypes.includes(invoice.invoiceType)) {
      errors.push(`Invalid invoice type: ${invoice.invoiceType}`);
    }

    return { errors, warnings, info, category: 'structure' };
  }

  /**
   * Check seller information compliance
   * @param {object} seller - Seller data
   * @returns {object} - Check result
   */
  checkSeller(seller) {
    const errors = [];
    const warnings = [];
    const info = [];

    if (!seller) {
      errors.push('Seller information is required');
      return { errors, warnings, info, category: 'seller' };
    }

    // Tax code validation
    if (!seller.taxCode) {
      errors.push('Seller tax code (MST) is required');
    } else {
      const taxCodeResult = this.validateTaxCode(seller.taxCode, 'Seller');
      if (!taxCodeResult.valid) {
        errors.push(...taxCodeResult.errors.map(e => `${taxCodeResult.type}: ${e}`));
      }
      warnings.push(...taxCodeResult.warnings.map(w => `${taxCodeResult.type}: ${w}`));
    }

    // Name validation
    if (!seller.name || seller.name.length < 2) {
      errors.push('Seller name is required and must be at least 2 characters');
    }

    // Address validation
    if (!seller.address) {
      warnings.push('Seller address is recommended for compliance');
    }

    // Bank account validation
    if (seller.bankAccount && !this.validateBankAccount(seller.bankAccount)) {
      warnings.push('Seller bank account format may be invalid');
    }

    return { errors, warnings, info, category: 'seller' };
  }

  /**
   * Check buyer information compliance
   * @param {object} buyer - Buyer data
   * @returns {object} - Check result
   */
  checkBuyer(buyer) {
    const errors = [];
    const warnings = [];
    const info = [];

    if (!buyer) {
      errors.push('Buyer information is required');
      return { errors, warnings, info, category: 'buyer' };
    }

    // For VAT invoices over certain threshold, buyer tax code is required
    if (buyer.taxCode) {
      const taxCodeResult = this.validateTaxCode(buyer.taxCode, 'Buyer');
      if (!taxCodeResult.valid) {
        errors.push(...taxCodeResult.errors.map(e => `${taxCodeResult.type}: ${e}`));
      }
      warnings.push(...taxCodeResult.warnings.map(w => `${taxCodeResult.type}: ${w}`));
    }

    // Name validation
    if (!buyer.name || buyer.name.length < 2) {
      errors.push('Buyer name is required and must be at least 2 characters');
    }

    return { errors, warnings, info, category: 'buyer' };
  }

  /**
   * Check invoice items compliance
   * @param {Array} items - Line items
   * @returns {object} - Check result
   */
  checkItems(items) {
    const errors = [];
    const warnings = [];
    const info = [];

    if (!items || items.length === 0) {
      errors.push('At least one line item is required');
      return { errors, warnings, info, category: 'items' };
    }

    items.forEach((item, idx) => {
      const lineNum = idx + 1;

      // Description check
      if (!item.description || item.description.length < 3) {
        errors.push(`Line ${lineNum}: Item description is required`);
      }

      // Quantity check
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        errors.push(`Line ${lineNum}: Valid quantity is required`);
      }

      // Unit price check
      if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
        errors.push(`Line ${lineNum}: Valid unit price is required`);
      }

      // VAT rate validation
      if (item.vatRate !== undefined) {
        if (!this.config.allowedVatRates.includes(item.vatRate)) {
          errors.push(`Line ${lineNum}: Invalid VAT rate ${item.vatRate}. Allowed: ${this.config.allowedVatRates.join(', ')}`);
        }
      } else {
        warnings.push(`Line ${lineNum}: VAT rate not specified, default 10% will be applied`);
      }

      // Amount consistency check
      if (item.quantity && item.unitPrice && item.netAmount) {
        const expectedNet = item.quantity * item.unitPrice;
        if (Math.abs(expectedNet - item.netAmount) > 100) {
          warnings.push(`Line ${lineNum}: Net amount may be incorrect. Expected: ${expectedNet}, Found: ${item.netAmount}`);
        }
      }
    });

    return { errors, warnings, info, category: 'items' };
  }

  /**
   * Check invoice totals compliance
   * @param {object} invoice - Invoice data
   * @returns {object} - Check result
   */
  checkTotals(invoice) {
    const errors = [];
    const warnings = [];
    const info = [];

    if (!invoice.totals) {
      errors.push('Invoice totals are required');
      return { errors, warnings, info, category: 'totals' };
    }

    const { totals, items } = invoice;

    // Recalculate totals from items
    let calculatedNet = 0;
    let calculatedVat = 0;
    let calculatedGross = 0;

    if (items && items.length > 0) {
      items.forEach(item => {
        const net = item.netAmount || (item.quantity * item.unitPrice);
        const vat = item.vatAmount || (net * (item.vatRate || 10) / 100);
        const gross = item.totalAmount || (net + vat);

        calculatedNet += net;
        calculatedVat += vat;
        calculatedGross += gross;
      });

      calculatedNet = Math.round(calculatedNet);
      calculatedVat = Math.round(calculatedVat);
      calculatedGross = Math.round(calculatedGross);
    }

    // Compare calculated vs declared totals
    const tolerance = 100; // 100 VND tolerance for rounding

    if (totals.netTotal !== undefined && calculatedNet > 0) {
      if (Math.abs(totals.netTotal - calculatedNet) > tolerance) {
        warnings.push(`Net total mismatch. Declared: ${totals.netTotal}, Calculated: ${calculatedNet}`);
      }
    }

    if (totals.vatTotal !== undefined && calculatedVat > 0) {
      if (Math.abs(totals.vatTotal - calculatedVat) > tolerance) {
        errors.push(`VAT total mismatch. Declared: ${totals.vatTotal}, Calculated: ${calculatedVat}`);
      }
    }

    if (totals.grandTotal !== undefined && calculatedGross > 0) {
      if (Math.abs(totals.grandTotal - calculatedGross) > tolerance) {
        errors.push(`Grand total mismatch. Declared: ${totals.grandTotal}, Calculated: ${calculatedGross}`);
      }
    }

    // Grand total should equal net + VAT
    if (totals.netTotal !== undefined && totals.vatTotal !== undefined && totals.grandTotal !== undefined) {
      const expectedGross = totals.netTotal + totals.vatTotal;
      if (Math.abs(totals.grandTotal - expectedGross) > tolerance) {
        errors.push(`Grand total should equal net total + VAT total. Expected: ${expectedGross}`);
      }
    }

    // Amount in words check
    if (!totals.amountInWords) {
      warnings.push('Amount in words (số tiền bằng chữ) is recommended');
    }

    return { errors, warnings, info, category: 'totals' };
  }

  /**
   * Check timing compliance
   * @param {object} invoice - Invoice data
   * @returns {object} - Check result
   */
  checkTiming(invoice) {
    const errors = [];
    const warnings = [];
    const info = [];

    if (!invoice.invoiceIssueDate) {
      errors.push('Invoice issue date is required');
      return { errors, warnings, info, category: 'timing' };
    }

    const issueDate = new Date(invoice.invoiceIssueDate);
    const today = new Date();
    const diffDays = Math.floor((issueDate - today) / (1000 * 60 * 60 * 24));

    // Future date check
    if (diffDays > this.timingRules.maxDaysFuture) {
      errors.push(`Invoice date is more than ${this.timingRules.maxDaysFuture} days in the future`);
    } else if (diffDays > 0) {
      warnings.push(`Invoice date is ${diffDays} days in the future`);
    }

    // Past date check
    if (diffDays < -this.timingRules.maxDaysPast) {
      warnings.push(`Invoice date is more than ${this.timingRules.maxDaysPast} days in the past. Late invoices may incur penalties.`);
    }

    // Deadline check
    if (invoice.invoiceIssueDate && invoice.submissionDate) {
      const submissionDate = new Date(invoice.submissionDate);
      const deadlineDays = Math.floor((submissionDate - issueDate) / (1000 * 60 * 60 * 24));
      if (deadlineDays > this.timingRules.deadlineDays) {
        errors.push(`Invoice submission deadline exceeded. Submitted ${deadlineDays} days after issue (max: ${this.timingRules.deadlineDays})`);
      } else if (deadlineDays <= 3) {
        warnings.push(`Invoice submitted with only ${deadlineDays} days remaining before deadline`);
      }
    }

    return { errors, warnings, info, category: 'timing' };
  }

  /**
   * Check format compliance
   * @param {object} invoice - Invoice data
   * @returns {object} - Check result
   */
  checkFormat(invoice) {
    const errors = [];
    const warnings = [];
    const info = [];

    // Invoice number format check
    if (invoice.invoiceNumber) {
      const invoicePattern = /^(AE|TK|HD|HDT)\/\d{2}\/\d{2,4}\/\d{6}$/i;
      if (!invoicePattern.test(invoice.invoiceNumber)) {
        warnings.push(`Invoice number format may not match standard format. Expected: XX/YYMM/XXXXXX`);
      } else {
        info.push('Invoice number format is valid');
      }
    }

    // Currency check
    if (invoice.totals?.currency && invoice.totals.currency !== 'VND') {
      warnings.push(`Currency is ${invoice.totals.currency}. Only VND is standard for domestic invoices`);
    }

    return { errors, warnings, info, category: 'format' };
  }

  /**
   * Validate Vietnamese tax code (MST)
   * @param {string} taxCode - Tax code to validate
   * @param {string} entityType - 'Seller' or 'Buyer' for error messages
   * @returns {object} - Validation result
   */
  validateTaxCode(taxCode, entityType = 'Entity') {
    const errors = [];
    const warnings = [];

    if (!taxCode) {
      errors.push('Tax code is required');
      return { valid: false, errors, warnings, type: entityType };
    }

    // Check if numeric
    if (!/^\d+$/.test(taxCode)) {
      errors.push('Tax code must contain only digits');
    }

    // Check length
    if (taxCode.length !== this.taxCodeRules.length) {
      errors.push(`Tax code must be ${this.taxCodeRules.length} digits`);
    }

    // First 2 digits should be valid province/city code (01-96)
    const provinceCode = parseInt(taxCode.substring(0, 2));
    if (provinceCode < 1 || provinceCode > 96) {
      warnings.push('Tax code province code appears invalid (expected 01-96)');
    }

    // Check for common invalid patterns
    if (/^0+$/.test(taxCode)) {
      errors.push('Tax code cannot be all zeros');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      type: entityType
    };
  }

  /**
   * Validate bank account format
   * @param {string} accountNumber - Bank account number
   * @returns {boolean} - True if format appears valid
   */
  validateBankAccount(accountNumber) {
    if (!accountNumber) return false;
    // Vietnamese bank accounts are typically 6-20 digits
    return /^\d{6,20}$/.test(accountNumber.replace(/\s/g, ''));
  }

  /**
   * Generate compliance report
   * @param {object} complianceResult - Result from checkInvoiceCompliance
   * @returns {object} - Formatted report
   */
  generateReport(complianceResult) {
    const report = {
      title: 'Vietnamese Tax Compliance Report',
      generatedAt: new Date().toISOString(),
      regulatoryReference: `Circular ${this.config.circular68}`,
      status: complianceResult.compliant ? 'COMPLIANT' : 'NON-COMPLIANT',
      score: complianceResult.score,
      summary: complianceResult.summary
    };

    if (complianceResult.errors.length > 0) {
      report.errors = complianceResult.errors;
    }

    if (complianceResult.warnings.length > 0) {
      report.warnings = complianceResult.warnings;
    }

    if (complianceResult.info.length > 0) {
      report.info = complianceResult.info;
    }

    report.recommendations = this.generateRecommendations(complianceResult);

    return report;
  }

  /**
   * Generate recommendations based on compliance issues
   * @param {object} complianceResult - Compliance check result
   * @returns {Array} - List of recommendations
   */
  generateRecommendations(complianceResult) {
    const recommendations = [];

    if (complianceResult.errors.some(e => e.category === 'totals')) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Recalculate invoice totals and resubmit',
        reference: 'Circular 68/2019/TT-BTC Article 14'
      });
    }

    if (complianceResult.warnings.some(w => w.category === 'timing')) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Review invoice timing and submission process',
        reference: 'Circular 68/2019/TT-BTC Article 8'
      });
    }

    if (complianceResult.warnings.some(w => w.category === 'seller')) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Update seller information to ensure full compliance',
        reference: 'Circular 68/2019/TT-BTC Article 10'
      });
    }

    if (complianceResult.warnings.some(w => w.category === 'format')) {
      recommendations.push({
        priority: 'LOW',
        action: 'Review invoice number format matches portal requirements',
        reference: 'Tax authority portal guidelines'
      });
    }

    return recommendations;
  }
}

module.exports = TaxComplianceService;