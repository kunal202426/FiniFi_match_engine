const express = require('express');
const multer = require('multer');
const parsePdf = require('../services/parse');
const runMatch = require('../services/matcher');
const PurchaseOrder = require('../models/PurchaseOrder');
const GRN = require('../models/GRN');
const CommercialInvoice = require('../models/CommercialInvoice');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const modelMap = {
  po: PurchaseOrder,
  grn: GRN,
  invoice: CommercialInvoice,
};

router.post('/upload', upload.single('file'), async (req, res) => {
  const { documentType } = req.body;

  if (!documentType || !modelMap[documentType]) {
    return res.status(400).json({ error: 'documentType must be po, grn, or invoice' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'no file uploaded' });
  }

  const parsed = await parsePdf(req.file.buffer, documentType);

//reupload overwrite logic
  const Model = modelMap[documentType];
  if (documentType === 'po') {
    await Model.deleteOne({ poNumber: parsed.poNumber });
  } else if (documentType === 'grn') {
    await Model.deleteOne({ grnNumber: parsed.grnNumber });
  } else {
    await Model.deleteOne({ invoiceNumber: parsed.invoiceNumber });
  }
  const doc = await Model.create(parsed);

  const poNumber = parsed.poNumber;
  const matchResult = await runMatch(poNumber);

  res.status(201).json({ document: doc, match: matchResult });
});

router.get('/:id', async (req, res) => {
  const collections = [PurchaseOrder, GRN, CommercialInvoice];

  for (const Model of collections) {
    const doc = await Model.findById(req.params.id);
    if (doc) return res.json(doc);
  }

  res.status(404).json({ error: 'document not found' });
});

module.exports = router;
