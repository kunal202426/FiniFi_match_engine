const PurchaseOrder = require('../models/PurchaseOrder');
const GRN = require('../models/GRN');
const CommercialInvoice = require('../models/CommercialInvoice');
const { matchInvoiceItemsToPO } = require('./aiMatch');


const stopWords = new Set([
  'meatigo', 'psm', 'frozen', 'rtc', 'everyday', 'fs', 'g', 'kg', 'pieces',
  'pcs', 'pack', 'the', 'and', '&', '-', 'plain',
]);

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
const similarity = (a, b) => {
  const setA = tokenize(a);
  const setB = new Set(tokenize(b));
  if (setA.length === 0) return 0;
  const shared = setA.filter((w) => setB.has(w)).length;
  return shared / Math.max(setA.length, setB.size);
};
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
  const grnItems = grns.flatMap((g) => g.items);
  const invItems = invoices.flatMap((i) => i.items);

  const reasons = [];

  const grnQtyByPo = new Array(po.items.length).fill(0);
  const invQtyByPo = new Array(po.items.length).fill(0);
  for (const it of grnItems) {
    const idx = it.itemCode ? po.items.findIndex((p) => p.itemCode === it.itemCode) : -1;
    if (idx !== -1) grnQtyByPo[idx] += it.receivedQty || 0;
  }
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
