const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  itemCode: String,
  description: String,
  hsnCode: String,
  quantity: Number,
  mrp: Number,
  unitBasePrice: Number,
  taxableValue: Number,
  cgstRate: Number,
  cgstAmount: Number,
  sgstRate: Number,
  sgstAmount: Number,
  igstRate: Number,
  igstAmount: Number,
  cessRate: Number,
  cessAmount: Number,
  additionalCess: Number,
  total: Number,
}, { _id: false });

const poSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  poDate: { type: Date, required: true },
  poReleaseDate: Date,
  poExpiryDate: Date,
  expectedDeliveryDate: Date,
  paymentTerms: String,
  referencePOCode: String,

  vendorName: String,
  vendorAddress: String,
  vendorGstin: String,
  vendorPan: String,
  vendorContact: String,

  buyerName: String,
  buyerAddress: String,
  buyerGstin: String,
  buyerContact: String,
  buyerEmail: String,

  items: [itemSchema],

  totalTaxableValue: Number,
  totalCgst: Number,
  totalSgst: Number,
  totalIgst: Number,
  totalCess: Number,
  totalTax: Number,
  grandTotal: Number,
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', poSchema);
