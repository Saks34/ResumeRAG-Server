const router = require('express').Router();

router.get('/_meta', (req, res) => {
  res.json({
    name: 'ResumeRAG',
    version: '0.1.0',
    stack: ['MongoDB', 'Express.js', 'React', 'Node.js'],
    models: ['User', 'Resume', 'Job'],
    endpoints: ['auth', 'resumes', 'jobs', 'ask', 'health'],
  });
});

module.exports = router;
