function notFound(req, res, next) {
  res.status(404);
  next(new Error('Not Found'));
}

function errorHandler(err, req, res, next) {
  const status = res.statusCode !== 200 ? res.statusCode : 500;
  const message = err.message || 'Server Error';
  if (status === 429) {
    return res.status(429).json({ error: { code: 'RATE_LIMIT' } });
  }
  res.status(status).json({ error: { message } });
}

module.exports = { notFound, errorHandler };
