const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    skills: [{ type: String, index: true }],
    embedding: { type: [Number], default: undefined },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Job', JobSchema);
