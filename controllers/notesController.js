const Note = require('../models/Note');
const geminiService = require('../services/geminiService');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Helper to extract text from buffer based on file type
const extractTextFromFile = async (file) => {
  if (file.mimetype === 'application/pdf') {
    const data = await pdfParse(file.buffer);
    if (!data.text || !data.text.trim()) {
      throw new Error('PDF file appears to be empty or unreadable.');
    }
    return data.text;
  } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const data = await mammoth.extractRawText({ buffer: file.buffer });
    if (!data.value || !data.value.trim()) {
      throw new Error('DOCX file appears to be empty or unreadable.');
    }
    return data.value;
  } else {
    throw new Error('Unsupported file format. Only PDF and DOCX files are allowed.');
  }
};

// @desc    Get all notes for logged-in user (supports search)
// @route   GET /api/notes
// @access  Private
exports.getNotes = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { userId: req.user.id };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { title: searchRegex },
        { originalText: searchRegex }
      ];
    }

    // Sort by newest first
    const notes = await Note.find(query).sort({ createdAt: -1 });
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ message: 'Server error while retrieving notes' });
  }
};

// @desc    Get single note details
// @route   GET /api/notes/:id
// @access  Private
exports.getNoteById = async (req, res) => {
  try {
    const note = await Note.findById(req.idParam || req.params.id);

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check ownership
    if (note.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to access this note' });
    }

    res.json(note);
  } catch (error) {
    console.error('Error fetching note details:', error);
    res.status(500).json({ message: 'Server error while retrieving note details' });
  }
};

// @desc    Create note from pasted text
// @route   POST /api/notes
// @access  Private
exports.createNote = async (req, res) => {
  try {
    const { title, originalText } = req.body;

    if (!title || !originalText || !title.trim() || !originalText.trim()) {
      return res.status(400).json({ message: 'Title and content text are required' });
    }

    let summary = '';
    let keyPoints = [];
    let aiFailed = false;

    // Call Gemini API
    const aiResult = await geminiService.summarizeText(originalText);
    if (aiResult) {
      summary = aiResult.summary;
      keyPoints = aiResult.keyPoints;
    } else {
      aiFailed = true;
    }

    const note = await Note.create({
      userId: req.user.id,
      title: title.trim(),
      originalText: originalText.trim(),
      summary,
      keyPoints,
      sourceType: 'pasted'
    });

    res.status(201).json({
      note,
      aiFailed,
      message: aiFailed 
        ? 'Note created successfully, but AI summarization failed. You can retry from the note details page.' 
        : 'Note created and summarized successfully.'
    });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ message: 'Server error while creating note' });
  }
};

// @desc    Create note from uploaded document
// @route   POST /api/notes/upload
// @access  Private
exports.createNoteFromUpload = async (req, res) => {
  try {
    const { title } = req.body;
    const file = req.file;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded or file rejected by filter' });
    }

    let originalText;
    try {
      originalText = await extractTextFromFile(file);
    } catch (parseErr) {
      return res.status(400).json({ message: parseErr.message });
    }

    let summary = '';
    let keyPoints = [];
    let aiFailed = false;

    // Call Gemini API
    const aiResult = await geminiService.summarizeText(originalText);
    if (aiResult) {
      summary = aiResult.summary;
      keyPoints = aiResult.keyPoints;
    } else {
      aiFailed = true;
    }

    const note = await Note.create({
      userId: req.user.id,
      title: title.trim(),
      originalText: originalText,
      summary,
      keyPoints,
      sourceType: 'uploaded'
    });

    res.status(201).json({
      note,
      aiFailed,
      message: aiFailed 
        ? 'Document uploaded and parsed, but AI summarization failed. You can retry from the note details page.' 
        : 'Document uploaded, parsed, and summarized successfully.'
    });
  } catch (error) {
    console.error('Error creating note from file upload:', error);
    res.status(500).json({ message: 'Server error while uploading and parsing file' });
  }
};

// @desc    Update an existing note's title and/or text (does NOT auto-trigger re-summarization)
// @route   PUT /api/notes/:id
// @access  Private
exports.updateNote = async (req, res) => {
  try {
    const { title, originalText } = req.body;
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check ownership
    if (note.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to modify this note' });
    }

    if (title !== undefined) note.title = title.trim();
    if (originalText !== undefined) note.originalText = originalText.trim();

    await note.save();
    res.json({
      note,
      message: 'Note updated successfully.'
    });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ message: 'Server error while updating note' });
  }
};

// @desc    Re-summarize note using Gemini API
// @route   POST /api/notes/:id/resummarize
// @access  Private
exports.resummarizeNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check ownership
    if (note.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to modify this note' });
    }

    // Call Gemini API
    const aiResult = await geminiService.summarizeText(note.originalText);
    if (!aiResult) {
      return res.status(500).json({ 
        message: 'AI summarization failed. Please verify your Gemini API key or try again later.' 
      });
    }

    note.summary = aiResult.summary;
    note.keyPoints = aiResult.keyPoints;
    await note.save();

    res.json({
      note,
      message: 'Note re-summarized successfully.'
    });
  } catch (error) {
    console.error('Error re-summarizing note:', error);
    res.status(500).json({ message: 'Server error during re-summarization' });
  }
};

// @desc    Delete a note
// @route   DELETE /api/notes/:id
// @access  Private
exports.deleteNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check ownership
    if (note.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this note' });
    }

    await note.deleteOne();
    res.json({ message: 'Note deleted successfully.' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ message: 'Server error while deleting note' });
  }
};
