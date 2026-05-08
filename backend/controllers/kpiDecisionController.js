const db = require("../config/db");

function toCamelCaseRecord(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    company: row.company || "Unassigned",

    riskLevel: row.risk_level || "",
    kpiLevel: row.kpi_level || "",
    violationCount: Number(row.violation_count || 0),
    severityScore: Number(row.severity_score || 0),
    criticalIncidentCount: Number(row.critical_incident_count || 0),

    decisionConfidence: row.decision_confidence || "",
    suggestedHRAction: row.suggested_hr_action || "",
    systemRecommendation: row.system_recommendation || "",
    finalAction: row.final_action || "",
    decisionType: row.decision_type || "Recorded",

    notes: row.notes || "",
    decidedBy: row.decided_by || "HR User",
    decidedByRole: row.decided_by_role || "Authorized User",
    decidedAt: row.decided_at,
    status: row.status || "Recorded",

    recommendationReason: row.recommendation_reason || "",
    decisionConfidenceReason: row.decision_confidence_reason || "",
    suggestedHRActionReason: row.suggested_hr_action_reason || "",
    correctiveActionBasis: row.corrective_action_basis || "",

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cleanValue(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

exports.getKpiDecisionHistory = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT *
      FROM kpi_decision_history
      ORDER BY decided_at DESC, id DESC
    `);

    res.json(rows.map(toCamelCaseRecord));
  } catch (error) {
    console.error("GET KPI DECISION HISTORY ERROR:", error);
    res.status(500).json({
      error: "Failed to fetch KPI decision history.",
    });
  }
};

exports.createKpiDecision = async (req, res) => {
  try {
    const {
      employeeId,
      employeeName,
      company,

      riskLevel,
      kpiLevel,
      violationCount,
      severityScore,
      criticalIncidentCount,

      decisionConfidence,
      suggestedHRAction,
      systemRecommendation,
      finalAction,
      decisionType,

      notes,
      decidedBy,
      decidedByRole,

      recommendationReason,
      decisionConfidenceReason,
      suggestedHRActionReason,
      correctiveActionBasis,
    } = req.body || {};

    if (!employeeId || !employeeName || !finalAction || !decisionType) {
      return res.status(400).json({
        error:
          "Employee ID, employee name, final action, and decision type are required.",
      });
    }

    const allowedDecisionTypes = ["Accepted", "Modified", "Rejected"];

    if (!allowedDecisionTypes.includes(decisionType)) {
      return res.status(400).json({
        error: "Invalid decision type.",
      });
    }

    if (decisionType === "Rejected" && !cleanValue(notes)) {
      return res.status(400).json({
        error: "Rejected recommendations require HR notes.",
      });
    }

    const [result] = await db.promise().query(
      `
      INSERT INTO kpi_decision_history
      (
        employee_id,
        employee_name,
        company,

        risk_level,
        kpi_level,
        violation_count,
        severity_score,
        critical_incident_count,

        decision_confidence,
        suggested_hr_action,
        system_recommendation,
        final_action,
        decision_type,

        notes,
        decided_by,
        decided_by_role,
        decided_at,
        status,

        recommendation_reason,
        decision_confidence_reason,
        suggested_hr_action_reason,
        corrective_action_basis
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
      `,
      [
        cleanValue(employeeId),
        cleanValue(employeeName, "Unknown Employee"),
        cleanValue(company, "Unassigned"),

        cleanValue(riskLevel),
        cleanValue(kpiLevel),
        Number(violationCount || 0),
        Number(severityScore || 0),
        Number(criticalIncidentCount || 0),

        cleanValue(decisionConfidence),
        cleanValue(suggestedHRAction),
        cleanValue(systemRecommendation),
        cleanValue(finalAction),
        cleanValue(decisionType),

        cleanValue(notes),
        cleanValue(decidedBy, "HR User"),
        cleanValue(decidedByRole, "Authorized User"),
        "Recorded",

        cleanValue(recommendationReason),
        cleanValue(decisionConfidenceReason),
        cleanValue(suggestedHRActionReason),
        cleanValue(correctiveActionBasis),
      ]
    );

    const [rows] = await db.promise().query(
      `
      SELECT *
      FROM kpi_decision_history
      WHERE id = ?
      LIMIT 1
      `,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "KPI decision recorded successfully.",
      record: toCamelCaseRecord(rows[0]),
    });
  } catch (error) {
    console.error("CREATE KPI DECISION ERROR:", error);
    res.status(500).json({
      error: "Failed to record KPI decision.",
    });
  }
};

exports.deleteKpiDecision = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.promise().query(
      `
      DELETE FROM kpi_decision_history
      WHERE id = ?
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Decision history record not found.",
      });
    }

    res.json({
      success: true,
      message: "KPI decision history record removed.",
    });
  } catch (error) {
    console.error("DELETE KPI DECISION ERROR:", error);
    res.status(500).json({
      error: "Failed to delete KPI decision history record.",
    });
  }
};