"use strict";

const db = require("../config/db");

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeCompany(value) {
  const normalized = String(
    value ?? ""
  )
    .trim()
    .replace(/\s+/g, " ");

  return normalized || null;
}

function parsePositiveId(value) {
  const normalized = String(
    value ?? ""
  ).trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const numericValue =
    Number(normalized);

  if (
    !Number.isSafeInteger(
      numericValue
    ) ||
    numericValue <= 0
  ) {
    return null;
  }

  return numericValue;
}

async function authorizeIncidentWorkflowScope(
  req,
  res,
  next
) {
  const role =
    normalizeRole(
      req.user?.role
    );

  if (
    role !==
    "HR_COORDINATOR"
  ) {
    return next();
  }

  const assignedCompany =
    normalizeCompany(
      req.user?.assignedCompany ??
      req.user?.assigned_company
    );

  if (!assignedCompany) {
    return res.status(403).json({
      success: false,
      error:
        "Company assignment required",
      message:
        "Your HR Coordinator account does not have an assigned company.",
    });
  }

  const incidentId =
    parsePositiveId(
      req.params?.id ??
      req.body?.incidentId ??
      req.body?.incident_id
    );

  if (!incidentId) {
    return res.status(400).json({
      success: false,
      error:
        "A valid incident ID is required.",
    });
  }

  try {
    const [rows] =
      await db
        .promise()
        .query(
          `
          SELECT
            i.id
          FROM incidents AS i
          INNER JOIN employees AS e
            ON e.id = i.employee_id
          INNER JOIN deployment_assignments AS da
            ON da.employee_id = i.employee_id
            AND da.status = 'Active'
          WHERE i.id = ?
            AND LOWER(
              TRIM(
                COALESCE(
                  i.company,
                  ''
                )
              )
            ) = LOWER(TRIM(?))
            AND LOWER(
              TRIM(
                COALESCE(
                  da.company,
                  ''
                )
              )
            ) = LOWER(TRIM(?))
            AND COALESCE(
              e.archived,
              0
            ) = 0
            AND LOWER(
              TRIM(
                COALESCE(
                  e.status,
                  ''
                )
              )
            ) <> 'inactive'
            AND NOT EXISTS (
              SELECT 1
              FROM deployment_assignments
                AS da_conflict
              WHERE
                da_conflict.employee_id =
                  i.employee_id
                AND da_conflict.status =
                  'Active'
                AND da_conflict.id <>
                  da.id
            )
          LIMIT 1
          `,
          [
            incidentId,
            assignedCompany,
            assignedCompany,
          ]
        );

    if (
      rows.length === 0
    ) {
      return res.status(404).json({
        success: false,
        error:
          "Incident not found.",
      });
    }

    return next();
  } catch (error) {
    console.error(
      "INCIDENT WORKFLOW SCOPE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Unable to verify incident workflow authorization.",
    });
  }
}

module.exports = {
  authorizeIncidentWorkflowScope,
};
