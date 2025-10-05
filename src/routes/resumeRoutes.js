const router = require('express').Router();
const { authMiddlewareOptional } = require('../middleware/auth');
const { uploadMiddleware, createResumes, listResumes, getResume, downloadResume, analytics } = require('../controllers/resumeController');

router.post('/', authMiddlewareOptional, uploadMiddleware(), createResumes);
router.get('/', authMiddlewareOptional, listResumes);
router.get('/analytics/basic', authMiddlewareOptional, analytics);
router.get('/:id', authMiddlewareOptional, getResume);
router.get('/:id/download', authMiddlewareOptional, downloadResume);

module.exports = router;
