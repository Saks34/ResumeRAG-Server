const router = require('express').Router();
const { authMiddlewareOptional } = require('../middleware/auth');
const { ask, history } = require('../controllers/askController');

router.post('/ask', authMiddlewareOptional, ask);
router.get('/ask/history', authMiddlewareOptional, history);

module.exports = router;
