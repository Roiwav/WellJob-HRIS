const express = require("express");

const router = express.Router();

const {
  login,
} = require("../controllers/authController");

/*
 * ==================================================
 * LOGIN RATE LIMITING
 * ==================================================
 *
 * Protect the login endpoint from repeated brute-force
 * attempts without introducing another runtime
 * dependency.
 *
 * Strategy:
 * - Track failed login attempts per client IP.
 * - Allow up to 5 failed attempts within 15 minutes.
 * - Successful authentication clears the client's
 *   failure counter.
 * - Backend/server failures (5xx) do NOT count as
 *   failed login attempts, preventing an infrastructure
 *   outage from locking legitimate users out.
 * - Expired entries are periodically removed.
 *
 * This in-memory limiter is appropriate for the
 * current single-backend intranet deployment.
 * If the backend is later scaled to multiple Node.js
 * instances, move the counters to a shared store
 * such as Redis.
 */
const LOGIN_RATE_LIMIT_WINDOW_MS =
  15 * 60 * 1000;

const LOGIN_RATE_LIMIT_MAX_FAILURES =
  5;

const loginFailureStore =
  new Map();

function getClientKey(req) {
  return (
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown-client"
  );
}

function getActiveBucket(
  clientKey,
  now
) {
  const existingBucket =
    loginFailureStore.get(
      clientKey
    );

  if (
    !existingBucket ||
    now >=
      existingBucket.resetAt
  ) {
    const newBucket = {
      failedAttempts: 0,
      resetAt:
        now +
        LOGIN_RATE_LIMIT_WINDOW_MS,
    };

    loginFailureStore.set(
      clientKey,
      newBucket
    );

    return newBucket;
  }

  return existingBucket;
}

function setRateLimitHeaders(
  res,
  bucket
) {
  const remaining = Math.max(
    0,
    LOGIN_RATE_LIMIT_MAX_FAILURES -
      bucket.failedAttempts
  );

  const retryAfterSeconds =
    Math.max(
      0,
      Math.ceil(
        (
          bucket.resetAt -
          Date.now()
        ) / 1000
      )
    );

  res.setHeader(
    "X-RateLimit-Limit",
    LOGIN_RATE_LIMIT_MAX_FAILURES
  );

  res.setHeader(
    "X-RateLimit-Remaining",
    remaining
  );

  res.setHeader(
    "X-RateLimit-Reset",
    Math.ceil(
      bucket.resetAt / 1000
    )
  );

  return retryAfterSeconds;
}

function loginRateLimiter(
  req,
  res,
  next
) {
  const now = Date.now();

  const clientKey =
    getClientKey(req);

  const bucket =
    getActiveBucket(
      clientKey,
      now
    );

  const retryAfterSeconds =
    setRateLimitHeaders(
      res,
      bucket
    );

  if (
    bucket.failedAttempts >=
    LOGIN_RATE_LIMIT_MAX_FAILURES
  ) {
    res.setHeader(
      "Retry-After",
      retryAfterSeconds
    );

    return res
      .status(429)
      .json({
        success: false,

        error:
          "Too many login attempts.",

        message:
          "Too many failed login attempts. Please wait before trying again.",

        retryAfterSeconds,
      });
  }

  /*
   * Update the failure counter only after the login
   * controller finishes its response.
   *
   * 2xx:
   *   Valid login -> clear previous failures.
   *
   * 4xx:
   *   Invalid/rejected login -> count one failure.
   *
   * 5xx:
   *   Infrastructure/server problem -> do not punish
   *   the user by increasing the login failure count.
   */
  res.once(
    "finish",
    () => {
      const currentBucket =
        loginFailureStore.get(
          clientKey
        );

      if (!currentBucket) {
        return;
      }

      if (
        res.statusCode >= 200 &&
        res.statusCode < 300
      ) {
        loginFailureStore.delete(
          clientKey
        );

        return;
      }

      if (
        res.statusCode >= 400 &&
        res.statusCode < 500 &&
        res.statusCode !== 429
      ) {
        currentBucket.failedAttempts +=
          1;
      }
    }
  );

  return next();
}

/*
 * Periodically discard expired client entries so the
 * in-memory store cannot grow indefinitely.
 *
 * unref() prevents this cleanup timer from keeping
 * the Node.js process alive during shutdown.
 */
const loginRateLimitCleanupTimer =
  setInterval(
    () => {
      const now = Date.now();

      for (
        const [
          clientKey,
          bucket,
        ] of loginFailureStore.entries()
      ) {
        if (
          now >= bucket.resetAt
        ) {
          loginFailureStore.delete(
            clientKey
          );
        }
      }
    },
    LOGIN_RATE_LIMIT_WINDOW_MS
  );

loginRateLimitCleanupTimer.unref?.();

router.post(
  "/login",
  loginRateLimiter,
  login
);

module.exports = router;
