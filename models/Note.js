const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Note title is required'],
    trim: true
  },
  originalText: {
    type: String,
    required: [true, 'Note content is required']
  },
  summary: {
    type: String,
    default: ''
  },
  keyPoints: {
    type: [String],
    default: []
  },
  sourceType: {
    type: String,
    enum: ['pasted', 'uploaded'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Note', NoteSchema);
