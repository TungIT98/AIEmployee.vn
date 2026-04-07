# TKP ACI Integration Proof-of-Concept

**Project:** AIEmployee.vn - TKP ACI Integration POC
**Author:** CTO Manager
**Date:** 2026-04-02
**Status:** In Progress

---

## Executive Summary

TKP ACI (Tax - Kế toán - Accounting / ACI Integration) POC demonstrates how AIEmployee.vn can integrate with Vietnamese tax and accounting systems. This POC focuses on **e-invoice integration** with the Vietnamese General Department of Taxation (Tổng cục Thuế).

---

## Background

### Why TKP ACI Integration?

Vietnamese businesses are required to:
1. **Issue electronic invoices (e-invoices)** since July 2022 - mandatory for all businesses
2. **Report VAT** monthly/quarterly to tax authorities
3. **Integrate with government systems** for customs, banking, and social insurance

AIEmployee.vn customers (Vietnamese SMBs) need their AI employees to:
- Generate invoices that automatically comply with Vietnamese tax regulations
- Submit e-invoices to tax authorities through authorized intermediaries
- Track tax compliance status
- Sync accounting data with tax filings

### Target Systems

| System | Description | Integration Type |
|--------|-------------|------------------|
| **Tổng cục Thuế** (GDT) | General Department of Taxation | E-invoice submission |
| **E-invoice Portals** | Authorized e-invoice service providers | API (REST) |
| **Vietnam E-invoice Format** | Structured invoice XML/JSON | Data format |

---

## Integration Architecture

### High-Level Flow

```
AIEmployee.vn Backend
       │
       ├──► E-Invoice Service
       │         │
       │         ├──► Invoice Generation (Vietnamese format)
       │         ├──► Digital Signature
       │         └──► E-Invoice Portal API
       │                   │
       │                   └──► [Tax Authority / Intermediary]
       │
       ├──► Accounting Sync
       │         │
       │         ├──► Chart of Accounts mapping
       │         ├──► Transaction recording
       │         └──► Financial reports
       │
       └──► Tax Compliance Monitor
                 │
                 ├──► VAT tracking
                 ├──► Filing deadlines
                 └──► Compliance alerts
```

### E-Invoice Integration Flow

```
1. Customer requests invoice for sale
         │
         ▼
2. AIEmployee generates invoice data
   - Customer info (MST, name, address)
   - Line items (products, services, quantities)
   - Prices (VND, VAT rate)
   - Payment terms
         │
         ▼
3. Format to Vietnamese e-invoice schema
   - UsingUBL 2.1 or national standard
   - Required fields: Hóa đơn GTGT pattern
         │
         ▼
4. Submit to e-invoice portal
   -via REST API (POST /invoices)
   - Authorization: Bearer token
         │
         ▼
5. Portal forwards to Tax Authority
         │
         ▼
6. Receive confirmation
   - Invoice code (Mã hóa đơn)
   - Invoice sequence (Ký hiệu)
   - Signed timestamp
```

---

## Vietnamese E-Invoice Format

### Required Fields (Hóa đơn GTGT)

```json
{
  "invoice": {
    "invoiceType": "GTGT",  // VAT invoice
    "invoiceSeries": "AB/20",  // Series pattern
    "invoiceNumber": "00001",  // Sequence
    "invoiceIssueDate": "2026-04-02",
    "currencyCode": "VND",

    "seller": {
      "taxCode": "0123456789",  // MST - Tax ID
      "name": "Công ty TNHH AI Employee",
      "address": "123 Nguyễn Trãi, Quận 1, TP.HCM",
      "bankAccount": "1234567890",
      "bankName": "Ngân hàng TMCP Ngoại Thương VN"
    },

    "buyer": {
      "taxCode": "9876543210",
      "name": "Khách hàng ABC",
      "address": "456 Lê Lợi, Quận 1, TP.HCM"
    },

    "items": [
      {
        "lineNumber": 1,
        "description": "Dịch vụ AI Employee - Gói Growth",
        "quantity": 1,
        "unitCode": "CU",
        "unitPrice": 499000,
        "vatRate": 10,
        "vatAmount": 49900,
        "totalAmount": 548900
      }
    ],

    "total": {
      "netTotal": 499000,
      "vatTotal": 49900,
      "grandTotal": 548900
    }
  }
}
```

---

## API Integration Design

### E-Invoice Service Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/einvoice/create` | Create new e-invoice |
| GET | `/api/einvoice/:id` | Get invoice status |
| POST | `/api/einvoice/:id/cancel` | Cancel invoice |
| GET | `/api/einvoice/lookup/:taxCode` | Lookup buyer by tax code |

### E-Invoice Portal Integration

```javascript
// Example: Submit to e-invoice portal
async function submitEInvoice(invoiceData) {
  const response = await fetch(`${EInvoicePortal.API_URL}/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EInvoicePortal.API_KEY}`,
      'Client-ID': EInvoicePortal.CLIENT_ID
    },
    body: JSON.stringify(invoiceData)
  });

  return response.json();
}
```

---

## POC Implementation Plan

### Phase 1: E-Invoice Generation (This POC)
- [x] Research Vietnamese e-invoice requirements
- [ ] Design invoice data model
- [ ] Implement invoice generation service
- [ ] Create sample Vietnamese-compliant invoices

### Phase 2: E-Invoice Portal Integration (Future)
- [ ] Integrate with authorized e-invoice portal (VNPT, Viettel, etc.)
- [ ] Implement digital signature
- [ ] Handle submission and confirmation flow

### Phase 3: Accounting Sync (Future)
- [ ] Map AIEmployee plans to Vietnamese chart of accounts
- [ ] Sync transactions to accounting module
- [ ] Generate financial reports

### Phase 4: Tax Compliance (Future)
- [ ] VAT tracking and calculation
- [ ] Filing deadline reminders
- [ ] Compliance status dashboard

---

## Sample Code: E-Invoice Generator

```javascript
// api/src/services/einvoice.js

class VietnameseEInvoiceGenerator {
  constructor(config) {
    this.portalUrl = config.EINVOICE_PORTAL_URL;
    this.apiKey = config.EINVOICE_API_KEY;
    this.invoiceSeries = config.INVOICE_SERIES || 'AE/26';
    this.sequence = 0;
  }

  generateInvoiceNumber() {
    this.sequence++;
    return String(this.sequence).padStart(6, '0');
  }

  createInvoiceData(order) {
    const invoiceNumber = this.generateInvoiceNumber();
    const now = new Date();

    return {
      invoiceType: 'GTGT',
      invoiceSeries: this.invoiceSeries,
      invoiceNumber: invoiceNumber,
      invoiceIssueDate: now.toISOString().split('T')[0],

      seller: {
        taxCode: order.sellerTaxCode,
        name: order.sellerName,
        address: order.sellerAddress,
        bankAccount: order.sellerBankAccount,
        bankName: order.sellerBankName
      },

      buyer: {
        taxCode: order.buyerTaxCode,
        name: order.buyerName,
        address: order.buyerAddress
      },

      items: order.items.map((item, idx) => ({
        lineNumber: idx + 1,
        description: item.description,
        quantity: item.quantity,
        unitCode: item.unitCode || 'CU',
        unitPrice: item.unitPrice,
        vatRate: item.vatRate || 10,
        vatAmount: Math.round(item.unitPrice * item.quantity * item.vatRate / 100),
        totalAmount: Math.round(item.unitPrice * item.quantity * (1 + item.vatRate / 100))
      }))
    };
  }

  calculateTotals(invoiceData) {
    const netTotal = invoiceData.items.reduce(
      (sum, item) => sum + (item.unitPrice * item.quantity), 0
    );
    const vatTotal = invoiceData.items.reduce(
      (sum, item) => sum + item.vatAmount, 0
    );
    const grandTotal = netTotal + vatTotal;

    return { netTotal, vatTotal, grandTotal };
  }
}

module.exports = VietnameseEInvoiceGenerator;
```

---

## Supported E-Invoice Portals (Vietnam)

| Provider | Website | Status |
|----------|---------|--------|
| VNPT | vnpt-invoice.vn | Ready for integration |
| Viettel | viettel.vn | Ready for integration |
| BKAV | bkav.vn | Ready for integration |
| MISA | misa.com.vn | Ready for integration |

---

## Compliance Notes

### Vietnamese Tax Requirements
- VAT rates: 0%, 5%, 8%, 10% (standard)
- E-invoice must include: Seller/buyer tax codes, invoice series, line items, VAT amounts
- Digital signature required for submission
- Invoice retention: 10 years

### Data Privacy
- Tax codes (MST) are sensitive personal/business data
- Must comply with Vietnamese cybersecurity law (Luật An ninh mạng 2018)
- Data localization may be required for some business types

---

## Next Steps

1. **Select e-invoice portal partner** (VNPT, Viettel, or other authorized provider)
2. **Obtain API credentials** for sandbox environment
3. **Implement** sample invoice submission flow
4. **Test** with sandbox/test environment
5. **Deploy** for beta customer pilot

---

## References

- [Vietnam E-Invoicing Requirements - Sovos](https://sovos.com/vat/tax-rules/e-invoicing-vietnam/)
- [Vietnam VAT E-Invoicing - Avalara](https://www.avalara.com/us/en/vatlive/country-guides/asia/vietnam/vietnam-e-invoicing.html)
- [Circular 68/2019/TT-BTC - E-invoice guidance](https://minglichtrakht.files.wordpress.com/2019/08/circular-68-2019-tt-btc-guidance-on-e-invoices.pdf)

---

**Document Version:** 1.0
**Last Updated:** 2026-04-02
**Author:** CTO Manager (Paperclip Agent)