import type { APIRoute } from 'astro';

// In-memory store (replace with D1)
const invoices: any[] = [];

// Vietnamese VAT rates
const VAT_RATES = [0, 5, 8, 10];

function validateTaxCode(taxCode: string): boolean {
  const cleaned = taxCode.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 13;
}

function createInvoiceNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${timestamp}-${random}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { seller, buyer, items, paymentMethod, dueDate } = body;

    // Validate required fields
    if (!seller || !seller.taxCode) {
      return new Response(JSON.stringify({ error: 'Seller tax code (MST) is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!buyer || !buyer.taxCode) {
      return new Response(JSON.stringify({ error: 'Buyer tax code (MST) is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one item is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate tax codes
    if (!validateTaxCode(seller.taxCode)) {
      return new Response(JSON.stringify({ error: 'Invalid seller tax code format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!validateTaxCode(buyer.taxCode)) {
      return new Response(JSON.stringify({ error: 'Invalid buyer tax code format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate totals
    let totalNet = 0;
    let totalVat = 0;
    let totalGross = 0;

    const processedItems = items.map((item: any, idx: number) => {
      const netAmount = item.netAmount || 0;
      const vatRate = item.vatRate || 10;
      const vatAmount = Math.round(netAmount * vatRate / 100);
      const grossAmount = netAmount + vatAmount;

      totalNet += netAmount;
      totalVat += vatAmount;
      totalGross += grossAmount;

      return {
        lineNumber: idx + 1,
        description: item.description || `Item ${idx + 1}`,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || netAmount,
        netAmount,
        vatRate,
        vatAmount,
        grossAmount
      };
    });

    const invoice = {
      id: crypto.randomUUID(),
      invoiceNumber: createInvoiceNumber(),
      seller: {
        name: seller.name || '',
        taxCode: seller.taxCode,
        address: seller.address || ''
      },
      buyer: {
        name: buyer.name || '',
        taxCode: buyer.taxCode,
        address: buyer.address || ''
      },
      items: processedItems,
      totals: {
        netAmount: totalNet,
        vatAmount: totalVat,
        grossAmount: totalGross
      },
      paymentMethod: paymentMethod || 'cash',
      dueDate: dueDate || null,
      status: 'draft',
      createdAt: new Date().toISOString()
    };

    invoices.push(invoice);

    return new Response(JSON.stringify({
      success: true,
      data: invoice,
      message: 'Invoice created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return new Response(JSON.stringify({ error: 'Failed to create invoice' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const { searchParams } = new URL(url);
    const status = searchParams.get('status');
    const sellerTaxCode = searchParams.get('sellerTaxCode');
    const buyerTaxCode = searchParams.get('buyerTaxCode');

    let filtered = [...invoices];
    if (status) {
      filtered = filtered.filter(inv => inv.status === status);
    }
    if (sellerTaxCode) {
      filtered = filtered.filter(inv => inv.seller.taxCode === sellerTaxCode);
    }
    if (buyerTaxCode) {
      filtered = filtered.filter(inv => inv.buyer.taxCode === buyerTaxCode);
    }

    return new Response(JSON.stringify({
      success: true,
      data: filtered,
      count: filtered.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch invoices' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
