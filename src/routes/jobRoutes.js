const router = require('express').Router();
const { authMiddlewareOptional, requireRecruiter } = require('../middleware/auth');
const { createJob, getJob, listJobs, matchJob, matchJobGet } = require('../controllers/jobController');

router.get('/', authMiddlewareOptional, listJobs);
router.post('/', authMiddlewareOptional, requireRecruiter, createJob);
router.get('/:id', authMiddlewareOptional, getJob);
router.post('/:id/match', authMiddlewareOptional, requireRecruiter, matchJob);
router.get('/:id/match', authMiddlewareOptional, requireRecruiter, matchJobGet);

module.exports = router;
