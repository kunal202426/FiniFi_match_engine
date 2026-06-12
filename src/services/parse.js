const { GoogleGenerativeAI } = require('@google/generative-ai');

// support multiple keys as fallback
const keys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

const models = keys.map((key) =>
  new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-2.5-flash' })
);

const prompts = {
  po: `Extract all data from this Purchase Order PDF and return ONLY valid JSON with no extra text, matching this structure:
{
  "poNumber": "", "poDate": "", "poReleaseDate": "", "poExpiryDate": "",
  "expectedDeliveryDate": "", "paymentTerms": "", "referencePOCode": "",
  "vendorName": "", "vendorAddress": "", "vendorGstin": "", "vendorPan": "", "vendorContact": "",
  "buyerName": "", "buyerAddress": "", "buyerGstin": "", "buyerContact": "", "buyerEmail": "",
  "items": [{
    "itemCode": "", "description": "", "hsnCode": "",
    "quantity": 0, "mrp": 0, "unitBasePrice": 0, "taxableValue": 0,
    "cgstRate": 0, "cgstAmount": 0, "sgstRate": 0, "sgstAmount": 0,
    "igstRate": 0, "igstAmount": 0, "cessRate": 0, "cessAmount": 0,
    "additionalCess": 0, "total": 0
  }],
  "totalTaxableValue": 0, "totalCgst": 0, "totalSgst": 0,
  "totalIgst": 0, "totalCess": 0, "totalTax": 0, "grandTotal": 0
}
For the description field: return clean product name only. Strip any leading "psm"/"PSM" prefix, and remove Colour/Size/Brand lines. Example: "psm Cheesy Spicy Veg Momos 24.0 Pieces Colour: Size: size Brand:Band_2" becomes "Cheesy Spicy Veg Momos 24 Pieces".`,

  grn: `Extract all data from this GRN PDF and return ONLY valid JSON with no extra text, matching this structure:
{
  "grnNumber": "", "poNumber": "", "poDate": "", "inboundNo": "",
  "createDate": "", "grnDate": "", "vendorName": "", "vendorAddress": "", "vendorContact": "",
  "invoiceRef": "", "invoiceDate": "", "challanNo": "",
  "items": [{
    "itemCode": "", "vendorSku": "", "description": "", "skuBin": "", "lotNo": "",
    "lotMrp": 0, "expectedQty": 0, "receivedQty": 0, "unitPrice": 0, "taxableValue": 0,
    "cgstRate": 0, "cgstAmount": 0, "sgstRate": 0, "sgstAmount": 0,
    "igstRate": 0, "igstAmount": 0, "cessRate": 0, "cessAmount": 0,
    "additionalCess": 0, "total": 0
  }],
  "totalExpectedQty": 0, "totalReceivedQty": 0,
  "totalTaxableValue": 0, "totalCgst": 0, "totalSgst": 0, "grandTotal": 0
}
For description: clean product name only, no prefixes or extra metadata.`,

  invoice: `Extract all data from this commercial Invoice PDF and return ONLY valid JSON with no extra text, matching this structure:
{
  "invoiceNumber": "", "invoiceDate": "", "poNumber": "", "customerOrderDate": "",
  "state": "", "stateCode": "", "deliveryChallanNo": "", "ewbNo": "", "irnNo": "", "fssaiLicNo": "",
  "vendorName": "", "vendorAddress": "", "vendorGstin": "", "vendorPan": "", "vendorCin": "",
  "vendorPhone": "", "vendorWebsite": "",
  "buyerName": "", "buyerLedger": "", "buyerGstin": "", "buyerAddress": "",
  "contPerson": "", "mobile": "", "transport": "", "vehicleNo": "",
  "items": [{
    "itemCode": "", "description": "", "quantity": 0, "uom": "",
    "unitRate": 0, "discountPct": 0, "hsnCode": "",
    "taxableValue": 0, "cgstRate": 0, "cgstAmount": 0,
    "sgstRate": 0, "sgstAmount": 0, "total": 0
  }],
  "totalQuantity": 0, "totalTaxableValue": 0, "totalCgst": 0,
  "totalSgst": 0, "totalGst": 0, "totalAmount": 0,
  "bankName": "", "accountNo": "", "ifscCode": "", "bankBranch": ""
}
For description: clean product name only, no prefixes or extra metadata.`,
};


const fixDate = (val) => {
  if (!val) return null;
 
  const parts = String(val).match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (parts) return new Date(`${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
  const d = new Date(val);
  return isNaN(d) ? null : d;
};

const dateFields = [
  'poDate', 'poReleaseDate', 'poExpiryDate', 'expectedDeliveryDate',
  'grnDate', 'createDate', 'invoiceDate', 'customerOrderDate',
];

const callGemini = async (parts) => {
  let lastErr;
  for (const model of models) {
    try {
      return await model.generateContent(parts);
    } catch (err) {
      lastErr = err;
      if (err.status === 503 || err.status === 429) continue;
      throw err;
    }
  }
  throw lastErr;
};

const parsePdf = async (fileBuffer, docType) => {
  const result = await callGemini([
    {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    },
    prompts[docType],
  ]);

  const text = result.response.text();
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  for (const key of dateFields) {
    if (parsed[key]) parsed[key] = fixDate(parsed[key]);
  }

  return parsed;
};

module.exports = parsePdf;
