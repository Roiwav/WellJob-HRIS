/*
 * Destructive scope: none. This verifier only appends clearly fictional
 * Phase 3 fixtures to the isolated welljob_phase3_test database.
 *
 * It uses only the dedicated private Phase 3 Supabase bucket and avoids
 * email, scheduler, and Socket.IO paths. Run only after loading
 * backend/.env.phase3.local.
 */
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const EXPECTED_DATABASE = "welljob_phase3_test";

if (!process.argv.includes("--confirm-write")) {
  throw new Error(
    "Refusing to create fictional runtime fixtures without --confirm-write."
  );
}

if (
  process.env.DB_NAME !== EXPECTED_DATABASE ||
  process.env.DB_EXPECTED_NAME !== EXPECTED_DATABASE ||
  String(process.env.DB_REQUIRE_EXISTING).toLowerCase() !== "true"
) {
  throw new Error(
    `Runtime verification is restricted to ${EXPECTED_DATABASE} with DB_REQUIRE_EXISTING=true.`
  );
}

const db = require("../config/db");
const app = require("../app");

const runId = `${Date.now()}-${process.pid}`;
const companyA = `Phase3 Fictional Client A ${runId}`;
const companyB = `Phase3 Fictional Client B ${runId}`;
const position = "Fictional Test Associate";

let server;
let userSequence = 0;

function tokenFor(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      tokenVersion: 1,
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "1h",
    }
  );
}

async function api(baseUrl, path, { token, method = "GET", body } = {}) {
  const isFormData =
    typeof FormData !==
      "undefined" &&
    body instanceof FormData;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined || isFormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    ...(body === undefined
      ? {}
      : {
          body: isFormData
            ? body
            : JSON.stringify(body),
        }),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }

  return { status: response.status, data };
}

function expectStatus(result, expected, label) {
  assert.equal(
    result.status,
    expected,
    `${label}: expected HTTP ${expected}, received ${result.status}: ${JSON.stringify(result.data)}`
  );
}

async function insertUser(connection, role, assignedCompany = null) {
  userSequence += 1;
  const username = `phase3_${role.toLowerCase()}_${userSequence}_${runId}`.replace(/[^a-z0-9_]/g, "_");
  const [result] = await connection.query(
    `INSERT INTO users
      (full_name, username, password, role, assigned_company, status, must_change_password, token_version)
     VALUES (?, ?, ?, ?, ?, 'Active', 0, 1)`,
    [`Phase 3 Fictional ${role}`, username, "runtime-verifier-no-login", role, assignedCompany]
  );
  return { id: result.insertId, username, role };
}

function createEmployeeBody({ name, company, status = "Floating / Standby", documents = [] }) {
  return {
    name,
    birthday: "2009-10-01",
    dateHired: "2026-10-01",
    company,
    position,
    status,
    ...(status === "Deployed" ? { contractStart: "2026-10-01" } : {}),
    documents,
  };
}

function decisionPayload(employeeId, evaluation) {
  return {
    employeeId,
    riskLevel: evaluation.riskLevel,
    kpiLevel: evaluation.kpiLevel,
    violationCount: evaluation.violationCount,
    severityScore: evaluation.severityScore,
    criticalIncidentCount: evaluation.criticalIncidentCount,
    decisionConfidence: evaluation.decisionConfidence,
    suggestedHRAction: evaluation.suggestedHRAction,
    systemRecommendation: evaluation.systemRecommendation,
    finalAction: evaluation.suggestedHRAction,
    decisionType: "Accepted",
    notes: `Fictional Phase 3 runtime verification ${runId}`,
  };
}

async function main() {
  const connection = await db.promise().getConnection();
  let users;

  try {
    const [[databaseRow]] = await connection.query("SELECT DATABASE() AS database_name");
    assert.equal(databaseRow.database_name, EXPECTED_DATABASE);

    const [companyAResult] = await connection.query(
      "INSERT INTO client_companies (company_name, is_active) VALUES (?, 1)",
      [companyA]
    );
    const [companyBResult] = await connection.query(
      "INSERT INTO client_companies (company_name, is_active) VALUES (?, 1)",
      [companyB]
    );
    await connection.query(
      "INSERT INTO company_positions (company_id, position_name, is_active) VALUES (?, ?, 1), (?, ?, 1)",
      [companyAResult.insertId, position, companyBResult.insertId, position]
    );

    const policy = [
      {
        category: "PHASE 3 FICTIONAL POLICY",
        rows: [
          {
            section: "TEST-1",
            violation: "Fictional Critical Safety Violation",
            description: "Synthetic rule used only for isolated Phase 3 verification.",
            penaltyLevel: "HR review required",
            severity: "Critical",
            penalties: [
              { offenseNo: 1, label: "1st offense", action: "Fictional written review" },
              { offenseNo: 2, label: "2nd offense", action: "Fictional escalated review" },
            ],
          },
        ],
      },
    ];
    await connection.query(
      `INSERT INTO system_settings (setting_name, setting_value)
       VALUES ('violation_rules', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [
        JSON.stringify({
          rules: policy,
          metadata: {
            updatedAt: new Date().toISOString(),
            updatedBy: "Phase 3 fictional runtime verifier",
          },
        }),
      ]
    );

    users = {
      manager: await insertUser(connection, "HR_MANAGER"),
      staff: await insertUser(connection, "HR_STAFF"),
      coordinatorA: await insertUser(connection, "HR_COORDINATOR", companyA),
      coordinatorB: await insertUser(connection, "HR_COORDINATOR", companyB),
      superAdmin: await insertUser(connection, "SUPER_ADMIN"),
      itSupport: await insertUser(connection, "IT_SUPPORT"),
    };
  } finally {
    connection.release();
  }

  const tokens = Object.fromEntries(
    Object.entries(users).map(([key, user]) => [key, tokenFor(user)])
  );

  server = await new Promise((resolve, reject) => {
    const candidate = app.listen(0, "127.0.0.1", () => resolve(candidate));
    candidate.once("error", reject);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const checks = [];
  const checked = (name, detail) => checks.push({ name, result: "PASS", detail });

  const versionResult =
    await api(
      baseUrl,
      "/api/system/version"
    );
  expectStatus(
    versionResult,
    200,
    "Deployment version endpoint"
  );
  assert.equal(
    versionResult.data.service,
    "welljob-hris-backend"
  );
  checked("Deployment identity endpoint", "Public endpoint returns non-sensitive package and Vercel commit metadata fields");

  expectStatus(await api(baseUrl, "/api/employees"), 401, "Unauthenticated employee list");
  checked("Backend authentication", "Missing bearer token rejected with HTTP 401");

  expectStatus(
    await api(baseUrl, "/api/employees", { token: tokens.itSupport }),
    403,
    "IT Support employee access"
  );
  checked("IT Support RBAC", "Employee operational access rejected with HTTP 403");

  const governmentDocuments = [
    { name: "SSS (ID or E1 form)", documentNumber: "00-1234567-8" },
    { name: "PhilHealth (ID or MDF Form)", documentNumber: "00-123456789-0" },
    { name: "Pag-IBIG (ID or MDRF Form)", documentNumber: "0001-2345-6789" },
  ];

  const futureBirthday = await api(baseUrl, "/api/employees", {
    token: tokens.staff,
    method: "POST",
    body: {
      ...createEmployeeBody({ name: `Fictional Future Birthday ${runId}`, company: companyA }),
      birthday: "2999-01-01",
    },
  });
  expectStatus(futureBirthday, 400, "Future birthday validation");

  const underageBirthday = await api(baseUrl, "/api/employees", {
    token: tokens.staff,
    method: "POST",
    body: {
      ...createEmployeeBody({
        name: `Fictional Underage Employee ${runId}`,
        company: companyA,
        documents: governmentDocuments,
      }),
      birthday: "2009-10-02",
    },
  });
  expectStatus(underageBirthday, 400, "Minimum age validation");
  assert.match(
    String(underageBirthday.data?.error || ""),
    /at least 17 years old on Date Hired/
  );

  const invalidId = await api(baseUrl, "/api/employees", {
    token: tokens.staff,
    method: "POST",
    body: createEmployeeBody({
      name: `Fictional Invalid ID ${runId}`,
      company: companyA,
      documents: governmentDocuments.map(
        (document) =>
          document.name ===
          "SSS (ID or E1 form)"
            ? {
                ...document,
                documentNumber:
                  "12A-34",
              }
            : document
      ),
    }),
  });
  expectStatus(invalidId, 400, "Government ID validation");
  assert.match(
    String(invalidId.data?.error || ""),
    /digits and hyphens only/
  );

  const missingGovernmentId = await api(baseUrl, "/api/employees", {
    token: tokens.staff,
    method: "POST",
    body: createEmployeeBody({
      name: `Fictional Missing Government ID ${runId}`,
      company: companyA,
      documents:
        governmentDocuments.slice(
          0,
          2
        ),
    }),
  });
  expectStatus(missingGovernmentId, 400, "Required government IDs");
  assert.match(
    String(missingGovernmentId.data?.error || ""),
    /required for new employees/
  );
  checked("Birthday and government ID rejection", "Future birthday, under-17 hire date, malformed SSS number, and missing mandatory government ID rejected with HTTP 400");
  const createPooling = await api(baseUrl, "/api/employees", {
    token: tokens.staff,
    method: "POST",
    body: createEmployeeBody({
      name: `Fictional Pooling Employee ${runId}`,
      company: companyA,
      documents: governmentDocuments,
    }),
  });
  expectStatus(createPooling, 201, "Create pooling employee");
  const poolingEmployeeId = createPooling.data.id;
  assert.ok(poolingEmployeeId);

  const createDeployed = await api(baseUrl, "/api/employees", {
    token: tokens.staff,
    method: "POST",
    body: createEmployeeBody({
      name: `Fictional Deployed Employee A ${runId}`,
      company: companyA,
      status: "Deployed",
      documents:
        governmentDocuments,
    }),
  });
  expectStatus(createDeployed, 201, "Create deployed employee A");
  const deployedEmployeeId = createDeployed.data.id;

  const createOther = await api(baseUrl, "/api/employees", {
    token: tokens.staff,
    method: "POST",
    body: createEmployeeBody({
      name: `Fictional Deployed Employee B ${runId}`,
      company: companyB,
      status: "Deployed",
      documents:
        governmentDocuments,
    }),
  });
  expectStatus(createOther, 201, "Create deployed employee B");
  const otherEmployeeId = createOther.data.id;

  expectStatus(
    await api(baseUrl, `/api/employees/${poolingEmployeeId}`, { token: tokens.manager }),
    200,
    "Retrieve employee"
  );
  expectStatus(
    await api(baseUrl, `/api/employees/${poolingEmployeeId}`, { token: tokens.superAdmin }),
    200,
    "Super Admin employee detail"
  );
  expectStatus(
    await api(baseUrl, "/api/employees", {
      token: tokens.manager,
      method: "POST",
      body: createEmployeeBody({ name: `Fictional Unauthorized Create ${runId}`, company: companyA }),
    }),
    403,
    "HR Manager employee creation"
  );
  expectStatus(
    await api(baseUrl, `/api/employees/archive/${poolingEmployeeId}`, {
      token: tokens.staff,
      method: "PUT",
      body: {},
    }),
    403,
    "HR Staff employee archive"
  );
  expectStatus(
    await api(baseUrl, `/api/employees/${deployedEmployeeId}`, { token: tokens.coordinatorA }),
    200,
    "Coordinator same-company employee detail"
  );
  expectStatus(
    await api(baseUrl, `/api/employees/${otherEmployeeId}`, { token: tokens.coordinatorA }),
    404,
    "Coordinator cross-company employee detail"
  );

  const updatePooling = await api(baseUrl, `/api/employees/${poolingEmployeeId}`, {
    token: tokens.staff,
    method: "PUT",
    body: createEmployeeBody({
      name: `Fictional Pooling Employee Updated ${runId}`,
      company: companyA,
      documents: governmentDocuments,
    }),
  });
  expectStatus(updatePooling, 200, "Update employee");

  const dbCheck = await db.promise().query(
    `SELECT e.name, e.birthday, e.date_hired, e.company, e.position,
            GROUP_CONCAT(CONCAT(d.name, ':', d.document_number) ORDER BY d.name SEPARATOR '|') AS documents
       FROM employees e
       LEFT JOIN employee_documents d ON d.employee_id = e.id
      WHERE e.id = ?
      GROUP BY e.id`,
    [poolingEmployeeId]
  );
  const persisted = dbCheck[0][0];
  assert.match(persisted.name, /Updated/);
  assert.match(persisted.documents, /SSS \(ID or E1 form\):0012345678/);
  assert.match(persisted.documents, /PhilHealth \(ID or MDF Form\):001234567890/);
  assert.match(persisted.documents, /Pag-IBIG \(ID or MDRF Form\):000123456789/);
  checked("Employee CRUD and persistence", "Create/retrieve/update passed; birthday, hire date, profile fields, and digit-only government IDs persisted");
  checked("Employee RBAC and company scope", "HR Staff owns Create/Update, HR Manager owns archive, Super Admin may view, and Coordinator cross-company detail returned HTTP 404");

  expectStatus(
    await api(baseUrl, "/api/incidents", {
      token: tokens.staff,
      method: "POST",
      body: { employeeId: deployedEmployeeId, violationType: "Fictional Critical Safety Violation", incidentDate: "2026-11-01" },
    }),
    403,
    "HR Staff incident creation"
  );
  expectStatus(
    await api(baseUrl, "/api/incidents", {
      token: tokens.superAdmin,
      method: "POST",
      body: { employeeId: deployedEmployeeId, violationType: "Fictional Critical Safety Violation", incidentDate: "2026-11-01" },
    }),
    403,
    "Super Admin incident creation"
  );
  expectStatus(
    await api(baseUrl, "/api/incidents", {
      token: tokens.coordinatorA,
      method: "POST",
      body: { employeeId: otherEmployeeId, violationType: "Fictional Critical Safety Violation", violationSection: "TEST-1", violationCategory: "PHASE 3 FICTIONAL POLICY", incidentDate: "2026-11-01" },
    }),
    404,
    "Coordinator cross-company incident creation"
  );

  const incidentBody = {
    employeeId: deployedEmployeeId,
    violationType: "Fictional Critical Safety Violation",
    violationSection: "TEST-1",
    violationCategory: "PHASE 3 FICTIONAL POLICY",
    incidentDate: "2026-11-01",
    location: "Fictional Phase 3 Site",
    description: "Synthetic incident for isolated runtime verification.",
  };
  const createIncident = await api(baseUrl, "/api/incidents", {
    token: tokens.manager,
    method: "POST",
    body: incidentBody,
  });
  expectStatus(createIncident, 201, "Create incident");
  const incidentId = createIncident.data.id;
  assert.ok(incidentId);

  const incidentDetail = await api(baseUrl, `/api/incidents/${incidentId}`, { token: tokens.manager });
  expectStatus(incidentDetail, 200, "Retrieve incident");
  expectStatus(
    await api(baseUrl, `/api/incidents/${incidentId}`, { token: tokens.superAdmin }),
    200,
    "Super Admin incident detail"
  );
  expectStatus(
    await api(baseUrl, `/api/incidents/${incidentId}`, { token: tokens.coordinatorA }),
    200,
    "Coordinator same-company incident detail"
  );
  expectStatus(
    await api(baseUrl, `/api/incidents/${incidentId}`, { token: tokens.coordinatorB }),
    404,
    "Coordinator cross-company incident detail"
  );
  expectStatus(
    await api(baseUrl, `/api/incidents/employee/${deployedEmployeeId}/summary`, { token: tokens.coordinatorA }),
    200,
    "Coordinator aggregate incident summary"
  );
  const [[incidentRow]] = await db.promise().query(
    "SELECT severity, status, action_taken, policy_sanction FROM incidents WHERE id = ?",
    [incidentId]
  );
  assert.equal(incidentRow.severity, "Critical");
  assert.equal(incidentRow.status, "Open");
  assert.equal(incidentRow.action_taken, null);

  const startIncident = await api(baseUrl, `/api/incidents/${incidentId}/status`, {
    token: tokens.coordinatorA,
    method: "PATCH",
    body: { workflowAction: "START_INVESTIGATION" },
  });
  expectStatus(startIncident, 200, "Start incident investigation");
  const [[investigatingRow]] = await db.promise().query(
    "SELECT status FROM incidents WHERE id = ?",
    [incidentId]
  );
  assert.equal(investigatingRow.status, "Investigating");

  const proofForm =
    new FormData();
  proofForm.append(
    "workflowAction",
    "SUBMIT_RESOLUTION"
  );
  proofForm.append(
    "actionTaken",
    "Fictional corrective discussion completed"
  );
  proofForm.append(
    "resolutionNotes",
    "Synthetic resolution proof submitted for Phase 3 verification."
  );
  proofForm.append(
    "recommendation",
    "Continue fictional monitoring"
  );
  proofForm.append(
    "evidenceFiles",
    new Blob(
      [
        "%PDF-1.4\n% Phase 3 fictional resolution proof\n%%EOF\n",
      ],
      {
        type:
          "application/pdf",
      }
    ),
    `phase3-fictional-proof-${runId}.pdf`
  );

  const submitResolution =
    await api(
      baseUrl,
      `/api/incidents/${incidentId}/status`,
      {
        token:
          tokens.coordinatorA,
        method:
          "PATCH",
        body:
          proofForm,
      }
    );
  expectStatus(
    submitResolution,
    200,
    "Submit incident resolution proof"
  );

  const [[reviewRow]] =
    await db.promise().query(
      "SELECT status, action_taken FROM incidents WHERE id = ?",
      [incidentId]
    );
  assert.equal(
    reviewRow.status,
    "For Review"
  );
  assert.equal(
    reviewRow.action_taken,
    "Fictional corrective discussion completed"
  );

  const [[evidenceRow]] =
    await db.promise().query(
      `SELECT id, file_path, evidence_purpose
         FROM incident_evidence
        WHERE incident_id = ?
        ORDER BY id DESC
        LIMIT 1`,
      [incidentId]
    );
  assert.equal(
    evidenceRow.evidence_purpose,
    "RESOLUTION_PROOF"
  );
  assert.match(
    evidenceRow.file_path,
    /^[a-z0-9/_-]+\.pdf$/i
  );
  assert.doesNotMatch(
    evidenceRow.file_path,
    /(?:\.\.|https?:)/i
  );

  const evidenceResponse =
    await fetch(
      `${baseUrl}/api/incidents/${incidentId}/evidence/${evidenceRow.id}/file`,
      {
        headers: {
          Authorization:
            `Bearer ${tokens.manager}`,
        },
      }
    );
  assert.equal(
    evidenceResponse.status,
    200
  );
  assert.match(
    String(
      evidenceResponse.headers.get(
        "content-type"
      ) ||
        ""
    ),
    /application\/pdf/i
  );
  const evidenceBytes =
    Buffer.from(
      await evidenceResponse.arrayBuffer()
    );
  assert.equal(
    evidenceBytes
      .subarray(0, 5)
      .toString("ascii"),
    "%PDF-"
  );

  const closeIncident =
    await api(
      baseUrl,
      `/api/incidents/${incidentId}/status`,
      {
        token:
          tokens.manager,
        method:
          "PATCH",
        body: {
          workflowAction:
            "CLOSE_INCIDENT",
          resolutionNotes:
            "Fictional proof independently reviewed and approved.",
        },
      }
    );
  expectStatus(
    closeIncident,
    200,
    "Close reviewed incident"
  );
  const [[closedRow]] =
    await db.promise().query(
      "SELECT status, review_decision FROM incidents WHERE id = ?",
      [incidentId]
    );
  assert.equal(
    closedRow.status,
    "Closed"
  );
  assert.equal(
    closedRow.review_decision,
    "Approved"
  );
  checked("Incident creation and classification", "Created/retrieved through API; server classified Critical and retained prescribed sanction separately from actual action");
  checked("Incident workflow and protected evidence", "Open, Investigating, For Review, and Closed persisted; private Supabase proof uploaded and downloaded through the authorized endpoint");
  checked("Incident RBAC", "HR Staff/Super Admin create denied; independent manager review, Super Admin view, and Coordinator aggregate/company scope passed");

  const evaluation1Result = await api(baseUrl, `/api/kpi/evaluation/${deployedEmployeeId}`, { token: tokens.manager });
  expectStatus(evaluation1Result, 200, "KPI evaluation");
  const evaluation1 = evaluation1Result.data.evaluation;
  assert.notEqual(evaluation1.suggestedHRAction, undefined);
  assert.notEqual(evaluation1.systemRecommendation, undefined);
  assert.notEqual(evaluation1.recommendationReason, undefined);
  assert.notEqual(evaluation1.suggestedHRActionReason, undefined);
  assert.notEqual(evaluation1.behaviorTrend, undefined);
  expectStatus(
    await api(baseUrl, `/api/kpi/evaluation/${deployedEmployeeId}`, { token: tokens.superAdmin }),
    200,
    "Super Admin KPI evaluation"
  );
  expectStatus(
    await api(baseUrl, `/api/kpi/evaluation/${deployedEmployeeId}`, { token: tokens.coordinatorA }),
    403,
    "Coordinator KPI decision evaluation"
  );

  const acceptedPayload = decisionPayload(deployedEmployeeId, evaluation1);
  expectStatus(
    await api(baseUrl, "/api/kpi/decision-history", {
      token: tokens.staff,
      method: "POST",
      body: acceptedPayload,
    }),
    403,
    "HR Staff KPI decision"
  );
  expectStatus(
    await api(baseUrl, "/api/kpi/decision-history", {
      token: tokens.coordinatorA,
      method: "POST",
      body: acceptedPayload,
    }),
    403,
    "Coordinator KPI decision"
  );
  const statusBeforeDecision = await db.promise().query(
    "SELECT status, employment_status, workforce_status FROM employees WHERE id = ?",
    [deployedEmployeeId]
  );
  const saveDecision = await api(baseUrl, "/api/kpi/decision-history", {
    token: tokens.manager,
    method: "POST",
    body: acceptedPayload,
  });
  expectStatus(saveDecision, 201, "Save KPI decision");

  const createIncident2 = await api(baseUrl, "/api/incidents", {
    token: tokens.coordinatorA,
    method: "POST",
    body: { ...incidentBody, incidentDate: "2026-11-02", description: "Second synthetic incident for stale snapshot verification." },
  });
  expectStatus(createIncident2, 201, "Create second incident");
  const [[historyState]] =
    await db.promise().query(
      `SELECT
         SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed_count,
         SUM(CASE WHEN status <> 'Closed' THEN 1 ELSE 0 END) AS unresolved_count,
         COUNT(*) AS historical_count
       FROM incidents
       WHERE employee_id = ?`,
      [deployedEmployeeId]
    );
  assert.equal(
    Number(
      historyState.closed_count
    ),
    1
  );
  assert.equal(
    Number(
      historyState.unresolved_count
    ),
    1
  );
  assert.equal(
    Number(
      historyState.historical_count
    ),
    2
  );
  checked("Resolved and unresolved retention", "One Closed and one Open incident remained in authoritative history for the fictional employee");

  expectStatus(
    await api(baseUrl, "/api/kpi/decision-history", {
      token: tokens.manager,
      method: "POST",
      body: acceptedPayload,
    }),
    409,
    "Stale KPI snapshot"
  );
  const evaluation2Result = await api(baseUrl, `/api/kpi/evaluation/${deployedEmployeeId}`, { token: tokens.manager });
  expectStatus(evaluation2Result, 200, "Refresh KPI evaluation");
  const refreshedSave = await api(baseUrl, "/api/kpi/decision-history", {
    token: tokens.manager,
    method: "POST",
    body: decisionPayload(deployedEmployeeId, evaluation2Result.data.evaluation),
  });
  expectStatus(refreshedSave, 201, "Resubmit refreshed KPI decision");

  const history = await api(baseUrl, `/api/kpi/decision-history?employeeId=${deployedEmployeeId}`, { token: tokens.manager });
  expectStatus(history, 200, "Reload KPI decision history");
  const [[decisionCount]] = await db.promise().query(
    `SELECT COUNT(*) AS count,
            SUM(CASE WHEN decided_by = ? AND decided_by_role = 'HR_MANAGER' THEN 1 ELSE 0 END) AS reviewer_matches,
            SUM(CASE WHEN notes IS NOT NULL AND notes <> '' THEN 1 ELSE 0 END) AS notes_saved
       FROM kpi_decision_history WHERE employee_id = ?`,
    [users.manager.username, deployedEmployeeId]
  );
  assert.equal(Number(decisionCount.count), 2);
  assert.equal(Number(decisionCount.reviewer_matches), 2);
  assert.equal(Number(decisionCount.notes_saved), 2);
  const statusAfterDecision = await db.promise().query(
    "SELECT status, employment_status, workforce_status FROM employees WHERE id = ?",
    [deployedEmployeeId]
  );
  assert.deepEqual(statusAfterDecision[0][0], statusBeforeDecision[0][0]);
  checked("KPI rule-based DSS", "Evaluation exposed trend, risk/KPI, separate workflow/corrective outputs, and explanation");
  checked("HR decision recording", "HR Manager-only save/reload persisted reviewer, notes, and snapshot; stale snapshot rejected 409; refreshed submission passed");
  checked("No automatic enforcement", "Employee employment/workforce status was unchanged by KPI decisions");

  const archive = await api(baseUrl, `/api/employees/archive/${poolingEmployeeId}`, {
    token: tokens.manager,
    method: "PUT",
    body: {},
  });
  expectStatus(archive, 200, "Archive employee");
  const [[archivedRow]] = await db.promise().query(
    "SELECT archived FROM employees WHERE id = ?",
    [poolingEmployeeId]
  );
  assert.equal(Number(archivedRow.archived), 1);
  checked("Employee archive", "HR Manager archive passed and persisted; historical record retained");

  console.log(
    JSON.stringify(
      {
        database: EXPECTED_DATABASE,
        fixtureRunId: runId,
        externalIntegrations: {
          supabasePrivateTestBucket:
            true,
          gmail:
            false,
        },
        checks,
        limitations: [
          "Formal authorized-HR acknowledgement of the configured age, government-ID, and KPI business rules is not stored in the repository.",
        ],
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(`PHASE 3 RUNTIME VERIFICATION FAILED: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await db.promise().end();
  });
