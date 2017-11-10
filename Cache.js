var NodeCache = require('node-cache');

const TTL = 60 * 5; // Evict key after five minutes.

// Make cache instance compliant to the Map interface.
// https://lodash.com/docs/#memoize
class Cache extends NodeCache {
  constructor () {
    super({
      stdTTL: TTL
    });
  }

  set (key, value) {
    super.set(key, value);
    return this;
  }

  delete (key) {
    this.del(key);
  }

  clear () {
    this.flushAll();
  }

  has (key) {
    return super.get(key) !== undefined;
  }
}

module.exports = Cache;
