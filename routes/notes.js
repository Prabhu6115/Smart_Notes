const express = require('express');
const router = express.Router();
const notesController = require('../controllers/notesController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// Protect all note routes with JWT authentication
router.use(auth);

// CRUD routes
router.get('/', notesController.getNotes);
router.get('/:id', notesController.getNoteById);
router.post('/', notesController.createNote);

// Handle Multer upload errors gracefully in-route
router.post('/upload', (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err) {
      // Return 400 Bad Request if file size limit exceeded or invalid file type
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, notesController.createNoteFromUpload);

router.put('/:id', notesController.updateNote);
router.post('/:id/resummarize', notesController.resummarizeNote);
router.delete('/:id', notesController.deleteNote);

module.exports = router;
