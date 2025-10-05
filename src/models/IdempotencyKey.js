const mongoose = require('mongoose');

const IdempotencyKeySchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['started', 'completed', 'failed'], default: 'started' },
    result: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model('IdempotencyKey', IdempotencyKeySchema);
