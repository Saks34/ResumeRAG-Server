const router = require('express').Router();
const { authMiddlewareOptional } = require('../middleware/auth');
const { createJob, getJob, matchJob, matchJobGet } = require('../controllers/jobController');

router.post('/', authMiddlewareOptional, createJob);
router.get('/:id', authMiddlewareOptional, getJob);
router.post('/:id/match', authMiddlewareOptional, matchJob);
router.get('/:id/match', authMiddlewareOptional, matchJobGet);

module.exports = router;
