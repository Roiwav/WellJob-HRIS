const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const BACKEND_ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(
    path.join(BACKEND_ROOT, relativePath),
    "utf8"
  );
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "");
}

const migrationSql = read(
  "database/add_employee_workforce_workflow.sql"
);

const baselineSql = read(
  "database/baseline.sql"
);

const migrationRunner = read(
  "scripts/migrateDatabase.cjs"
);

test(
  "workflow migration adds canonical employee state columns without removing legacy status",
  () => {
    assert.match(
      migrationSql,
      /ADD COLUMN\s+date_hired\s+DATE\s+NULL/i
    );

    assert.match(
      migrationSql,
      /ADD COLUMN\s+position\s+VARCHAR\(150\)\s+NULL/i
    );

    assert.match(
      migrationSql,
      /ADD COLUMN\s+employment_status\s+VARCHAR\(30\)\s+NULL/i
    );

    assert.match(
      migrationSql,
      /ADD COLUMN\s+workforce_status\s+VARCHAR\(30\)\s+NULL/i
    );

    assert.match(
      migrationSql,
      /idx_employees_date_hired/i
    );

    assert.match(
      migrationSql,
      /idx_employees_company_position/i
    );

    assert.match(
      migrationSql,
      /idx_employees_employment_status/i
    );

    assert.match(
      migrationSql,
      /idx_employees_workforce_status/i
    );

    assert.doesNotMatch(
      migrationSql,
      /DROP\s+COLUMN\s+status/i
    );

    assert.doesNotMatch(
      migrationSql,
      /RENAME\s+COLUMN\s+status/i
    );
  }
);

test(
  "workflow migration never fabricates Date Hired from deployment or contract dates",
  () => {
    const sqlWithoutComments =
      stripSqlComments(migrationSql);

    assert.doesNotMatch(
      sqlWithoutComments,
      /SET\s+date_hired\s*=/i
    );

    assert.doesNotMatch(
      sqlWithoutComments,
      /date_hired[\s\S]{0,200}contractStart/i
    );

    assert.doesNotMatch(
      sqlWithoutComments,
      /date_hired[\s\S]{0,200}start_date/i
    );
  }
);

test(
  "legacy active workforce rows receive only deterministic canonical backfill",
  () => {
    assert.match(
      migrationSql,
      /SET\s+workforce_status\s*=\s*'Deployed'[\s\S]*?LOWER\(TRIM\(COALESCE\(status,\s*''\)\)\)\s*=\s*'deployed'/i
    );

    assert.match(
      migrationSql,
      /SET\s+workforce_status\s*=\s*'Floating \/ Standby'[\s\S]*?'floating\/standby'[\s\S]*?'floating'[\s\S]*?'standby'/i
    );

    assert.match(
      migrationSql,
      /SET\s+employment_status\s*=\s*'Active'[\s\S]*?workforce_status\s+IN\s*\([\s\S]*?'Deployed'[\s\S]*?'Floating \/ Standby'/i
    );

    const sqlWithoutComments =
      stripSqlComments(migrationSql);

    assert.doesNotMatch(
      sqlWithoutComments,
      /status[\s\S]{0,120}inactive[\s\S]{0,120}employment_status/i
    );

    assert.doesNotMatch(
      sqlWithoutComments,
      /employment_status[\s\S]{0,120}(Resigned|Terminated)[\s\S]{0,120}inactive/i
    );
  }
);

test(
  "Pooling designation adds employee-level position and backfills only real active deployed positions",
  () => {
    assert.match(
      migrationSql,
      /ADD COLUMN\s+position\s+VARCHAR\(150\)\s+NULL\s+AFTER\s+company/i
    );

    assert.match(
      migrationSql,
      /ADD KEY\s+idx_employees_company_position\s*\(\s*company\s*,\s*position\s*\)/i
    );

    assert.match(
      migrationSql,
      /UPDATE\s+employees\s+AS\s+e[\s\S]*?INNER JOIN\s+deployment_assignments\s+AS\s+da[\s\S]*?da\.employee_id\s*=\s*e\.id[\s\S]*?da\.status\s*=\s*'Active'[\s\S]*?SET\s+e\.position\s*=\s*da\.position/i
    );

    assert.match(
      migrationSql,
      /WHERE\s+e\.position\s+IS\s+NULL[\s\S]*?da\.position\s+IS\s+NOT\s+NULL[\s\S]*?TRIM\(da\.position\)\s*<>\s*''[\s\S]*?e\.workforce_status\s*=\s*'Deployed'/i
    );

    const sqlWithoutComments =
      stripSqlComments(migrationSql);

    assert.doesNotMatch(
      sqlWithoutComments,
      /SET\s+e\.position\s*=\s*da\.position[\s\S]{0,300}Floating\s*\/\s*Standby/i
    );

    assert.doesNotMatch(
      sqlWithoutComments,
      /UPDATE\s+employees[\s\S]{0,250}SET[\s\S]{0,120}position\s*=\s*['"][^'"]+['"]/i
    );
  }
);

test(
  "existing deployment and workforce history tables are preserved rather than rewritten",
  () => {
    const sqlWithoutComments =
      stripSqlComments(migrationSql);

    assert.doesNotMatch(
      sqlWithoutComments,
      /ALTER\s+TABLE\s+deployment_assignments/i
    );

    assert.doesNotMatch(
      sqlWithoutComments,
      /UPDATE\s+deployment_assignments/i
    );

    assert.doesNotMatch(
      sqlWithoutComments,
      /DELETE\s+FROM\s+deployment_assignments/i
    );

    assert.doesNotMatch(
      sqlWithoutComments,
      /ALTER\s+TABLE\s+employee_status_history/i
    );

    assert.doesNotMatch(
      sqlWithoutComments,
      /UPDATE\s+employee_status_history/i
    );

    assert.doesNotMatch(
      sqlWithoutComments,
      /DELETE\s+FROM\s+employee_status_history/i
    );
  }
);

test(
  "employment history is separated from workforce status history",
  () => {
    assert.match(
      migrationSql,
      /CREATE TABLE\s+employee_employment_history/i
    );

    assert.match(
      migrationSql,
      /from_status\s+VARCHAR\(30\)/i
    );

    assert.match(
      migrationSql,
      /to_status\s+VARCHAR\(30\)\s+NOT NULL/i
    );

    assert.match(
      migrationSql,
      /source_event\s+VARCHAR\(50\)\s+NOT NULL/i
    );

    assert.match(
      migrationSql,
      /CONSTRAINT\s+fk_employee_employment_history_employee[\s\S]*?REFERENCES\s+employees\(id\)[\s\S]*?ON DELETE RESTRICT/i
    );

    assert.match(
      migrationSql,
      /CONSTRAINT\s+fk_employee_employment_history_changed_by[\s\S]*?REFERENCES\s+users\(id\)[\s\S]*?ON DELETE SET NULL/i
    );
  }
);

test(
  "deployment attempts keep scheduling separate from actual deployment history and use Withdrawn instead of Cancelled",
  () => {
    assert.match(
      migrationSql,
      /CREATE TABLE\s+deployment_attempts/i
    );

    assert.match(
      migrationSql,
      /scheduled_date\s+DATE\s+NOT NULL/i
    );

    assert.match(
      migrationSql,
      /actual_arrival_date\s+DATE\s+DEFAULT NULL/i
    );

    assert.match(
      migrationSql,
      /status\s+VARCHAR\(30\)\s+NOT NULL\s+DEFAULT\s+'For Deployment'/i
    );

    assert.match(
      migrationSql,
      /\bWithdrawn\b/i
    );

    assert.doesNotMatch(
      migrationSql,
      /\bCancelled\b/i
    );

    assert.match(
      migrationSql,
      /deployment_assignment_id\s+INT\s+DEFAULT NULL/i
    );

    assert.match(
      migrationSql,
      /pending_employee_id_guard\s+INT[\s\S]*?GENERATED ALWAYS AS[\s\S]*?WHEN status = 'For Deployment'[\s\S]*?THEN employee_id[\s\S]*?ELSE NULL[\s\S]*?STORED/i
    );

    assert.match(
      migrationSql,
      /UNIQUE KEY\s+uq_deployment_attempts_one_pending_employee\s*\(\s*pending_employee_id_guard\s*\)/i
    );

    assert.match(
      migrationSql,
      /UNIQUE KEY\s+uq_deployment_attempts_assignment\s*\(\s*deployment_assignment_id\s*\)/i
    );

    assert.match(
      migrationSql,
      /CONSTRAINT\s+fk_deployment_attempts_assignment[\s\S]*?REFERENCES\s+deployment_assignments\(id\)[\s\S]*?ON DELETE SET NULL/i
    );
  }
);

test(
  "fresh-install baseline contains the workflow schema but no data migration statements",
  () => {
    assert.match(
      baselineSql,
      /date_hired\s+DATE\s+DEFAULT NULL/i
    );

    assert.match(
      baselineSql,
      /position\s+VARCHAR\(150\)\s+DEFAULT NULL/i
    );

    assert.match(
      baselineSql,
      /idx_employees_company_position/i
    );

    assert.match(
      baselineSql,
      /Floating \/ Standby \(Pooling\)/i
    );

    assert.match(
      baselineSql,
      /designation is retained/i
    );

    assert.match(
      baselineSql,
      /employment_status\s+VARCHAR\(30\)\s+DEFAULT NULL/i
    );

    assert.match(
      baselineSql,
      /workforce_status\s+VARCHAR\(30\)\s+DEFAULT NULL/i
    );

    assert.match(
      baselineSql,
      /CREATE TABLE IF NOT EXISTS\s+deployment_attempts/i
    );

    assert.match(
      baselineSql,
      /\bWithdrawn\b/i
    );

    assert.match(
      baselineSql,
      /CREATE TABLE IF NOT EXISTS\s+employee_status_history/i
    );

    assert.match(
      baselineSql,
      /CREATE TABLE IF NOT EXISTS\s+employee_employment_history/i
    );

    const baselineWithoutComments =
      stripSqlComments(baselineSql);

    assert.doesNotMatch(
      baselineWithoutComments,
      /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|DROP)\b/im
    );
  }
);

test(
  "migration runner registers and fail-closed verifies the employee workflow migration",
  () => {
    assert.match(
      migrationRunner,
      /name:\s*"add_employee_workforce_workflow\.sql"/
    );

    assert.match(
      migrationRunner,
      /employeeWorkforceWorkflowSchemaIsApplied/
    );

    assert.match(
      migrationRunner,
      /employeeWorkforceWorkflowFullStateIsApplied/
    );

    assert.match(
      migrationRunner,
      /employeeWorkforceWorkflowPreflight/
    );

    assert.match(
      migrationRunner,
      /employeeEmploymentHistorySchemaIsApplied/
    );

    assert.match(
      migrationRunner,
      /deploymentAttemptSchemaIsApplied/
    );

    assert.match(
      migrationRunner,
      /uq_deployment_attempts_one_pending_employee/
    );

    assert.match(
      migrationRunner,
      /pending_employee_id_guard/
    );

    assert.match(
      migrationRunner,
      /employee_status_history/
    );

    assert.match(
      migrationRunner,
      /deployment_assignments/
    );
  }
);