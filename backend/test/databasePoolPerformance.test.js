"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("fs");

const path =
  require("path");

const vm =
  require("vm");


const dbPath =
  path.resolve(
    __dirname,
    "../config/db.js"
  );


function extractGetConnectionLimit() {
  const source =
    fs.readFileSync(
      dbPath,
      "utf8"
    );


  const start =
    source.indexOf(
      "function getConnectionLimit()"
    );


  const end =
    source.indexOf(
      "\n\n\nconst connectionLimit",
      start
    );


  assert.ok(
    start >= 0,
    "getConnectionLimit() was not found."
  );


  assert.ok(
    end > start,
    "Unable to isolate getConnectionLimit()."
  );


  const functionSource =
    source.slice(
      start,
      end
    );


  const context = {
    process: {
      env: {},
    },
  };


  vm.createContext(
    context
  );


  vm.runInContext(
    `${functionSource}
this.getConnectionLimit = getConnectionLimit;`,
    context
  );


  return {
    getConnectionLimit:
      context.getConnectionLimit,

    env:
      context.process.env,
  };
}


test(
  "persistent runtime keeps historical pool default of 10",
  () => {
    const {
      getConnectionLimit,
      env,
    } =
      extractGetConnectionLimit();


    delete env.VERCEL;
    delete env.DB_CONNECTION_LIMIT;


    assert.equal(
      getConnectionLimit(),
      10
    );
  }
);


test(
  "Vercel runtime defaults to conservative pool limit of 4",
  () => {
    const {
      getConnectionLimit,
      env,
    } =
      extractGetConnectionLimit();


    env.VERCEL =
      "1";

    delete env.DB_CONNECTION_LIMIT;


    assert.equal(
      getConnectionLimit(),
      4
    );
  }
);


test(
  "explicit DB_CONNECTION_LIMIT overrides Vercel fallback",
  () => {
    const {
      getConnectionLimit,
      env,
    } =
      extractGetConnectionLimit();


    env.VERCEL =
      "1";

    env.DB_CONNECTION_LIMIT =
      "6";


    assert.equal(
      getConnectionLimit(),
      6
    );
  }
);


test(
  "invalid explicit connection limits fail closed",
  () => {
    const invalidValues = [
      "0",
      "-1",
      "101",
      "abc",
    ];


    for (
      const value of
      invalidValues
    ) {
      const {
        getConnectionLimit,
        env,
      } =
        extractGetConnectionLimit();


      env.VERCEL =
        "1";

      env.DB_CONNECTION_LIMIT =
        value;


      assert.throws(
        () =>
          getConnectionLimit(),
        /DB_CONNECTION_LIMIT must be an integer between 1 and 100/
      );
    }
  }
);
