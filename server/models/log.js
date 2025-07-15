const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  action: { type: String, enum: ['CREATE', 'UPDATE', 'DELETE', 'EXPORT'], required: true },
  collection: { type: String, required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: false },
  operator: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', LogSchema); 