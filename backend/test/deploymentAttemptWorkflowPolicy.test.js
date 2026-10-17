const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const backendRoot = path.resolve(
  __dirname,
  ".."
);

const controllerPath = path.join(
  backendRoot,
  "controllers",
  "deploymentAttemptController.js"
);

const routesPath = path.join(
  backendRoot,
  "routes",
  "deploymentRoutes.js"
);

const migrationPath = path.join(
  backendRoot,
  "database",
  "add_employee_workforce_workflow.sql"
);

const controllerSource = fs.readFileSync(
  controllerPath,
  "utf8"
);

const routesSource = fs.readFileSync(
  routesPath,
  "utf8"
);

const migrationSource = fs.readFileSync(
  migrationPath,
  "utf8"
);

function normalizeWhitespace(value) {
  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value)
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
}

function getExportBlock(
  source,
  exportName
) {
  const marker =
    `exports.${exportName}`;

  const start =
    source.indexOf(marker);

  assert.notEqual(
    start,
    -1,
    `${exportName} export was not found`
  );

  const nextExport =
    source.indexOf(
      "\nexports.",
      start + marker.length
    );

  const testOnlyExport =
    source.indexOf(
      "\nif (",
      start + marker.length
    );

  const possibleEnds = [
    nextExport,
    testOnlyExport,
  ].filter(
    (value) => value > start
  );

  const end =
    possibleEnds.length > 0
      ? Math.min(
          ...possibleEnds
        )
      : source.length;

  return source.slice(
    start,
    end
  );
}

test(
  "deployment attempt route surface exposes the complete workflow",
  () => {
    const normalized =
      normalizeWhitespace(
        routesSource
      );

    assert.match(
      normalized,
      /router\.get\(\s*"\/deployment-attempts"/i
    );

    assert.match(
      normalized,
      /router\.post\(\s*"\/employees\/:employeeId\/deployment-attempts"/i
    );

    assert.match(
      normalized,
      /router\.patch\(\s*"\/deployment-attempts\/:attemptId\/confirm-arrival"/i
    );

    assert.match(
      normalized,
      /router\.patch\(\s*"\/deployment-attempts\/:attemptId\/no-show"/i
    );

    assert.match(
      normalized,
      /router\.patch\(\s*"\/deployment-attempts\/:attemptId\/withdraw"/i
    );
  }
);

test(
  "HR Staff owns scheduling and withdrawal while HR Coordinator owns arrival and No Show",
  () => {
    assert.match(
      routesSource,
      /"\/employees\/:employeeId\/deployment-attempts"[\s\S]*?authorizeRoles\(\s*"HR_STAFF"\s*\)[\s\S]*?createDeploymentAttempt/i
    );

    assert.match(
      routesSource,
      /"\/deployment-attempts\/:attemptId\/withdraw"[\s\S]*?authorizeRoles\(\s*"HR_STAFF"\s*\)[\s\S]*?withdrawDeploymentAttempt/i
    );

    assert.match(
      routesSource,
      /"\/deployment-attempts\/:attemptId\/confirm-arrival"[\s\S]*?authorizeRoles\(\s*"HR_COORDINATOR"\s*\)[\s\S]*?confirmDeploymentArrival/i
    );

    assert.match(
      routesSource,
      /"\/deployment-attempts\/:attemptId\/no-show"[\s\S]*?authorizeRoles\(\s*"HR_COORDINATOR"\s*\)[\s\S]*?markDeploymentNoShow/i
    );
  }
);

test(
  "deployment scheduling requires, stores, returns, and announces expected arrival time",
  () => {
    const createBlock =
      getExportBlock(
        controllerSource,
        "createDeploymentAttempt"
      );

    assert.match(
      createBlock,
      /req\?\.body\?\.scheduledTime[\s\S]*?req\?\.body\?\.scheduled_time/i
    );

    assert.match(
      createBlock,
      /A valid expected arrival time is required/i
    );

    assert.match(
      createBlock,
      /scheduled_time/i
    );

    assert.match(
      controllerSource,
      /DATE_FORMAT\(\s*da\.scheduled_time\s*,\s*'%H:%i'\s*\)\s+AS\s+scheduledTime/i
    );

    assert.match(
      createBlock,
      /on \$\{scheduledDate\} at \$\{scheduledTime\.slice\(0, 5\)\}/i
    );

    assert.match(
      createBlock,
      /scheduledTime:\s*scheduledTime\.slice\(/i
    );
  }
);

test(
  "attempt visibility includes governance roles and assigned-company coordinators",
  () => {
    assert.match(
      routesSource,
      /"\/deployment-attempts"[\s\S]*?authorizeRoles\([\s\S]*?"SUPER_ADMIN"[\s\S]*?"HR_MANAGER"[\s\S]*?"HR_STAFF"[\s\S]*?"HR_COORDINATOR"[\s\S]*?\)[\s\S]*?getDeploymentAttempts/i
    );

    const listBlock =
      getExportBlock(
        controllerSource,
        "getDeploymentAttempts"
      );

    assert.match(
      listBlock,
      /actor\.role\s*===\s*"HR_COORDINATOR"/i
    );

    assert.match(
      listBlock,
      /actor\.assignedCompany/i
    );

    assert.match(
      listBlock,
      /LOWER\(\s*TRIM\(da\.company\)\s*\)\s*=\s*LOWER\(\s*TRIM\(\?\)\s*\)/i
    );
  }
);

test(
  "new attempt contract uses For Deployment, Deployed, No Show, and Withdrawn only",
  () => {
    for (const status of [
      "For Deployment",
      "Deployed",
      "No Show",
      "Withdrawn",
    ]) {
      const pattern =
        new RegExp(
          escapeRegExp(status),
          "i"
        );

      assert.match(
        controllerSource,
        pattern
      );

      assert.match(
        migrationSource,
        pattern
      );
    }

    assert.doesNotMatch(
      migrationSource,
      /\bCancelled\b/i
    );
  }
);

test(
  "scheduling changes both canonical and legacy workforce status to For Deployment without creating an actual deployment assignment",
  () => {
    const createBlock =
      getExportBlock(
        controllerSource,
        "createDeploymentAttempt"
      );

    assert.match(
      createBlock,
      /INSERT INTO deployment_attempts/i
    );

    assert.match(
      createBlock,
      /workforce_status\s*=\s*'For Deployment'/i
    );

    assert.match(
      createBlock,
      /status\s*=\s*'For Deployment'/i
    );

    assert.doesNotMatch(
      createBlock,
      /INSERT INTO deployment_assignments/i
    );

    assert.match(
      createBlock,
      /SOURCE_EVENT\.SCHEDULED/i
    );
  }
);

test(
  "scheduling uses the locked Pooling designation as source of truth and only treats request placement as a consistency check",
  () => {
    const createBlock =
      getExportBlock(
        controllerSource,
        "createDeploymentAttempt"
      );

    assert.match(
      createBlock,
      /const\s+designatedCompany\s*=[\s\S]*?employee\.company/i
    );

    assert.match(
      createBlock,
      /const\s+designatedPosition\s*=[\s\S]*?employee\.position/i
    );

    assert.match(
      createBlock,
      /validateActiveCompanyAndPosition\([\s\S]*?designatedCompany[\s\S]*?designatedPosition/i
    );

    assert.match(
      createBlock,
      /requestedCompany[\s\S]*?designatedCompany[\s\S]*?Update the employee designation first/i
    );

    assert.match(
      createBlock,
      /requestedPosition[\s\S]*?designatedPosition[\s\S]*?Update the employee designation first/i
    );

    assert.match(
      createBlock,
      /INSERT INTO deployment_attempts[\s\S]*?company[\s\S]*?position[\s\S]*?scheduled_date/i
    );

    assert.match(
      createBlock,
      /masterData\.company[\s\S]*?masterData\.position/i
    );

    assert.doesNotMatch(
      createBlock,
      /INSERT INTO deployment_assignments/i
    );
  }
);

test(
  "arrival confirmation creates the real Active deployment assignment and moves workforce to Deployed",
  () => {
    const confirmBlock =
      getExportBlock(
        controllerSource,
        "confirmDeploymentArrival"
      );

    assert.match(
      confirmBlock,
      /INSERT INTO deployment_assignments/i
    );

    assert.match(
      confirmBlock,
      /'Active'/i
    );

    assert.match(
      confirmBlock,
      /actual_arrival_date\s*=\s*\?/i
    );

    assert.match(
      confirmBlock,
      /status\s*=\s*'Deployed'/i
    );

    assert.match(
      confirmBlock,
      /workforce_status\s*=\s*'Deployed'/i
    );

    assert.match(
      confirmBlock,
      /position\s*=\s*\?/i
    );

    assert.match(
      confirmBlock,
      /attempt\.position\s*\|\|\s*null/i
    );

    assert.match(
      confirmBlock,
      /deployment_assignment_id\s*=\s*\?/i
    );

    assert.match(
      confirmBlock,
      /SOURCE_EVENT\.ARRIVAL_CONFIRMED/i
    );
  }
);

test(
  "No Show returns both workforce fields to Floating / Standby and never creates actual deployment history",
  () => {
    const noShowBlock =
      getExportBlock(
        controllerSource,
        "markDeploymentNoShow"
      );

    assert.match(
      noShowBlock,
      /status\s*=\s*'No Show'/i
    );

    assert.match(
      noShowBlock,
      /workforce_status\s*=\s*'Floating \/ Standby'/i
    );

    assert.match(
      noShowBlock,
      /status\s*=\s*'Floating \/ Standby'/i
    );

    assert.doesNotMatch(
      noShowBlock,
      /INSERT INTO deployment_assignments/i
    );

    assert.doesNotMatch(
      noShowBlock,
      /company\s*=\s*NULL/i
    );

    assert.doesNotMatch(
      noShowBlock,
      /position\s*=\s*NULL/i
    );

    assert.match(
      noShowBlock,
      /SOURCE_EVENT\.NO_SHOW/i
    );
  }
);

test(
  "Withdrawn returns both workforce fields to Floating / Standby and never reuses legacy Cancelled",
  () => {
    const withdrawBlock =
      getExportBlock(
        controllerSource,
        "withdrawDeploymentAttempt"
      );

    assert.match(
      withdrawBlock,
      /status\s*=\s*'Withdrawn'/i
    );

    assert.match(
      withdrawBlock,
      /workforce_status\s*=\s*'Floating \/ Standby'/i
    );

    assert.match(
      withdrawBlock,
      /status\s*=\s*'Floating \/ Standby'/i
    );

    assert.doesNotMatch(
      withdrawBlock,
      /status\s*=\s*'Cancelled'/i
    );

    assert.doesNotMatch(
      withdrawBlock,
      /INSERT INTO deployment_assignments/i
    );

    assert.doesNotMatch(
      withdrawBlock,
      /company\s*=\s*NULL/i
    );

    assert.doesNotMatch(
      withdrawBlock,
      /position\s*=\s*NULL/i
    );

    assert.match(
      withdrawBlock,
      /SOURCE_EVENT\.WITHDRAWN/i
    );
  }
);

test(
  "all attempt mutations use transactions, commit, rollback, and row-lock helpers",
  () => {
    const mutationFunctions = [
      "createDeploymentAttempt",
      "confirmDeploymentArrival",
      "markDeploymentNoShow",
      "withdrawDeploymentAttempt",
    ];

    for (
      const functionName
      of mutationFunctions
    ) {
      const block =
        getExportBlock(
          controllerSource,
          functionName
        );

      assert.match(
        block,
        /beginTransaction\(\)/i,
        `${functionName} must begin a transaction`
      );

      assert.match(
        block,
        /commit\(\)/i,
        `${functionName} must commit`
      );

      assert.match(
        block,
        /safeRollback/i,
        `${functionName} must rollback on failure`
      );
    }

    assert.match(
      controllerSource,
      /FOR UPDATE/i
    );

    assert.match(
      controllerSource,
      /lockEmployeeThenAttempt/i
    );
  }
);

test(
  "Coordinator company scope is enforced again inside confirm-arrival and No Show controller mutations",
  () => {
    assert.match(
      controllerSource,
      /function coordinatorCanActOnAttempt/i
    );

    assert.match(
      controllerSource,
      /normalizeComparable\(\s*actor\.assignedCompany\s*\)\s*===\s*normalizeComparable\(\s*attempt\.company\s*\)/i
    );

    const confirmBlock =
      getExportBlock(
        controllerSource,
        "confirmDeploymentArrival"
      );

    const noShowBlock =
      getExportBlock(
        controllerSource,
        "markDeploymentNoShow"
      );

    assert.match(
      confirmBlock,
      /coordinatorCanActOnAttempt/i
    );

    assert.match(
      noShowBlock,
      /coordinatorCanActOnAttempt/i
    );
  }
);

test(
  "workforce transitions are written to employee_status_history with the four canonical workflow events",
  () => {
    assert.match(
      controllerSource,
      /INSERT INTO employee_status_history/i
    );

    assert.match(
      controllerSource,
      /SCHEDULED:\s*"DEPLOYMENT_ATTEMPT_CREATED"/i
    );

    assert.match(
      controllerSource,
      /ARRIVAL_CONFIRMED:\s*"DEPLOYMENT_ARRIVAL_CONFIRMED"/i
    );

    assert.match(
      controllerSource,
      /NO_SHOW:\s*"DEPLOYMENT_NO_SHOW"/i
    );

    assert.match(
      controllerSource,
      /WITHDRAWN:\s*"DEPLOYMENT_ATTEMPT_WITHDRAWN"/i
    );
  }
);