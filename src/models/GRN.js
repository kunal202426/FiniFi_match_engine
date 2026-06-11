const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  itemCode: String,
  vendorSku: String,
  description: String,
  skuBin: String,
  lotNo: String,
  lotMrp: Number,
  expectedQty: Number,
  receivedQty: Number,
  unitPrice: Number,
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

const grnSchema = new mongoose.Schema({
  grnNumber: { type: String, required: true },
  poNumber: { type: String, required: true },
  poDate: Date,
  inboundNo: String,
  createDate: Date,
  grnDate: { type: Date, required: true },

  vendorName: String,
  vendorAddress: String,
  vendorContact: String,

  invoiceRef: String,
  invoiceDate: Date,
  challanNo: String,

  items: [itemSchema],

  totalExpectedQty: Number,
  totalReceivedQty: Number,
  totalTaxableValue: Number,
  totalCgst: Number,
  totalSgst: Number,
  grandTotal: Number,
}, { timestamps: true });

module.exports = mongoose.model('GRN', grnSchema);
