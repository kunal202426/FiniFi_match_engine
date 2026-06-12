const PurchaseOrder = require('../models/PurchaseOrder');
const GRN = require('../models/GRN');
const CommercialInvoice = require('../models/CommercialInvoice');
const { matchInvoiceItemsToPO } = require('./aiMatch');

// words that show up inconsistently across po/grn/invoice and just add noise
const stopWords = new Set([
  'meatigo', 'psm', 'frozen', 'rtc', 'everyday', 'fs', 'g', 'kg', 'pieces',
  'pcs', 'pack', 'the', 'and', '&', '-', 'plain',
]);

// break a description into a set of meaningful words, with a few spelling fixes
const tokenize = (str) => {
  return str
    .toLowerCase()
    .replace(/vegetable/g, 'veg')
    .replace(/kabab/g, 'kebab')
    .replace(/keema/g, 'kheema')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !stopWords.has(w) && isNaN(w));
};

// score how similar two descriptions are by shared words
const similarity = (a, b) => {
  const setA = tokenize(a);
  const setB = new Set(tokenize(b));
  if (setA.length === 0) return 0;
  const shared = setA.filter((w) => setB.has(w)).length;
  return shared / Math.max(setA.length, setB.size);
};

// find the best matching item from a list for a given description
const bestMatch = (desc, items) => {
  let best = null;
  let bestScore = 0;
  for (const item of items) {
    const score = similarity(desc, item.description);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= 0.5 ? best : null;
};

const runMatch = async (poNumber) => {
  const [po, grns, invoices] = await Promise.all([
    PurchaseOrder.findOne({ poNumber }),
    GRN.find({ poNumber }),
    CommercialInvoice.find({ poNumber }),
  ]);

  const documents = { po, grns, invoices };

  if (!po || grns.length === 0 || invoices.length === 0) {
    const missing = [!po && 'po', grns.length === 0 && 'grn', invoices.length === 0 && 'invoice'].filter(Boolean);
    return { poNumber, status: 'insufficient_documents', missing, reasons: [], documents };
  }

  // flatten all grn and invoice line items across every grn/invoice for this po
  const grnItems = grns.flatMap((g) => g.items);
  const invItems = invoices.flatMap((i) => i.items);

  const reasons = [];

  const grnQtyByPo = new Array(po.items.length).fill(0);
  const invQtyByPo = new Array(po.items.length).fill(0);

  // po and grn share the buyer sku, so join them on itemCode directly
  for (const it of grnItems) {
    const idx = it.itemCode ? po.items.findIndex((p) => p.itemCode === it.itemCode) : -1;
    if (idx !== -1) grnQtyByPo[idx] += it.receivedQty || 0;
  }

  // invoice uses the vendor's own codes, so it cant join on code.
  // ask gemini to map each invoice line to a po itemCode (one batch call).
  // if it fails / hits quota, aiCodes will be null and we fall back to the fuzzy bestMatch.
  const aiCodes = await matchInvoiceItemsToPO(po.items, invItems);

  for (let i = 0; i < invItems.length; i++) {
    const it = invItems[i];
    let poItem = null;

    const aiCode = aiCodes ? aiCodes[i] : null;
    if (aiCode) poItem = po.items.find((p) => p.itemCode === aiCode) || null;
    if (!poItem) poItem = bestMatch(it.description, po.items);

    if (poItem) {
      invQtyByPo[po.items.indexOf(poItem)] += it.quantity || 0;
    } else {
      reasons.push({ code: 'item_missing_in_po', item: it.description });
    }
  }

  let cleanItems = 0;

  for (let i = 0; i < po.items.length; i++) {
    const poItem = po.items[i];
    const grnQty = grnQtyByPo[i];
    const invQty = invQtyByPo[i];

    // skip items that never showed up on a grn or invoice yet
    if (grnQty === 0 && invQty === 0) continue;

    let hadIssue = false;

    if (grnQty > poItem.quantity) {
      reasons.push({ code: 'grn_qty_exceeds_po_qty', item: poItem.description, grnQty, poQty: poItem.quantity });
      hadIssue = true;
    }
    if (invQty > grnQty) {
      reasons.push({ code: 'invoice_qty_exceeds_grn_qty', item: poItem.description, invoiceQty: invQty, grnQty });
      hadIssue = true;
    }
    if (invQty > poItem.quantity) {
      reasons.push({ code: 'invoice_qty_exceeds_po_qty', item: poItem.description, invoiceQty: invQty, poQty: poItem.quantity });
      hadIssue = true;
    }

    if (!hadIssue) cleanItems++;
  }

  // rule 4, literal per assignment: invoice date must not be after po date
  for (const inv of invoices) {
    if (new Date(inv.invoiceDate) > new Date(po.poDate)) {
      reasons.push({ code: 'invoice_date_after_po_date', invoice: inv.invoiceNumber, invoiceDate: inv.invoiceDate, poDate: po.poDate });
    }
  }

  let status;
  if (reasons.length === 0) {
    status = 'matched';
  } else if (cleanItems > 0) {
    status = 'partially_matched';
  } else {
    status = 'mismatch';
  }

  return { poNumber, status, reasons, documents };
};

module.exports = runMatch;