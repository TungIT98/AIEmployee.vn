import type { APIRoute } from 'astro';

// VAT rates in Vietnam
const VAT_RATES = {
  ZERO: 0,
  REDUCED_1: 5,
  REDUCED_2: 8,
  STANDARD: 10
};

class VATCalculatorService {
  calculate(netAmount: number, vatRate: number) {
    const validRates = Object.values(VAT_RATES);
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

  calculateFromGross(grossAmount: number, vatRate: number) {
    const validRates = Object.values(VAT_RATES);
    if (!validRates.includes(vatRate)) {
      throw new Error(`Invalid VAT rate: ${vatRate}`);
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

  formatCurrency(amount: number) {
    return new Intl.NumberFormat('vi-VN').format(this.round(amount));
  }

  amountToWords(amount: number) {
    const units = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const places = ['', 'nghìn', 'triệu', 'tỷ'];

    if (amount === 0) return 'không đồng';

    const num = Math.round(amount);
    const numStr = String(num);

    const groups: string[] = [];
    let remaining = numStr;
    while (remaining.length > 0) {
      groups.unshift(remaining.slice(-3));
      remaining = remaining.slice(0, -3);
    }

    const words: string[] = [];
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

  numberGroupToWords(num: number, units: string[]) {
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

  round(value: number) {
    return Math.round(value);
  }

  getSupportedRates() {
    return Object.entries(VAT_RATES).map(([name, value]) => ({
      name: name.replace('_', ' ').toLowerCase(),
      rate: value,
      description: this.getRateDescription(value)
    }));
  }

  getRateDescription(rate: number) {
    const descriptions: Record<number, string> = {
      0: '0% - Exempt (food, healthcare, education, books)',
      5: '5% - Reduced (essential goods and services)',
      8: '8% - Reduced (construction, transportation - pre-2024)',
      10: '10% - Standard rate (default)'
    };
    return descriptions[rate] || 'Unknown rate';
  }
}

const vatCalculator = new VATCalculatorService();

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { netAmount, vatRate } = body;

    if (netAmount === undefined || netAmount === null) {
      return new Response(JSON.stringify({ error: 'netAmount is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = vatCalculator.calculate(netAmount, vatRate || 10);
    result.amountInWords = vatCalculator.amountToWords(result.grossAmount);
    result.formattedNet = vatCalculator.formatCurrency(result.netAmount);
    result.formattedVat = vatCalculator.formatCurrency(result.vatAmount);
    result.formattedGross = vatCalculator.formatCurrency(result.grossAmount);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error calculating VAT:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
