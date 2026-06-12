const { GoogleGenerativeAI } = require('@google/generative-ai');

const keys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

const models = keys.map((key) =>
  new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-2.5-flash' })
);

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

// ask gemini to map each invoice line to the best PO itemCode.
// returns an array of itemCodes (or nulls), same length as invItems.
// returns null if anything goes wrong so the caller can fall back to fuzzy matching.
const matchInvoiceItemsToPO = async (poItems, invItems) => {
  if (!models.length || !invItems.length) return null;

  const poList = poItems.map((p) => ({
    itemCode: p.itemCode,
    description: p.description,
    quantity: p.quantity,
    unitBasePrice: p.unitBasePrice,
  }));

  const invList = invItems.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unitRate: i.unitRate,
  }));

  const prompt = `You are matching invoice line items to purchase order line items.

PO items (the source of truth, each has a unique itemCode):
${JSON.stringify(poList)}

Invoice items (these need to be mapped):
${JSON.stringify(invList)}

For each invoice item in order, pick the single best matching PO itemCode. Use product description as the main signal, but you may also use unitRate vs unitBasePrice and quantity as tie-breakers when descriptions look similar (for example "Chicken Momos" could be either the 24-piece or 10-piece PO line - use the rate to decide). If nothing is a confident match, return null for that line.

Return ONLY a JSON array of strings/nulls, exactly ${invList.length} elements long, same order as the invoice list. No commentary, no fences.`;

  try {
    const result = await callGemini([prompt]);
    const text = result.response.text();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed) || parsed.length !== invItems.length) return null;

    // only trust codes that actually exist in the po
    const validCodes = new Set(poItems.map((p) => p.itemCode));
    return parsed.map((c) => (typeof c === 'string' && validCodes.has(c) ? c : null));
  } catch {
    return null;
  }
};

module.exports = { matchInvoiceItemsToPO };
