const db = require("../config/db");

const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

const KPI_LEVELS = {
  GOOD_STANDING: "Good Standing",
  MINOR_CONCERN: "Minor Concern",
  NEEDS_IMPROVEMENT: "Needs Improvement",
  CRITICAL_CONCERN: "Critical Concern",
};

const RISK_LEVELS = {
  LOW_RISK: "Low Risk",
  MONITOR: "Monitor",
  REPEAT: "Repeat",
  HIGH_RISK: "High Risk",
};

const DECISION_CONFIDENCE = {
  LOW: "Low Confidence",
  MODERATE: "Moderate Confidence",
  HIGH: "High Confidence",
};

const HR_ACTION_WORKFLOW = {
  MONITOR: "Continue Monitoring",
  HUMAN_REVIEW: "Human Review Required",
  HR_VALIDATION: "HR Validation Required",
  INVESTIGATION: "Schedule HR Investigation",
  PIP: "Performance Improvement Review",
  ESCALATION: "Priority HR Escalation",
  SUSPENSION: "Suspension Review",
  TERMINATION: "Termination Review",
};

const ALLOWED_DECISION_TYPES = new Set([
  "Accepted",
  "Modified",
  "Rejected",
]);

const ALLOWED_KPI_LEVELS = new Set(
  Object.values(KPI_LEVELS)
);

const ALLOWED_RISK_LEVELS = new Set(
  Object.values(RISK_LEVELS)
);

const ALLOWED_DECISION_CONFIDENCE = new Set(
  Object.values(DECISION_CONFIDENCE)
);

const ALLOWED_SUGGESTED_HR_ACTIONS = new Set(
  Object.values(HR_ACTION_WORKFLOW)
);

const ALLOWED_SYSTEM_RECOMMENDATIONS = new Set([
  "Retain / Maintain Good Standing",
  "Verbal Counseling",
  "Performance Improvement Plan",
  "Reassignment of Position",
  "Seminar & Webinar",
  "Employee Training",
]);

const ALLOWED_FINAL_ACTIONS = new Set([
  ...ALLOWED_SYSTEM_RECOMMENDATIONS,
  ...ALLOWED_SUGGESTED_HR_ACTIONS,
  "No Action Required",
]);

function toCamelCaseRecord(row) {
  return {
    id: row.id,

    employeeId:
      row.employee_id,

    employeeName:
      row.employee_name,

    company:
      row.company ||
      "Unassigned",

    riskLevel:
      row.risk_level ||
      "",

    kpiLevel:
      row.kpi_level ||
      "",

    violationCount:
      Number(
        row.violation_count ||
          0
      ),

    severityScore:
      Number(
        row.severity_score ||
          0
      ),

    criticalIncidentCount:
      Number(
        row.critical_incident_count ||
          0
      ),

    decisionConfidence:
      row.decision_confidence ||
      "",

    suggestedHRAction:
      row.suggested_hr_action ||
      "",

    systemRecommendation:
      row.system_recommendation ||
      "",

    finalAction:
      row.final_action ||
      "",

    decisionType:
      row.decision_type ||
      "Recorded",

    notes:
      row.notes ||
      "",

    decidedBy:
      row.decided_by ||
      "HR User",

    decidedByRole:
      row.decided_by_role ||
      "Authorized User",

    decidedAt:
      row.decided_at,

    status:
      row.status ||
      "Recorded",

    recommendationReason:
      row.recommendation_reason ||
      "",

    decisionConfidenceReason:
      row.decision_confidence_reason ||
      "",

    suggestedHRActionReason:
      row.suggested_hr_action_reason ||
      "",

    correctiveActionBasis:
      row.corrective_action_basis ||
      "",

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

function cleanValue(
  value,
  fallback = ""
) {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  const cleaned =
    String(value).trim();

  return cleaned || fallback;
}

function getTrustedActor(req) {
  const username =
    cleanValue(
      req.user?.username
    );

  const role =
    cleanValue(
      req.user?.role
    );

  const id =
    req.user?.id ??
    req.user?.userId ??
    null;

  if (
    !username ||
    !role ||
    id === null ||
    id === undefined
  ) {
    return null;
  }

  return {
    id,
    username,
    role,
  };
}

function parseNonNegativeNumber(
  value
) {
  const number =
    Number(
      value ?? 0
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

function parseNonNegativeInteger(
  value
) {
  const number =
    parseNonNegativeNumber(
      value
    );

  if (
    number === null ||
    !Number.isInteger(
      number
    )
  ) {
    return null;
  }

  return number;
}

function parsePositiveInteger(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isSafeInteger(
      number
    ) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function isAllowedValue(
  value,
  allowedValues
) {
  return allowedValues.has(
    cleanValue(value)
  );
}

/*
 * These functions mirror the existing frontend KPI decision rules.
 *
 * They do NOT calculate severityScore because severity weights
 * currently come from frontend-local configurable settings.
 *
 * They only validate downstream KPI fields against the submitted
 * severity score plus trusted database incident counts.
 */

function getExpectedKPILevel(
  severityScore,
  violationCount
) {
  if (
    severityScore >= 8
  ) {
    return KPI_LEVELS.CRITICAL_CONCERN;
  }

  if (
    severityScore >= 4
  ) {
    return KPI_LEVELS.NEEDS_IMPROVEMENT;
  }

  if (
    violationCount >= 1
  ) {
    return KPI_LEVELS.MINOR_CONCERN;
  }

  return KPI_LEVELS.GOOD_STANDING;
}

function getExpectedRiskLevel(
  kpiLevel,
  violationCount,
  criticalIncidentCount
) {
  if (
    criticalIncidentCount >= 1
  ) {
    return RISK_LEVELS.HIGH_RISK;
  }

  switch (kpiLevel) {
    case KPI_LEVELS.CRITICAL_CONCERN:
      return RISK_LEVELS.HIGH_RISK;

    case KPI_LEVELS.NEEDS_IMPROVEMENT:
      return RISK_LEVELS.REPEAT;

    case KPI_LEVELS.MINOR_CONCERN:
      return RISK_LEVELS.MONITOR;

    default:
      return violationCount > 0
        ? RISK_LEVELS.MONITOR
        : RISK_LEVELS.LOW_RISK;
  }
}

function getExpectedDecisionConfidence({
  violationCount,
  criticalIncidentCount,
  severityScore,
  riskLevel,
}) {
  if (
    criticalIncidentCount >= 1 ||
    severityScore >= 12 ||
    violationCount >= 5 ||
    riskLevel ===
      RISK_LEVELS.HIGH_RISK
  ) {
    return DECISION_CONFIDENCE.HIGH;
  }

  if (
    severityScore >= 4 ||
    violationCount >= 2 ||
    riskLevel ===
      RISK_LEVELS.REPEAT
  ) {
    return DECISION_CONFIDENCE.MODERATE;
  }

  return DECISION_CONFIDENCE.LOW;
}

function getExpectedSuggestedHRAction({
  confidence,
  violationCount,
  criticalIncidentCount,
  severityScore,
  riskLevel,
}) {
  if (
    criticalIncidentCount >= 1 &&
    violationCount >= 5 &&
    severityScore >= 12
  ) {
    return HR_ACTION_WORKFLOW.TERMINATION;
  }

  if (
    criticalIncidentCount >= 1 ||
    riskLevel ===
      RISK_LEVELS.HIGH_RISK
  ) {
    return HR_ACTION_WORKFLOW.SUSPENSION;
  }

  if (
    confidence ===
      DECISION_CONFIDENCE.HIGH &&
    violationCount >= 3
  ) {
    return HR_ACTION_WORKFLOW.ESCALATION;
  }

  if (
    confidence ===
      DECISION_CONFIDENCE.MODERATE &&
    violationCount >= 2
  ) {
    return HR_ACTION_WORKFLOW.INVESTIGATION;
  }

  if (
    confidence ===
    DECISION_CONFIDENCE.MODERATE
  ) {
    return HR_ACTION_WORKFLOW.HR_VALIDATION;
  }

  if (
    confidence ===
      DECISION_CONFIDENCE.LOW &&
    violationCount >= 1
  ) {
    return HR_ACTION_WORKFLOW.HUMAN_REVIEW;
  }

  return HR_ACTION_WORKFLOW.MONITOR;
}

async function getTrustedEmployee(
  employeeId
) {
  const [rows] =
    await db
      .promise()
      .query(
        `
        SELECT
          id,
          name,
          company,
          archived
        FROM employees
        WHERE id = ?
        LIMIT 1
        `,
        [
          employeeId,
        ]
      );

  return (
    rows[0] ||
    null
  );
}

async function getTrustedIncidentSummary(
  employeeId
) {
  const [rows] =
    await db
      .promise()
      .query(
        `
        SELECT
          COUNT(*) AS violation_count,

          SUM(
            CASE
              WHEN LOWER(
                TRIM(severity)
              ) IN (
                'critical',
                'high'
              )
              THEN 1
              ELSE 0
            END
          ) AS critical_incident_count

        FROM incidents
        WHERE employee_id = ?
        `,
        [
          employeeId,
        ]
      );

  const row =
    rows[0] || {};

  return {
    violationCount:
      Number(
        row.violation_count ||
          0
      ),

    criticalIncidentCount:
      Number(
        row.critical_incident_count ||
          0
      ),
  };
}

exports.getKpiDecisionHistory =
  async (
    req,
    res
  ) => {
    try {
      const [rows] =
        await db
          .promise()
          .query(
            `
            SELECT *
            FROM kpi_decision_history
            ORDER BY
              decided_at DESC,
              id DESC
            `
          );

      return res.json(
        rows.map(
          toCamelCaseRecord
        )
      );
    } catch (error) {
      console.error(
        "GET KPI DECISION HISTORY ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to fetch KPI decision history.",

          message:
            "The KPI decision history records could not be retrieved.",
        });
    }
  };

exports.createKpiDecision =
  async (
    req,
    res
  ) => {
    try {
      const actor =
        getTrustedActor(
          req
        );

      if (!actor) {
        return res
          .status(401)
          .json({
            success: false,

            error:
              "Authentication required.",

            message:
              "A verified authenticated user is required to record a KPI decision.",
          });
      }

      const {
        employeeId,

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

        recommendationReason,
        decisionConfidenceReason,
        suggestedHRActionReason,
        correctiveActionBasis,
      } = req.body || {};

      const parsedEmployeeId =
        parsePositiveInteger(
          employeeId
        );

      const cleanedFinalAction =
        cleanValue(
          finalAction
        );

      const cleanedDecisionType =
        cleanValue(
          decisionType
        );

      if (
        !parsedEmployeeId ||
        !cleanedFinalAction ||
        !cleanedDecisionType
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Employee ID, final action, and decision type are required.",
          });
      }

      if (
        !ALLOWED_DECISION_TYPES.has(
          cleanedDecisionType
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid decision type.",
          });
      }

      if (
        !ALLOWED_FINAL_ACTIONS.has(
          cleanedFinalAction
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid final HR action.",
          });
      }

      const cleanedNotes =
        cleanValue(
          notes
        );

      if (
        cleanedDecisionType ===
          "Rejected" &&
        !cleanedNotes
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Rejected recommendations require HR notes.",
          });
      }

      const parsedViolationCount =
        parseNonNegativeInteger(
          violationCount
        );

      const parsedSeverityScore =
        parseNonNegativeNumber(
          severityScore
        );

      const parsedCriticalIncidentCount =
        parseNonNegativeInteger(
          criticalIncidentCount
        );

      if (
        parsedViolationCount ===
          null ||
        parsedSeverityScore ===
          null ||
        parsedCriticalIncidentCount ===
          null
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "KPI numeric values must be valid non-negative numbers. Violation and critical incident counts must be whole numbers.",
          });
      }

      if (
        !isAllowedValue(
          kpiLevel,
          ALLOWED_KPI_LEVELS
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid KPI level.",
          });
      }

      if (
        !isAllowedValue(
          riskLevel,
          ALLOWED_RISK_LEVELS
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid risk level.",
          });
      }

      if (
        !isAllowedValue(
          decisionConfidence,
          ALLOWED_DECISION_CONFIDENCE
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid decision confidence.",
          });
      }

      if (
        !isAllowedValue(
          suggestedHRAction,
          ALLOWED_SUGGESTED_HR_ACTIONS
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid suggested HR action.",
          });
      }

      if (
        !isAllowedValue(
          systemRecommendation,
          ALLOWED_SYSTEM_RECOMMENDATIONS
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid system recommendation.",
          });
      }

      const trustedEmployee =
        await getTrustedEmployee(
          parsedEmployeeId
        );

      if (!trustedEmployee) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Employee not found.",
          });
      }

      if (
        Number(
          trustedEmployee.archived
        ) === 1
      ) {
        return res
          .status(409)
          .json({
            success: false,

            error:
              "Archived employees cannot receive a new KPI decision.",

            message:
              "Restore the employee before recording a new KPI decision.",
          });
      }

      const trustedIncidentSummary =
        await getTrustedIncidentSummary(
          trustedEmployee.id
        );

      if (
        parsedViolationCount !==
          trustedIncidentSummary.violationCount ||
        parsedCriticalIncidentCount !==
          trustedIncidentSummary.criticalIncidentCount
      ) {
        return res
          .status(409)
          .json({
            success: false,

            error:
              "KPI source data is out of date.",

            message:
              "Employee incident data changed after this KPI recommendation was calculated. Synchronize KPI data and review the recommendation again.",
          });
      }

      const cleanedKpiLevel =
        cleanValue(
          kpiLevel
        );

      const cleanedRiskLevel =
        cleanValue(
          riskLevel
        );

      const cleanedDecisionConfidence =
        cleanValue(
          decisionConfidence
        );

      const cleanedSuggestedHRAction =
        cleanValue(
          suggestedHRAction
        );

      const cleanedSystemRecommendation =
        cleanValue(
          systemRecommendation
        );

      const expectedKpiLevel =
        getExpectedKPILevel(
          parsedSeverityScore,
          trustedIncidentSummary.violationCount
        );

      if (
        cleanedKpiLevel !==
        expectedKpiLevel
      ) {
        return res
          .status(409)
          .json({
            success: false,

            error:
              "KPI decision snapshot is inconsistent.",

            message:
              "The KPI level does not match the current severity score and incident count. Synchronize KPI data and review the recommendation again.",
          });
      }

      const expectedRiskLevel =
        getExpectedRiskLevel(
          expectedKpiLevel,
          trustedIncidentSummary.violationCount,
          trustedIncidentSummary.criticalIncidentCount
        );

      if (
        cleanedRiskLevel !==
        expectedRiskLevel
      ) {
        return res
          .status(409)
          .json({
            success: false,

            error:
              "KPI decision snapshot is inconsistent.",

            message:
              "The risk level does not match the current KPI decision rules. Synchronize KPI data and review the recommendation again.",
          });
      }

      const expectedDecisionConfidence =
        getExpectedDecisionConfidence({
          violationCount:
            trustedIncidentSummary.violationCount,

          criticalIncidentCount:
            trustedIncidentSummary.criticalIncidentCount,

          severityScore:
            parsedSeverityScore,

          riskLevel:
            expectedRiskLevel,
        });

      if (
        cleanedDecisionConfidence !==
        expectedDecisionConfidence
      ) {
        return res
          .status(409)
          .json({
            success: false,

            error:
              "KPI decision snapshot is inconsistent.",

            message:
              "The decision confidence does not match the current KPI decision rules. Synchronize KPI data and review the recommendation again.",
          });
      }

      const expectedSuggestedHRAction =
        getExpectedSuggestedHRAction({
          confidence:
            expectedDecisionConfidence,

          violationCount:
            trustedIncidentSummary.violationCount,

          criticalIncidentCount:
            trustedIncidentSummary.criticalIncidentCount,

          severityScore:
            parsedSeverityScore,

          riskLevel:
            expectedRiskLevel,
        });

      if (
        cleanedSuggestedHRAction !==
        expectedSuggestedHRAction
      ) {
        return res
          .status(409)
          .json({
            success: false,

            error:
              "KPI decision snapshot is inconsistent.",

            message:
              "The suggested HR action does not match the current KPI decision rules. Synchronize KPI data and review the recommendation again.",
          });
      }

      if (
        cleanedDecisionType ===
          "Accepted" &&
        cleanedFinalAction !==
          expectedSuggestedHRAction
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Accepted recommendations must use the system-suggested HR action as the final HR action.",
          });
      }

      const trustedEmployeeName =
        cleanValue(
          trustedEmployee.name,
          "Unknown Employee"
        );

      const trustedCompany =
        cleanValue(
          trustedEmployee.company,
          "Unassigned"
        );

      const [result] =
        await db
          .promise()
          .query(
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
            VALUES (
              ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?,
              ?, ?, ?,
              NOW(), ?,
              ?, ?, ?, ?
            )
            `,
            [
              String(
                trustedEmployee.id
              ),

              trustedEmployeeName,

              trustedCompany,

              expectedRiskLevel,

              expectedKpiLevel,

              trustedIncidentSummary.violationCount,

              parsedSeverityScore,

              trustedIncidentSummary.criticalIncidentCount,

              expectedDecisionConfidence,

              expectedSuggestedHRAction,

              cleanedSystemRecommendation,

              cleanedFinalAction,

              cleanedDecisionType,

              cleanedNotes,

              actor.username,

              actor.role,

              "Recorded",

              cleanValue(
                recommendationReason
              ),

              cleanValue(
                decisionConfidenceReason
              ),

              cleanValue(
                suggestedHRActionReason
              ),

              cleanValue(
                correctiveActionBasis
              ),
            ]
          );

      const [rows] =
        await db
          .promise()
          .query(
            `
            SELECT *
            FROM kpi_decision_history
            WHERE id = ?
            LIMIT 1
            `,
            [
              result.insertId,
            ]
          );

      if (!rows[0]) {
        return res
          .status(500)
          .json({
            success: false,

            error:
              "KPI decision was created but could not be retrieved.",
          });
      }

      await logAudit({
        userId:
          actor.id,

        username:
          actor.username,

        role:
          actor.role,

        category:
          AUDIT_CATEGORY.OPERATIONAL,

        action:
          "CREATE_KPI_DECISION",

        description:
          `Recorded ${cleanedDecisionType} KPI decision for ${trustedEmployeeName} (Employee ID ${trustedEmployee.id}). Final HR action: ${cleanedFinalAction}.`,

        fullName:
          actor.username,
      });

      return res
        .status(201)
        .json({
          success: true,

          message:
            "KPI decision recorded successfully.",

          record:
            toCamelCaseRecord(
              rows[0]
            ),
        });
    } catch (error) {
      console.error(
        "CREATE KPI DECISION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to record KPI decision.",

          message:
            "The KPI decision could not be recorded.",
        });
    }
  };

exports.deleteKpiDecision =
  async (
    req,
    res
  ) => {
    try {
      const actor =
        getTrustedActor(
          req
        );

      if (!actor) {
        return res
          .status(401)
          .json({
            success: false,

            error:
              "Authentication required.",

            message:
              "A verified authenticated user is required to remove a KPI decision record.",
          });
      }

      const id =
        parsePositiveInteger(
          req.params.id
        );

      if (!id) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid decision history record ID.",
          });
      }

      const [existingRows] =
        await db
          .promise()
          .query(
            `
            SELECT
              id,
              employee_id,
              employee_name,
              decision_type,
              final_action
            FROM kpi_decision_history
            WHERE id = ?
            LIMIT 1
            `,
            [
              id,
            ]
          );

      const existingRecord =
        existingRows[0];

      if (!existingRecord) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Decision history record not found.",
          });
      }

      const [result] =
        await db
          .promise()
          .query(
            `
            DELETE FROM kpi_decision_history
            WHERE id = ?
            `,
            [
              id,
            ]
          );

      if (
        result.affectedRows ===
        0
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Decision history record not found.",
          });
      }

      await logAudit({
        userId:
          actor.id,

        username:
          actor.username,

        role:
          actor.role,

        category:
          AUDIT_CATEGORY.OPERATIONAL,

        action:
          "DELETE_KPI_DECISION",

        description:
          `Removed KPI decision history record ${id} for ${cleanValue(
            existingRecord.employee_name,
            "Unknown Employee"
          )} (Employee ID ${cleanValue(
            existingRecord.employee_id,
            "Unknown"
          )}). Decision type: ${cleanValue(
            existingRecord.decision_type,
            "Recorded"
          )}; final HR action: ${cleanValue(
            existingRecord.final_action,
            "Unknown"
          )}.`,

        fullName:
          actor.username,
      });

      return res.json({
        success: true,

        message:
          "KPI decision history record removed.",
      });
    } catch (error) {
      console.error(
        "DELETE KPI DECISION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to delete KPI decision history record.",

          message:
            "The KPI decision history record could not be removed.",
        });
    }
  };