// In-memory, per-process protection. Use edge/shared rate limits when scaled.
function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createAbuseGuard({ maxRequests = 12, windowMs = 900000, maxConcurrent = 4, now = Date.now } = {}) {
  const requests = new Map();
  const releases = new WeakMap();
  let active = 0;
  let lastSweep = 0;
  const guard = (req, res, next) => {
    const time = now();
    if (time - lastSweep >= windowMs) {
      for (const [ip, entry] of requests) if (entry.resetAt <= time) requests.delete(ip);
      lastSweep = time;
    }
    // Honor req.ip only, not user-provided forwarding headers; configure trusted proxies on the server.
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    let entry = requests.get(ip);
    if (!entry || entry.resetAt <= time) {
      entry = { count: 0, resetAt: time + windowMs };
      requests.set(ip, entry);
    }
    const retrySeconds = Math.max(1, Math.ceil((entry.resetAt - time) / 1000));
    res.setHeader("RateLimit-Limit", String(maxRequests));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, maxRequests - entry.count - 1)));
    res.setHeader("RateLimit-Reset", String(retrySeconds));
    res.setHeader("Cache-Control", "no-store");
    if (entry.count >= maxRequests) {
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader("Retry-After", String(retrySeconds));
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    entry.count += 1;
    if (active >= maxConcurrent) {
      res.setHeader("Retry-After", "5");
      return res.status(503).json({ error: "Service is busy. Please retry shortly." });
    }
    active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active -= 1;
      res.off("finish", release);
      res.off("close", release);
      releases.delete(res);
    };
    releases.set(res, release);
    res.once("finish", release);
    res.once("close", release);
    next();
  };

  // Pair with the async route after its body parser. Until then, response events
  // release failed/aborted uploads. Once work starts, only its completion releases
  // capacity: closing the client connection does not cancel provider operations.
  guard.handle = (handler) => async (req, res, next) => {
    const release = releases.get(res);
    if (!release) return;
    res.off("finish", release);
    res.off("close", release);
    try {
      if (!req.aborted && !res.destroyed) await handler(req, res, next);
    } catch (error) {
      next(error);
    } finally {
      release();
    }
  };
  return guard;
}

export function createApiAbuseGuards(env = process.env) {
  const windowMs = positiveInteger(env.API_RATE_WINDOW_MINUTES, 15) * 60_000;
  return {
    analyze: createAbuseGuard({
      maxRequests: positiveInteger(env.API_RATE_ANALYZE_MAX, 12),
      maxConcurrent: positiveInteger(env.API_CONCURRENT_ANALYZE_MAX, 4), windowMs,
    }),
    extractAi: createAbuseGuard({
      maxRequests: positiveInteger(env.API_RATE_AI_MAX, 10),
      maxConcurrent: positiveInteger(env.API_CONCURRENT_AI_MAX, 2), windowMs,
    }),
    shares: createAbuseGuard({
      maxRequests: positiveInteger(env.API_RATE_SHARES_MAX, 20),
      maxConcurrent: positiveInteger(env.API_CONCURRENT_SHARES_MAX, 8), windowMs,
    }),
  };
}
