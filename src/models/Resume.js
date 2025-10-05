const mongoose = require('mongoose');

const ResumeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    filename: { type: String },
    contentType: { type: String },
    text: { type: String },
    skills: [{ type: String, index: true }],
    embedding: { type: [Number], default: undefined },
    size: { type: Number },
    pii: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
    },
  },
  { timestamps: true }
);

// Full-text search on text and skills
ResumeSchema.index({ text: 'text', skills: 'text' });

module.exports = mongoose.model('Resume', ResumeSchema);
