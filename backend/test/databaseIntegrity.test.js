"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("fs");

const path =
  require("path");

const {
  MIGRATION_NAMES,
} = require(
  "../scripts/migrateDatabase.cjs"
);


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
  "Incident evidence purpose migration preserves legacy proof semantics",
  () => {
    const baseline = readSource("database/baseline.sql");
    const migration = readSource(
      "database/add_incident_evidence_purpose.sql"
    );
    const runner = readSource("scripts/migrateDatabase.cjs");
    const setup = readSource("scripts/setupDatabase.cjs");

    for (const source of [baseline, migration]) {
      assert.match(source, /evidence_purpose/i);
      assert.match(source, /INITIAL_NTE/);
      assert.match(source, /RESOLUTION_PROOF/);
    }
    assert.match(
      baseline,
      /DEFAULT\s+'RESOLUTION_PROOF'/i
    );
    assert.match(
      migration,
      /DEFAULT\s+''RESOLUTION_PROOF''/i
    );
    assert.doesNotMatch(migration, /UPDATE\s+incident_evidence/i);
    assert.match(
      runner,
      /name:\s*"add_incident_evidence_purpose\.sql"/
    );
    assert.match(
      setup,
      /EXPECTED_MIGRATIONS\s*=\s*MIGRATION_NAMES/
    );

    assert.ok(
      MIGRATION_NAMES.includes(
        "add_incident_evidence_purpose.sql"
      )
    );
  }
);

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

    assert.ok(
      MIGRATION_NAMES.includes(
        "add_chat_messenger_schema.sql"
      )
    );
  }
);


test(
  "Setup derives its complete migration ledger from the runner registry",
  () => {
    const setup = readSource(
      "scripts/setupDatabase.cjs"
    );

    assert.equal(
      MIGRATION_NAMES.length,
      24
    );

    assert.equal(
      new Set(
        MIGRATION_NAMES
      ).size,
      MIGRATION_NAMES.length
    );

    for (
      const migrationName of
        MIGRATION_NAMES
    ) {
      assert.equal(
        fs.existsSync(
          path.join(
            backendRoot,
            "database",
            migrationName
          )
        ),
        true,
        `Missing migration file: ${migrationName}`
      );
    }

    assert.match(
      setup,
      /require\(\s*"\.\/migrateDatabase\.cjs"\s*\)/
    );

    assert.doesNotMatch(
      setup,
      /const\s+EXPECTED_MIGRATIONS\s*=\s*\[/
    );
  }
);


test(
  "Fresh setup includes runtime-required deployment time and phone-capture schema",
  () => {
    const baseline = readSource(
      "database/baseline.sql"
    );

    const runner = readSource(
      "scripts/migrateDatabase.cjs"
    );

    const setup = readSource(
      "scripts/setupDatabase.cjs"
    );

    assert.match(
      baseline,
      /scheduled_time\s+TIME\s+DEFAULT\s+NULL/i
    );

    assert.match(
      baseline,
      /CREATE TABLE IF NOT EXISTS\s+incident_phone_capture_sessions/i
    );

    for (
      const migrationName of
        [
          "add_deployment_attempts_scheduled_time.sql",
          "add_incident_phone_capture_sessions.sql",
        ]
    ) {
      assert.ok(
        MIGRATION_NAMES.includes(
          migrationName
        )
      );

      assert.match(
        runner,
        new RegExp(
          migrationName.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )
        )
      );
    }

    for (
      const tableName of
        [
          "employee_mobile_handoffs",
          "employee_employment_history",
          "deployment_attempts",
          "incident_phone_capture_sessions",
        ]
    ) {
      assert.match(
        setup,
        new RegExp(
          `"${tableName}"`
        )
      );
    }

    assert.match(
      runner,
      /SELECT DATABASE\(\) AS database_name/
    );

    assert.match(
      runner,
      /requiredEnv\(\s*"DB_EXPECTED_NAME"\s*\)/
    );

    assert.match(
      runner,
      /DB_REQUIRE_SSL requires DB_SSL_CA_BASE64/
    );

    assert.match(
      runner,
      /COALESCE\(DATETIME_PRECISION, 0\) = 0/
    );

    assert.match(
      runner,
      /createdDefinition[\s\S]{0,500}current_timestamp/
    );

    assert.match(
      runner,
      /updatedDefinition[\s\S]{0,800}on update current_timestamp/
    );

    assert.match(
      setup,
      /DB_REQUIRE_EXISTING/
    );

    assert.match(
      setup,
      /SELECT DATABASE\(\) AS database_name/
    );

    assert.match(
      setup,
      /requiredEnv\(\s*"DB_EXPECTED_NAME"\s*\)/
    );

    assert.match(
      setup,
      /DB_REQUIRE_SSL requires DB_SSL_CA_BASE64/
    );
  }
);


test(
  "Fresh deployment-attempt schema keeps the generated-column employee foreign key restrictive",
  () => {
    const baseline = readSource(
      "database/baseline.sql"
    );

    const workflowMigration =
      readSource(
        "database/add_employee_workforce_workflow.sql"
      );

    const expectedConstraint =
      /CONSTRAINT\s+fk_deployment_attempts_employee[\s\S]{0,220}REFERENCES\s+employees\s*\(\s*id\s*\)[\s\S]{0,220}ON\s+UPDATE\s+RESTRICT[\s\S]{0,120}ON\s+DELETE\s+RESTRICT/i;

    assert.match(
      baseline,
      expectedConstraint
    );

    assert.match(
      workflowMigration,
      expectedConstraint
    );
  }
);


test(
  "Fresh setup and migration registry include the user avatar column required by runtime queries",
  () => {
    const baseline = readSource(
      "database/baseline.sql"
    );
    const migration = readSource(
      "database/add_users_avatar_filename.sql"
    );

    assert.match(
      baseline,
      /avatar_filename\s+VARCHAR\(255\)\s+DEFAULT\s+NULL/i
    );
    assert.match(
      migration,
      /ALTER TABLE\s+users[\s\S]*ADD COLUMN\s+avatar_filename/i
    );
    assert.ok(
      MIGRATION_NAMES.includes(
        "add_users_avatar_filename.sql"
      )
    );
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
