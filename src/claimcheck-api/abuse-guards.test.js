import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createAbuseGuard, createApiAbuseGuards } from "./abuse-guards.js";

function call(middleware, ip = "203.0.113.10") {
  const req = { ip, socket: { remoteAddress: "127.0.0.1" }, headers: { "x-forwarded-for": "198.51.100.1" } };
  const res = new EventEmitter();
  const headers = {};
  res.setHeader = (name, value) => { headers[name.toLowerCase()] = value; };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn((body) => { res.body = body; res.emit("finish"); return res; });
  const next = vi.fn();
  middleware(req, res, next);
  return { req, res, next, headers };
}

describe("API abuse guards", () => {
  it("responds 429 with Retry-After and resets at the window boundary", () => {
    let time = 1000;
    const guard = createAbuseGuard({ maxRequests: 2, windowMs: 1000, maxConcurrent: 2, now: () => time });
    const first = call(guard);
    expect(first.next).toHaveBeenCalledOnce();
    first.res.emit("finish");
    const second = call(guard);
    expect(second.next).toHaveBeenCalledOnce();
    second.res.emit("finish");
    const blocked = call(guard);
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.headers["retry-after"]).toBe("1");
    time += 1000;
    const restored = call(guard);
    expect(restored.next).toHaveBeenCalledOnce();
    restored.res.emit("finish");
  });

  it("keys by Express req.ip instead of a forged forwarded header", () => {
    const guard = createAbuseGuard({ maxRequests: 1 });
    const first = call(guard);
    first.res.emit("finish");
    expect(call(guard).res.statusCode).toBe(429);
    const differentIp = call(guard, "203.0.113.11");
    expect(differentIp.next).toHaveBeenCalledOnce();
    differentIp.res.emit("finish");
  });

  it("limits active requests and releases them once on finish or close", () => {
    const guard = createAbuseGuard({ maxRequests: 8, maxConcurrent: 1 });
    const first = call(guard);
    expect(first.next).toHaveBeenCalledOnce();
    const busy = call(guard);
    expect(busy.res.statusCode).toBe(503);
    expect(busy.headers["retry-after"]).toBe("5");
    first.res.emit("close");
    first.res.emit("finish");
    const next = call(guard);
    expect(next.next).toHaveBeenCalledOnce();
    next.res.emit("finish");
  });

  it("holds capacity until the handler settles even if it sends a response early", async () => {
    const guard = createAbuseGuard({ maxRequests: 8, maxConcurrent: 1 });
    const first = call(guard);
    const work = Promise.withResolvers();
    const handler = guard.handle(async (_req, res) => {
      res.json({ ok: true });
      await work.promise;
    });
    const running = handler(first.req, first.res, first.next);
    expect(call(guard).res.statusCode).toBe(503);
    work.resolve();
    await running;
    const restored = call(guard);
    expect(restored.next).toHaveBeenCalledOnce();
    restored.res.emit("finish");
  });

  it("releases capacity and forwards rejected handlers to Express", async () => {
    const guard = createAbuseGuard({ maxConcurrent: 1 });
    const first = call(guard);
    const error = new Error("handler failed");
    const next = vi.fn();
    await guard.handle(async () => { throw error; })(first.req, first.res, next);
    expect(next).toHaveBeenCalledExactlyOnceWith(error);
    // Later response events must not release the slot a second time.
    const restored = call(guard);
    first.res.emit("close");
    expect(call(guard).res.statusCode).toBe(503);
    restored.res.emit("finish");
  });

  it("does not start work after a client disconnects during body parsing", async () => {
    const guard = createAbuseGuard({ maxConcurrent: 1 });
    const first = call(guard);
    first.res.emit("close");
    const handler = vi.fn();
    await guard.handle(handler)(first.req, first.res, first.next);
    expect(handler).not.toHaveBeenCalled();
    const restored = call(guard);
    expect(restored.next).toHaveBeenCalledOnce();
    restored.res.emit("finish");
  });

  it("handles invalid configuration using safe defaults", () => {
    const guards = createApiAbuseGuards({ API_RATE_ANALYZE_MAX: "-1", API_CONCURRENT_AI_MAX: "0" });
    for (let i = 0; i < 12; i += 1) {
      const allowed = call(guards.analyze);
      expect(allowed.next).toHaveBeenCalledOnce();
      allowed.res.emit("finish");
    }
    expect(call(guards.analyze).res.statusCode).toBe(429);
    const first = call(guards.extractAi);
    const second = call(guards.extractAi);
    expect(first.next).toHaveBeenCalledOnce();
    expect(second.next).toHaveBeenCalledOnce();
    expect(call(guards.extractAi).res.statusCode).toBe(503);
    first.res.emit("finish");
    second.res.emit("finish");
  });
});
