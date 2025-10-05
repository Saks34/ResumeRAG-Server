const store = new Map();

function setCache(key, value, ttlMs) {
  const expireAt = Date.now() + ttlMs;
  store.set(key, { value, expireAt });
}

function getCache(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

module.exports = { setCache, getCache };
