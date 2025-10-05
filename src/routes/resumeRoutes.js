const router = require('express').Router();
const { authMiddlewareOptional, requireRecruiter, forbidRecruiter } = require('../middleware/auth');
const { uploadMiddleware, createResumes, listResumes, getResume, downloadResume, analytics } = require('../controllers/resumeController');

// Upload is NOT for recruiters (viewers can upload)
router.post('/', authMiddlewareOptional, forbidRecruiter, uploadMiddleware(), createResumes);
router.get('/', authMiddlewareOptional, listResumes);
// Analytics NOT for viewers -> recruiters only
router.get('/analytics/basic', authMiddlewareOptional, requireRecruiter, analytics);
router.get('/:id', authMiddlewareOptional, getResume);
router.get('/:id/download', authMiddlewareOptional, downloadResume);

module.exports = router;
