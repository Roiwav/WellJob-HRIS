require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

const db = require("../config/db");

(async () => {
  try {
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
      ORDER BY id DESC
      LIMIT 5
    `);

    console.log(
      "\n===== LATEST PHONE CAPTURE SESSIONS ====="
    );

    console.table(
      sessions
    );

    const [incidents] = await db.promise().query(`
      SELECT
        id,
        employee_id,
        employee_name,
        status,
        created_at
      FROM incidents
      WHERE created_at >= NOW() - INTERVAL 30 MINUTE
      ORDER BY id DESC
      LIMIT 10
    `);

    console.log(
      "\n===== INCIDENTS CREATED IN LAST 30 MINUTES ====="
    );

    console.table(
      incidents
    );

    const [evidence] = await db.promise().query(`
      SELECT
        ie.id,
        ie.incident_id,
        ie.file_name,
        ie.file_path,
        ie.evidence_purpose,
        ie.created_at
      FROM incident_evidence AS ie
      INNER JOIN incidents AS i
        ON i.id = ie.incident_id
      WHERE i.created_at >= NOW() - INTERVAL 30 MINUTE
      ORDER BY ie.id DESC
      LIMIT 20
    `);

    console.log(
      "\n===== RECENT INCIDENT EVIDENCE ====="
    );

    console.table(
      evidence
    );

    console.log(
      "\nSAVE_FLOW_QA_RESULT=PASS"
    );

    process.exitCode = 0;
  } catch (error) {
    console.error(
      "\nREAD_ONLY_QA_ERROR:",
      error
    );

    console.log(
      "\nSAVE_FLOW_QA_RESULT=FAIL"
    );

    process.exitCode = 1;
  } finally {
    await db.promise().end();
  }
})();
