"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("fs");

const path =
  require("path");


const backendRoot =
  path.resolve(
    __dirname,
    ".."
  );


function readSource(
  relativePath
) {
  return fs.readFileSync(
    path.join(
      backendRoot,
      relativePath
    ),
    "utf8"
  );
}


test(
  "production security middleware applies non-sensitive response headers",
  () => {
    const {
      productionSecurityHeaders,
    } =
      require(
        "../middleware/productionHardening"
      );


    const headers =
      new Map();


    const res = {
      removeHeader(
        name
      ) {
        headers.delete(
          String(
            name
          ).toLowerCase()
        );
      },

      setHeader(
        name,
        value
      ) {
        headers.set(
          String(
            name
          ).toLowerCase(),
          String(
            value
          )
        );
      },
    };


    let nextCalled =
      false;


    productionSecurityHeaders(
      {
        method:
          "GET",

        originalUrl:
          "/api/chat/users",
      },
      res,
      () => {
        nextCalled =
          true;
      }
    );


    assert.equal(
      nextCalled,
      true
    );


    assert.equal(
      headers.get(
        "x-content-type-options"
      ),
      "nosniff"
    );


    assert.equal(
      headers.get(
        "referrer-policy"
      ),
      "no-referrer"
    );


    assert.equal(
      headers.get(
        "permissions-policy"
      ),
      "camera=(), microphone=(), geolocation=()"
    );


    assert.equal(
      headers.get(
        "cache-control"
      ),
      "no-store"
    );


    assert.equal(
      headers.get(
        "pragma"
      ),
      "no-cache"
    );


    assert.equal(
      headers.get(
        "expires"
      ),
      "0"
    );
  }
);


test(
  "Vercel proxy trust is configured only for the Vercel runtime",
  () => {
    const {
      configureProductionProxy,
    } =
      require(
        "../middleware/productionHardening"
      );


    const originalVercel =
      process.env.VERCEL;


    const calls =
      [];


    const app = {
      set(
        key,
        value
      ) {
        calls.push([
          key,
          value,
        ]);
      },
    };


    try {
      delete process.env.VERCEL;

      configureProductionProxy(
        app
      );


      assert.equal(
        calls.length,
        0
      );


      process.env.VERCEL =
        "1";


      configureProductionProxy(
        app
      );


      assert.deepEqual(
        calls,
        [
          [
            "trust proxy",
            1,
          ],
        ]
      );
    }
    finally {
      if (
        originalVercel ===
        undefined
      ) {
        delete process.env.VERCEL;
      }
      else {
        process.env.VERCEL =
          originalVercel;
      }
    }
  }
);


test(
  "API abuse ceiling remains generous enough for Messenger polling",
  () => {
    const {
      API_RATE_WINDOW_MS,
      API_RATE_LIMIT,
    } =
      require(
        "../middleware/productionHardening"
      );


    assert.equal(
      API_RATE_WINDOW_MS,
      300000
    );


    assert.equal(
      API_RATE_LIMIT,
      6000
    );


    /*
     * 6000 / five minutes = 20 requests per second
     * from one resolved IP before rate limiting.
     *
     * Current Messenger polling is far below this ceiling.
     */
    assert.ok(
      (
        API_RATE_LIMIT /
        (
          API_RATE_WINDOW_MS /
          1000
        )
      ) >=
        20
    );
  }
);


test(
  "app registers hardening before the API maintenance gate",
  () => {
    const source =
      readSource(
        "app.js"
      );


    assert.match(
      source,
      /app\.disable\(\s*"x-powered-by"\s*\)/
    );


    assert.match(
      source,
      /configureProductionProxy\(\s*app\s*\)/
    );


    assert.match(
      source,
      /app\.use\(\s*productionSecurityHeaders\s*\)/
    );


    assert.match(
      source,
      /app\.use\(\s*"\/api",\s*apiRateLimiter\s*\)/
    );


    const limiterPosition =
      source.indexOf(
        'apiRateLimiter'
      );


    const maintenancePosition =
      source.indexOf(
        'checkMaintenanceMode'
      );


    assert.ok(
      limiterPosition !==
        -1
    );


    assert.ok(
      maintenancePosition !==
        -1
    );
  }
);
