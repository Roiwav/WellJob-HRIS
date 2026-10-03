"use strict";

/*
 * WELLJOB AUTHORITATIVE CURRENT WORKFORCE
 *
 * Shared by Dashboard and KPI/DSS.
 *
 * Included:
 * - Deployed
 * - Active Deployed
 * - Floating / Standby
 * - Floating/Standby
 * - Floating
 * - Standby
 *
 * Employee must also be archived = 0.
 */

const WORKFORCE_SCOPE_KEY =
  "CURRENT_NON_ARCHIVED_DEPLOYED_OR_FLOATING_V1";


const DEPLOYED_STATUSES =
  Object.freeze([
    "deployed",
    "active deployed",
  ]);


const FLOATING_STATUSES =
  Object.freeze([
    "floating / standby",
    "floating/standby",
    "floating",
    "standby",
  ]);


const CURRENT_WORKFORCE_STATUSES =
  Object.freeze([
    ...DEPLOYED_STATUSES,
    ...FLOATING_STATUSES,
  ]);


function normalizeStatusText(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}


function isDeployedStatus(
  status
) {
  return DEPLOYED_STATUSES.includes(
    normalizeStatusText(
      status
    )
  );
}


function isFloatingStatus(
  status
) {
  return FLOATING_STATUSES.includes(
    normalizeStatusText(
      status
    )
  );
}


function isCurrentWorkforceStatus(
  status
) {
  return CURRENT_WORKFORCE_STATUSES.includes(
    normalizeStatusText(
      status
    )
  );
}


function buildCurrentWorkforceStatusSql(
  columnExpression
) {
  const column =
    String(
      columnExpression || ""
    ).trim();


  if (
    !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(
      column
    )
  ) {
    throw new Error(
      "Invalid workforce-status SQL column."
    );
  }


  const values =
    CURRENT_WORKFORCE_STATUSES
      .map(
        (status) =>
          `'${status.replace(
            /'/g,
            "''"
          )}'`
      )
      .join(", ");


  return `LOWER(TRIM(COALESCE(${column}, ''))) IN (${values})`;
}


module.exports = {
  WORKFORCE_SCOPE_KEY,

  CURRENT_WORKFORCE_STATUSES,

  normalizeStatusText,

  isDeployedStatus,

  isFloatingStatus,

  isCurrentWorkforceStatus,

  buildCurrentWorkforceStatusSql,
};
