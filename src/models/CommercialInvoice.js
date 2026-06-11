const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  itemCode: String,
  description: String,
  quantity:Number,
  uom:String,
  unitRate:Number,
  discountPct:Number,
  hsnCode:String,
  taxableValue:Number,
  cgstRate:Number,
  cgstAmount:Number,
  sgstRate: Number,
  sgstAmount:Number,
  total: Number,
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber:{ type: String, required: true },
  invoiceDate:{ type: Date, required: true },
  poNumber: { type: String, required: true },
  customerOrderDate: Date,
  state: String,
  stateCode:String,
  deliveryChallanNo: String,
  ewbNo:String,
  irnNo: String,
  fssaiLicNo:String,

  vendorName: String,
  vendorAddress: String,
  vendorGstin:String,
  vendorPan:String,
  vendorCin: String,
  vendorPhone:String,
  vendorWebsite:String,

  buyerName:String,
  buyerLedger:String,
  buyerGstin: String,
  buyerAddress: String,
  contPerson: String,
  mobile: String,
  transport: String,
  vehicleNo: String,

  items: [itemSchema],

  totalQuantity:Number,
  totalTaxableValue: Number,
  totalCgst:Number,
  totalSgst:Number,
  totalGst:Number,
  totalAmount:Number,

  bankName:String,
  accountNo:String,
  ifscCode:String,
  bankBranch:String,
}, { timestamps: true });

module.exports = mongoose.model('CommercialInvoice', invoiceSchema);
