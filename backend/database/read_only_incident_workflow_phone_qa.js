require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

const db = require("../config/db");

(async () => {
  try {
    const INCIDENT_ID = 119;

    const [sessions] = await db.promise().query(`
      SELECT
        id,
        session_id,
        creator_user_id,
        capture_purpose,
        status,
        original_name,
        mime_type,
        file_size,
        object_path,
        created_at,
        upload_authorized_at,
        uploaded_at,
        consumed_at,
        cancelled_at,
        expires_at
      FROM incident_phone_capture_sessions
      WHERE LOWER(capture_purpose) = 'incident_workflow'
      ORDER BY id DESC
      LIMIT 5
    `);

    console.log(
      "\n===== LATEST WORKFLOW PHONE CAPTURE SESSIONS ====="
    );

    console.table(sessions);

    const [incidents] = await db.promise().query(
      `
      SELECT
        id,
        employee_id,
        employee_name,
        status,
        investigation_started_at,
        resolution_submitted_at,
        review_decision,
        reviewed_at,
        last_action_type,
        last_action_at
      FROM incidents
      WHERE id = ?
      LIMIT 1
      `,
      [INCIDENT_ID]
    );

    console.log(
      "\n===== TEST INCIDENT WORKFLOW STATE ====="
    );

    console.table(incidents);

    const [evidence] = await db.promise().query(
      `
      SELECT
        id,
        incident_id,
        file_name,
        file_path,
        evidence_purpose,
        created_at
      FROM incident_evidence
      WHERE incident_id = ?
      ORDER BY id DESC
      `,
      [INCIDENT_ID]
    );

    console.log(
      "\n===== INCIDENT #119 EVIDENCE ====="
    );

    console.table(evidence);

    const [phoneMatches] = await db.promise().query(
      `
      SELECT
        pcs.id AS capture_session_id,
        pcs.session_id,
        pcs.status AS capture_status,
        pcs.capture_purpose,
        pcs.object_path,
        pcs.uploaded_at,
        pcs.consumed_at,

        ie.id AS evidence_id,
        ie.incident_id,
        ie.file_name,
        ie.file_path,
        ie.evidence_purpose

      FROM incident_phone_capture_sessions AS pcs

      LEFT JOIN incident_evidence AS ie
        ON TRIM(
          LEADING '/' FROM ie.file_path
        ) = TRIM(
          LEADING '/' FROM pcs.object_path
        )

      WHERE LOWER(
        pcs.capture_purpose
      ) = 'incident_workflow'

      ORDER BY pcs.id DESC
      LIMIT 5
      `
    );

    console.log(
      "\n===== PHONE CAPTURE -> INCIDENT EVIDENCE MATCH ====="
    );

    console.table(phoneMatches);

    const latestWorkflowSession =
      sessions[0] || null;

    const incident =
      incidents[0] || null;

    const matchingPhoneEvidence =
      phoneMatches.find(
        (row) =>
          Number(row.incident_id) ===
            INCIDENT_ID &&
          String(
            row.evidence_purpose || ""
          ).toUpperCase() ===
            "RESOLUTION_PROOF"
      );

    const checks = {
      workflowSessionFound:
        !!latestWorkflowSession,

      workflowSessionConsumed:
        latestWorkflowSession?.status ===
        "CONSUMED",

      workflowConsumedTimestampPresent:
        !!latestWorkflowSession?.consumed_at,

      workflowNotCancelled:
        !latestWorkflowSession?.cancelled_at,

      incidentFound:
        !!incident,

      incidentForReview:
        String(
          incident?.status || ""
        ).toLowerCase() ===
        "for review",

      investigationStarted:
        !!incident?.investigation_started_at,

      proofSubmitted:
        !!incident?.resolution_submitted_at,

      phoneEvidenceAttached:
        !!matchingPhoneEvidence,

      phoneEvidencePurposeCorrect:
        matchingPhoneEvidence
          ?.evidence_purpose ===
        "RESOLUTION_PROOF",
    };

    console.log(
      "\n===== WORKFLOW PHONE CAPTURE ASSERTIONS ====="
    );

    console.table(
      Object.entries(checks).map(
        ([check, pass]) => ({
          check,
          result:
            pass ? "PASS" : "FAIL",
        })
      )
    );

    const allPassed =
      Object.values(checks).every(
        Boolean
      );

    console.log(
      `\nWORKFLOW_PHONE_QA_RESULT=${
        allPassed ? "PASS" : "FAIL"
      }`
    );

    process.exitCode =
      allPassed ? 0 : 1;
  } catch (error) {
    console.error(
      "\nREAD_ONLY_WORKFLOW_QA_ERROR:",
      error
    );

    console.log(
      "\nWORKFLOW_PHONE_QA_RESULT=FAIL"
    );

    process.exitCode = 1;
  } finally {
    await db.promise().end();
  }
})();
