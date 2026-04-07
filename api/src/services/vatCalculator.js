/**
 * Vietnamese VAT Calculator Service
 * Part of VAT Systems MVP
 *
 * Calculates Value Added Tax per Vietnamese tax regulations
 * Based on Circular 68/2019/TT-BTC and related tax laws
 */

class VATCalculatorService {
  // Standard VAT rates in Vietnam
  static VAT_RATES = {
    ZERO: 0,      // 0% - Exempt goods/services
    REDUCED_1: 5, // 5% - Essential goods/services
    REDUCED_2: 8, // 8% - Construction, transportation services (pre-2024)
    STANDARD: 10  // 10% - Standard rate (default)
  };

  // VAT rate categories
  static VAT_CATEGORIES = {
    'food': 5,
    'healthcare': 0,
    'education': 0,
    'books': 0,
    'transportation': 8,
    'construction': 8,
    'technology': 10,
    'services': 10,
    'manufacturing': 10,
    'other': 10
  };

  constructor(config = {}) {
    this.config = {
      defaultVatRate: config.defaultVatRate || VATCalculatorService.VAT_RATES.STANDARD,
      roundingPrecision: config.roundingPrecision || 0, // 0 decimal places for VND
      ...config
    };
  }

  /**
   * Calculate VAT amount from net amount
   * @param {number} netAmount - Amount before VAT
   * @param {number} vatRate - VAT rate (0, 5, 8, or 10)
   * @returns {object} - { netAmount, vatRate, vatAmount, grossAmount }
   */
  calculate(netAmount, vatRate = this.config.defaultVatRate) {
    const validRates = Object.values(VATCalculatorService.VAT_RATES);
    if (!validRates.includes(vatRate)) {
      throw new Error(`Invalid VAT rate: ${vatRate}. Must be one of: ${validRates.join(', ')}`);
    }

    if (typeof netAmount !== 'number' || netAmount < 0) {
      throw new Error('Net amount must be a non-negative number');
    }

    const vatAmount = this.round(netAmount * vatRate / 100);
    const grossAmount = netAmount + vatAmount;

    return {
      netAmount: netAmount,
      vatRate: vatRate,
      vatAmount: vatAmount,
      grossAmount: grossAmount
    };
  }

  /**
   * Calculate VAT from gross amount (reverse calculation)
   * @param {number} grossAmount - Total amount including VAT
   * @param {number} vatRate - VAT rate
   * @returns {object} - { netAmount, vatRate, vatAmount, grossAmount }
   */
  calculateFromGross(grossAmount, vatRate = this.config.defaultVatRate) {
    const validRates = Object.values(VATCalculatorService.VAT_RATES);
    if (!validRates.includes(vatRate)) {
      throw new Error(`Invalid VAT rate: ${vatRate}. Must be one of: ${validRates.join(', ')}`);
    }

    if (typeof grossAmount !== 'number' || grossAmount < 0) {
      throw new Error('Gross amount must be a non-negative number');
    }

    const netAmount = this.round(grossAmount / (1 + vatRate / 100));
    const vatAmount = this.round(grossAmount - netAmount);

    return {
      netAmount: netAmount,
      vatRate: vatRate,
      vatAmount: vatAmount,
      grossAmount: this.round(grossAmount)
    };
  }

  /**
   * Calculate VAT for multiple items with different rates
   * @param {Array} items - Array of { netAmount, vatRate, description }
   * @returns {object} - Itemized VAT breakdown and totals
   */
  calculateMultiple(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required');
    }

    const processedItems = items.map((item, idx) => {
      const result = this.calculate(item.netAmount, item.vatRate);
      return {
        lineNumber: idx + 1,
        description: item.description || `Item ${idx + 1}`,
        ...result
      };
    });

    const totals = {
      totalNetAmount: this.round(processedItems.reduce((sum, i) => sum + i.netAmount, 0)),
      totalVatAmount: this.round(processedItems.reduce((sum, i) => sum + i.vatAmount, 0)),
      totalGrossAmount: this.round(processedItems.reduce((sum, i) => sum + i.grossAmount, 0))
    };

    // VAT breakdown by rate
    const vatBreakdown = {};
    processedItems.forEach(item => {
      const rateKey = `vatRate${item.vatRate}`;
      if (!vatBreakdown[rateKey]) {
        vatBreakdown[rateKey] = {
          rate: item.vatRate,
          netAmount: 0,
          vatAmount: 0,
          grossAmount: 0
        };
      }
      vatBreakdown[rateKey].netAmount += item.netAmount;
      vatBreakdown[rateKey].vatAmount += item.vatAmount;
      vatBreakdown[rateKey].grossAmount += item.grossAmount;
    });

    // Round breakdown values
    Object.keys(vatBreakdown).forEach(key => {
      vatBreakdown[key].netAmount = this.round(vatBreakdown[key].netAmount);
      vatBreakdown[key].vatAmount = this.round(vatBreakdown[key].vatAmount);
      vatBreakdown[key].grossAmount = this.round(vatBreakdown[key].grossAmount);
    });

    return {
      items: processedItems,
      totals: totals,
      vatBreakdown: vatBreakdown,
      itemCount: processedItems.length
    };
  }

  /**
   * Get recommended VAT rate based on product/service category
   * @param {string} category - Product or service category
   * @returns {number} - Recommended VAT rate
   */
  getRateByCategory(category) {
    if (!category) return this.config.defaultVatRate;

    const normalizedCategory = category.toLowerCase().trim();
    const rate = VATCalculatorService.VAT_CATEGORIES[normalizedCategory];
    return rate !== undefined ? rate : this.config.defaultVatRate;
  }

  /**
   * Validate if a VAT rate is valid for a given category
   * @param {number} vatRate - VAT rate to validate
   * @param {string} category - Product/service category
   * @returns {object} - { valid: boolean, message: string }
   */
  validateRateForCategory(vatRate, category) {
    const validRates = Object.values(VATCalculatorService.VAT_RATES);
    if (!validRates.includes(vatRate)) {
      return {
        valid: false,
        message: `Invalid VAT rate: ${vatRate}`
      };
    }

    const recommendedRate = this.getRateByCategory(category);
    if (vatRate !== recommendedRate) {
      return {
        valid: true,
        warning: true,
        message: `Rate ${vatRate}% may not be standard for category '${category}'. Recommended: ${recommendedRate}%`,
        recommendedRate: recommendedRate
      };
    }

    return {
      valid: true,
      warning: false,
      message: 'VAT rate is valid for category'
    };
  }

  /**
   * Format amount in Vietnamese currency format
   * @param {number} amount - Amount to format
   * @returns {string} - Formatted amount (e.g., "1.000.000")
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(this.round(amount));
  }

  /**
   * Convert amount to Vietnamese words
   * @param {number} amount - Amount to convert
   * @returns {string} - Amount in words (Vietnamese)
   */
  amountToWords(amount) {
    const units = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const places = ['', 'nghìn', 'triệu', 'tỷ'];

    if (amount === 0) return 'không đồng';

    const num = Math.round(amount);
    const numStr = String(num);

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
   * Round to configured precision
   * @param {number} value - Value to round
   * @returns {number} - Rounded value
   */
  round(value) {
    const multiplier = Math.pow(10, this.config.roundingPrecision);
    return Math.round(value * multiplier) / multiplier;
  }

  /**
   * Get all supported VAT rates
   * @returns {Array} - List of supported VAT rates
   */
  getSupportedRates() {
    return Object.entries(VATCalculatorService.VAT_RATES).map(([name, value]) => ({
      name: name.replace('_', ' ').toLowerCase(),
      rate: value,
      description: this.getRateDescription(value)
    }));
  }

  /**
   * Get description for a VAT rate
   * @param {number} rate - VAT rate
   * @returns {string} - Description
   */
  getRateDescription(rate) {
    const descriptions = {
      0: '0% - Exempt (food, healthcare, education, books)',
      5: '5% - Reduced (essential goods and services)',
      8: '8% - Reduced (construction, transportation - pre-2024)',
      10: '10% - Standard rate (default)'
    };
    return descriptions[rate] || 'Unknown rate';
  }
}

module.exports = VATCalculatorService;