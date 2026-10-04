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
  "Messenger migration reproduces all seven required tables",
  () => {
    const sql =
      readSource(
        "database/add_chat_messenger_schema.sql"
      );


    const tables = [
      "chat_conversations",
      "chat_messages",
      "chat_groups",
      "chat_group_members",
      "chat_group_messages",
      "chat_group_audit",
      "chat_attachments",
    ];


    for (
      const table of
      tables
    ) {
      assert.match(
        sql,
        new RegExp(
          `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`,
          "i"
        )
      );
    }


    assert.match(
      sql,
      /UNIQUE\s+KEY\s+uq_chat_pair/i
    );


    assert.match(
      sql,
      /PRIMARY\s+KEY\s*\(\s*group_id\s*,\s*user_id\s*\)/i
    );


    assert.match(
      sql,
      /UNIQUE\s+KEY\s+uq_chat_attachment_storage/i
    );
  }
);


test(
  "Migration runner registers Messenger migration with adoption verification",
  () => {
    const source =
      readSource(
        "scripts/migrateDatabase.cjs"
      );


    assert.match(
      source,
      /name:\s*"add_chat_messenger_schema\.sql"/
    );


    assert.match(
      source,
      /isApplied:\s*chatMessengerSchemaIsApplied/
    );


    assert.match(
      source,
      /canAdopt:\s*chatMessengerSchemaIsApplied/
    );


    assert.match(
      source,
      /verifyApplied:\s*chatMessengerSchemaIsApplied/
    );


    assert.match(
      source,
      /async function chatMessengerSchemaIsApplied\s*\(/
    );
  }
);


test(
  "Fresh setup requires all Messenger tables and migration #15",
  () => {
    const source =
      readSource(
        "scripts/setupDatabase.cjs"
      );


    const required = [
      "chat_conversations",
      "chat_messages",
      "chat_groups",
      "chat_group_members",
      "chat_group_messages",
      "chat_group_audit",
      "chat_attachments",
      "add_chat_messenger_schema.sql",
    ];


    for (
      const value of
      required
    ) {
      assert.match(
        source,
        new RegExp(
          `"${value.replace(
            /[.*+?^$\{\}()|[\]\\]/g,
            "\\$&"
          )}"`
        )
      );
    }
  }
);


test(
  "Current authentication audit paths retain canonical users.id",
  () => {
    const auth =
      readSource(
        "controllers/authController.js"
      );


    const canonicalActors =
      auth.match(
        /userId:\s*user\.id/g
      ) ||
      [];


    assert.ok(
      canonicalActors.length >=
        3
    );


    assert.match(
      auth,
      /userId:\s*null[\s\S]{0,500}action:\s*"LOGIN_FAILED"/
    );


    assert.match(
      auth,
      /userId:\s*user\.id[\s\S]{0,500}action:\s*"Login Success"/
    );
  }
);
