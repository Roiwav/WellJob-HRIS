"use strict";

const {
  rateLimit,
} =
  require(
    "express-rate-limit"
  );


/*
 * ================================================================
 * WELLJOB PRODUCTION HARDENING
 * ================================================================
 *
 * These controls are intentionally API-safe:
 *
 * - remove framework fingerprinting
 * - prevent MIME sniffing
 * - suppress referrer leakage
 * - disable unused browser capabilities
 * - prevent caching of HR/API responses
 * - apply a generous abuse ceiling to /api
 * - trust the Vercel reverse proxy only when actually on Vercel
 *
 * The API limiter is deliberately generous because Messenger uses
 * authenticated REST polling. It is an abuse ceiling, not a normal
 * user throttling mechanism.
 */


const API_RATE_WINDOW_MS =
  5 *
  60 *
  1000;


const API_RATE_LIMIT =
  6000;


/*
 * ================================================================
 * PROXY CONFIGURATION
 * ================================================================
 */

function configureProductionProxy(
  app
) {
  if (
    !app ||
    typeof app.set !==
      "function"
  ) {
    throw new TypeError(
      "A valid Express application is required."
    );
  }


  /*
   * Vercel terminates HTTPS and forwards the original client.
   * One trusted proxy hop allows Express / express-rate-limit to
   * resolve the forwarded client IP correctly.
   *
   * Local development remains on Express' default trust setting.
   */
  if (
    String(
      process.env.VERCEL ||
      ""
    ).trim() ===
    "1"
  ) {
    app.set(
      "trust proxy",
      1
    );
  }
}


/*
 * ================================================================
 * RESPONSE SECURITY HEADERS
 * ================================================================
 */

function productionSecurityHeaders(
  req,
  res,
  next
) {
  /*
   * Do not advertise Express to remote clients.
   *
   * app.disable("x-powered-by") is also configured in app.js.
   * removeHeader() here provides defense-in-depth.
   */
  res.removeHeader(
    "X-Powered-By"
  );


  /*
   * Prevent browsers from MIME-sniffing API/file responses.
   */
  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );


  /*
   * WELLJOB API requests do not require Referrer information.
   * Avoid leaking internal frontend paths to downstream resources.
   */
  res.setHeader(
    "Referrer-Policy",
    "no-referrer"
  );


  /*
   * The backend API does not require these browser capabilities.
   */
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );


  /*
   * HR, incident, employee, KPI, audit, Messenger and user data
   * must not be stored by shared browser/proxy caches.
   *
   * This backend serves API/data responses rather than immutable
   * public static assets, so no-store is safe for the application.
   */
  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  res.setHeader(
    "Pragma",
    "no-cache"
  );

  res.setHeader(
    "Expires",
    "0"
  );


  return next();
}


/*
 * ================================================================
 * API ABUSE CEILING
 * ================================================================
 */

const apiRateLimiter =
  rateLimit({
    windowMs:
      API_RATE_WINDOW_MS,

    limit:
      API_RATE_LIMIT,

    /*
     * Modern standardized RateLimit response metadata.
     */
    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    /*
     * Browser CORS negotiation must not consume the application
     * request budget.
     */
    skip(
      req
    ) {
      return (
        String(
          req.method ||
          ""
        ).toUpperCase() ===
        "OPTIONS"
      );
    },

    /*
     * Fail closed with a stable non-sensitive response.
     */
    handler(
      req,
      res
    ) {
      return res
        .status(429)
        .json({
          success:
            false,

          error:
            "Too many requests.",

          message:
            "Please wait briefly and try again.",
        });
    },
  });


module.exports = {
  API_RATE_WINDOW_MS,
  API_RATE_LIMIT,

  configureProductionProxy,
  productionSecurityHeaders,
  apiRateLimiter,
};
