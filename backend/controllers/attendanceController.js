"use strict";

const db = require("../config/db");

const {
  createSignedDownloadUrl,
} = require("../services/storageService");

const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

const ATTENDANCE_STATUSES = new Map([
  ["unmarked", "Unmarked"],
  ["present", "Present"],
  ["late", "Late"],
  ["absent", "Absent"],
  ["on leave", "On Leave"],
  ["rest day", "Rest Day"],
]);

const ATTENDANCE_SOURCES = new Set([
  "coordinator",
  "client",
]);

const MAX_NOTE_LENGTH = 2000;
const MAX_HISTORY_LIMIT = 100;

function clean(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
}

function normalizeRole(value) {
  return clean(value)
    .toUpperCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

function positiveInteger(value) {
  const raw =
    clean(value);

  if (
    !/^\d+$/.test(raw)
  ) {
    return null;
  }

  const parsed =
    Number(raw);

  return (
    Number.isSafeInteger(parsed) &&
    parsed > 0
  )
    ? parsed
    : null;
}

function normalizeDate(value) {
  const raw =
    clean(value);

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/
      .exec(raw);

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const probe =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return raw;
}

function getManilaToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const values =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ]
      )
    );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(
  isoDate,
  days
) {
  const [
    year,
    month,
    day,
  ] =
    isoDate
      .split("-")
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + days
      )
    );

  return [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    ),

    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    ),
  ].join("-");
}

function normalizeStatus(value) {
  const key =
    clean(value)
      .toLowerCase()
      .replace(
        /\s+/g,
        " "
      );

  return (
    ATTENDANCE_STATUSES.get(key) ||
    null
  );
}

function normalizeSource(value) {
  const source =
    clean(value)
      .toLowerCase();

  return ATTENDANCE_SOURCES.has(
    source
  )
    ? source
    : null;
}

function normalizeNote(value) {
  const note =
    clean(value);

  if (!note) {
    return null;
  }

  if (
    note.length >
    MAX_NOTE_LENGTH
  ) {
    const error =
      new Error(
        `Attendance notes may not exceed ${MAX_NOTE_LENGTH} characters.`
      );

    error.statusCode =
      400;

    throw error;
  }

  return note;
}

function getActor(req) {
  const role =
    normalizeRole(
      req?.user?.role
    );

  if (
    role !==
    "HR_COORDINATOR"
  ) {
    const error =
      new Error(
        "Attendance is restricted to HR Coordinators."
      );

    error.statusCode =
      403;

    throw error;
  }

  const company =
    clean(
      req?.user?.assignedCompany ??
      req?.user?.assigned_company
    );

  if (!company) {
    const error =
      new Error(
        "Your HR Coordinator account does not have an assigned company."
      );

    error.statusCode =
      403;

    throw error;
  }

  const userId =
    positiveInteger(
      req?.user?.userId ??
      req?.user?.id
    );

  if (!userId) {
    const error =
      new Error(
        "Authenticated user identity is invalid."
      );

    error.statusCode =
      401;

    throw error;
  }

  return {
    userId,
    company,

    username:
      clean(
        req?.user?.username
      ) ||
      null,

    role:
      clean(
        req?.user?.role
      ) ||
      "HR Coordinator",

    fullName:
      clean(
        req?.user?.fullName ??
        req?.user?.full_name ??
        req?.user?.name
      ) ||
      clean(
        req?.user?.username
      ) ||
      "Unknown User",
  };
}

async function getScopedRoster(
  connection,
  company
) {
  const [
    rows,
  ] =
    await connection.query(
      `
      SELECT
        e.id AS employee_id,

        COALESCE(
          NULLIF(
            TRIM(e.name),
            ''
          ),
          CONCAT(
            'Employee ',
            e.id
          )
        ) AS employee_name,

        da.id AS deployment_assignment_id,

        NULLIF(
          TRIM(da.position),
          ''
        ) AS position

      FROM deployment_assignments AS da

      INNER JOIN employees AS e
        ON e.id =
          da.employee_id

      WHERE
        LOWER(
          TRIM(
            COALESCE(
              da.company,
              ''
            )
          )
        ) =
        LOWER(
          TRIM(?)
        )

        AND LOWER(
          TRIM(
            COALESCE(
              da.status,
              ''
            )
          )
        ) =
          'active'

        AND NOT EXISTS (
          SELECT
            1

          FROM deployment_assignments AS conflicting

          WHERE
            conflicting.employee_id =
              da.employee_id

            AND conflicting.id <>
              da.id

            AND LOWER(
              TRIM(
                COALESCE(
                  conflicting.status,
                  ''
                )
              )
            ) =
              'active'
        )

      ORDER BY
        employee_name ASC,
        e.id ASC
      `,
      [
        company,
      ]
    );

  return rows;
}

function summarize(rows) {
  const summary = {
    total: rows.length,
    unmarked: 0,
    present: 0,
    late: 0,
    absent: 0,
    onLeave: 0,
    restDay: 0,
  };

  for (
    const row of rows
  ) {
    switch (
      row.attendance_status
    ) {
      case "Present":
        summary.present += 1;
        break;

      case "Late":
        summary.late += 1;
        break;

      case "Absent":
        summary.absent += 1;
        break;

      case "On Leave":
        summary.onLeave += 1;
        break;

      case "Rest Day":
        summary.restDay += 1;
        break;

      default:
        summary.unmarked += 1;
        break;
    }
  }

  return summary;
}

function mapEntry(row) {
  return {
    id:
      row.id,

    employeeId:
      row.employee_id,

    employeeName:
      row.employee_name,

    deploymentAssignmentId:
      row.deployment_assignment_id,

    position:
      row.position ||
      "Not Assigned",

    status:
      row.attendance_status,

    note:
      row.note ||
      "",
  };
}

function sendError(
  res,
  error,
  label
) {
  const status =
    Number(
      error?.statusCode ||
      500
    );

  if (
    status >= 500
  ) {
    console.error(
      `${label} ERROR:`,
      error
    );
  }

  return res
    .status(status)
    .json({
      success: false,

      error:
        status >= 500
          ? "Attendance operation failed."
          : error.message,
    });
}

exports.getAttendanceByDate =
  async (
    req,
    res
  ) => {
    try {
      const actor =
        getActor(req);

      const date =
        normalizeDate(
          req.query?.date
        );

      if (!date) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "A valid attendance date in YYYY-MM-DD format is required.",
          });
      }

      const [
        batches,
      ] =
        await db
          .promise()
          .query(
            `
            SELECT
              ab.id,

              DATE_FORMAT(
                ab.attendance_date,
                '%Y-%m-%d'
              ) AS attendance_date,

              ab.source,
              ab.created_at,
              ab.updated_at,

              EXISTS (
                SELECT
                  1

                FROM attendance_evidence AS evidence

                WHERE
                  evidence.batch_id =
                    ab.id
              ) AS has_evidence

            FROM attendance_batches AS ab

            WHERE
              LOWER(
                TRIM(ab.company)
              ) =
              LOWER(
                TRIM(?)
              )

              AND ab.attendance_date =
                ?

            LIMIT 1
            `,
            [
              actor.company,
              date,
            ]
          );

      if (
        batches.length ===
        0
      ) {
        return res.json({
          success: true,
          attendance: null,
        });
      }

      const batch =
        batches[0];

      const [
        entries,
      ] =
        await db
          .promise()
          .query(
            `
            SELECT
              id,
              employee_id,
              deployment_assignment_id,
              employee_name,
              position,
              attendance_status,
              note

            FROM attendance_entries

            WHERE
              batch_id =
                ?

            ORDER BY
              employee_name ASC,
              employee_id ASC
            `,
            [
              batch.id,
            ]
          );

      return res.json({
        success: true,

        attendance: {
          id:
            batch.id,

          date:
            batch.attendance_date,

          company:
            actor.company,

          source:
            batch.source,

          createdAt:
            batch.created_at,

          updatedAt:
            batch.updated_at,

          hasEvidence:
            Boolean(
              batch.has_evidence
            ),

          summary:
            summarize(
              entries
            ),

          entries:
            entries.map(
              mapEntry
            ),
        },
      });
    } catch (
      error
    ) {
      return sendError(
        res,
        error,
        "GET ATTENDANCE"
      );
    }
  };

exports.saveAttendance =
  async (
    req,
    res
  ) => {
    let connection =
      null;

    try {
      const actor =
        getActor(req);

      const date =
        normalizeDate(
          req.body?.attendanceDate ??
          req.body?.attendance_date ??
          req.body?.date
        );

      const source =
        normalizeSource(
          req.body?.source
        );

      if (!date) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "A valid attendance date in YYYY-MM-DD format is required.",
          });
      }

      if (
        date >
        getManilaToday()
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Future attendance dates are not allowed.",
          });
      }

      if (!source) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Attendance source must be coordinator or client.",
          });
      }

      const finalizedFiles =
        Array.isArray(
          req.files
        )
          ? req.files
          : [];

      let evidenceFile =
        null;

      if (
        source ===
        "client"
      ) {
        if (
          finalizedFiles.length !==
            1 ||
          finalizedFiles[0]
            ?.fieldname !==
            "attendanceEvidence"
        ) {
          return res
            .status(400)
            .json({
              success: false,

              code:
                "CLIENT_EVIDENCE_REQUIRED",

              error:
                "A verified client attendance image is required before saving client-provided attendance.",
            });
        }

        evidenceFile =
          finalizedFiles[0];
      } else if (
        finalizedFiles.length >
        0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            code:
              "UNEXPECTED_ATTENDANCE_EVIDENCE",

            error:
              "Attendance evidence may only be attached when the source is client.",
          });
      }

      const rawEntries =
        req.body?.entries;

      if (
        !Array.isArray(
          rawEntries
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Attendance entries must be an array.",
          });
      }

      const entries = [];
      const seen =
        new Set();

      for (
        const input of
        rawEntries
      ) {
        const employeeId =
          positiveInteger(
            input?.employeeId ??
            input?.employee_id ??
            input?.id
          );

        if (!employeeId) {
          return res
            .status(400)
            .json({
              success: false,

              error:
                "Every attendance entry requires a valid employee ID.",
            });
        }

        if (
          seen.has(
            employeeId
          )
        ) {
          return res
            .status(400)
            .json({
              success: false,

              error:
                `Employee ${employeeId} appears more than once.`,
            });
        }

        const status =
          normalizeStatus(
            input?.status ??
            input?.attendanceStatus ??
            input?.attendance_status
          );

        if (!status) {
          return res
            .status(400)
            .json({
              success: false,

              error:
                `Employee ${employeeId} has an invalid attendance status.`,
            });
        }

        seen.add(
          employeeId
        );

        entries.push({
          employeeId,
          status,

          note:
            normalizeNote(
              input?.note
            ),
        });
      }

      connection =
        await db
          .promise()
          .getConnection();

      await connection
        .beginTransaction();

      const roster =
        await getScopedRoster(
          connection,
          actor.company
        );

      if (
        roster.length ===
        0
      ) {
        const error =
          new Error(
            "No eligible active employees are currently assigned to your company."
          );

        error.statusCode =
          409;

        throw error;
      }

      if (
        entries.length !==
        roster.length
      ) {
        const error =
          new Error(
            "Attendance must include every employee in the current assigned-company roster."
          );

        error.statusCode =
          409;

        throw error;
      }

      const rosterByEmployee =
        new Map(
          roster.map(
            (row) => [
              Number(
                row.employee_id
              ),
              row,
            ]
          )
        );

      for (
        const entry of
        entries
      ) {
        if (
          !rosterByEmployee.has(
            entry.employeeId
          )
        ) {
          const error =
            new Error(
              "Attendance contains an employee outside your assigned-company workforce."
            );

          error.statusCode =
            403;

          throw error;
        }
      }

      const [
        batchResult,
      ] =
        await connection.query(
          `
          INSERT INTO attendance_batches
          (
            company,
            attendance_date,
            source,
            created_by_user_id
          )
          VALUES (?, ?, ?, ?)
          `,
          [
            actor.company,
            date,
            source,
            actor.userId,
          ]
        );

      const batchId =
        Number(
          batchResult.insertId
        );

      const savedRows = [];

      for (
        const entry of
        entries
      ) {
        const employee =
          rosterByEmployee.get(
            entry.employeeId
          );

        await connection.query(
          `
          INSERT INTO attendance_entries
          (
            batch_id,
            employee_id,
            deployment_assignment_id,
            employee_name,
            position,
            attendance_status,
            note
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            batchId,
            entry.employeeId,
            employee.deployment_assignment_id,
            employee.employee_name,
            employee.position ||
              null,
            entry.status,
            entry.note,
          ]
        );

        savedRows.push({
          attendance_status:
            entry.status,
        });
      }

      if (evidenceFile) {
        const objectPath =
          String(
            evidenceFile.storagePath ||
            evidenceFile.path ||
            ""
          ).trim();

        const originalName =
          String(
            evidenceFile.originalname ||
            ""
          ).trim();

        const mimeType =
          String(
            evidenceFile.mimetype ||
            ""
          ).trim();

        const fileSize =
          Number(
            evidenceFile.size
          );

        if (
          !objectPath ||
          !originalName ||
          !mimeType ||
          !Number.isSafeInteger(
            fileSize
          ) ||
          fileSize <= 0
        ) {
          const error =
            new Error(
              "Verified attendance evidence metadata is incomplete."
            );

          error.statusCode =
            400;

          throw error;
        }

        await connection.query(
          `
          INSERT INTO attendance_evidence
          (
            batch_id,
            object_path,
            original_name,
            mime_type,
            file_size,
            uploaded_by_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            batchId,
            objectPath,
            originalName,
            mimeType,
            fileSize,
            actor.userId,
          ]
        );
      }

      await logAudit(
        {
          userId:
            actor.userId,

          username:
            actor.username,

          role:
            actor.role,

          fullName:
            actor.fullName,

          category:
            AUDIT_CATEGORY.OPERATIONAL,

          action:
            "SAVE_ATTENDANCE",

          description:
            `Saved attendance for ${actor.company} on ${date} for ${savedRows.length} employee(s).`,
        },
        {
          connection,
          throwOnError: true,
        }
      );

      await connection
        .commit();

      if (
        evidenceFile &&
        typeof req
          .claimAttendanceEvidenceFile ===
          "function"
      ) {
        req.claimAttendanceEvidenceFile();
      }

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Attendance saved successfully.",

          attendance: {
            id:
              batchId,

            company:
              actor.company,

            date,
            source,

            hasEvidence:
              Boolean(
                evidenceFile
              ),

            summary:
              summarize(
                savedRows
              ),
          },
        });
    } catch (
      error
    ) {
      if (connection) {
        try {
          await connection
            .rollback();
        } catch (
          rollbackError
        ) {
          console.error(
            "ATTENDANCE ROLLBACK ERROR:",
            rollbackError
          );
        }
      }

      if (
        error?.code ===
        "ER_DUP_ENTRY"
      ) {
        error.statusCode =
          409;

        error.message =
          "Attendance for this company and date has already been saved.";
      }

      return sendError(
        res,
        error,
        "SAVE ATTENDANCE"
      );
    } finally {
      if (connection) {
        connection.release();
      }
    }
  };

exports.getAttendanceHistory =
  async (
    req,
    res
  ) => {
    try {
      const actor =
        getActor(req);

      const from =
        req.query?.from
          ? normalizeDate(
              req.query.from
            )
          : null;

      const to =
        req.query?.to
          ? normalizeDate(
              req.query.to
            )
          : null;

      if (
        req.query?.from &&
        !from
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Invalid from date.",
          });
      }

      if (
        req.query?.to &&
        !to
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Invalid to date.",
          });
      }

      if (
        from &&
        to &&
        from > to
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "The from date may not be later than the to date.",
          });
      }

      const requestedLimit =
        Number(
          req.query?.limit ??
          30
        );

      const limit =
        (
          Number.isSafeInteger(
            requestedLimit
          ) &&
          requestedLimit > 0
        )
          ? Math.min(
              requestedLimit,
              MAX_HISTORY_LIMIT
            )
          : 30;

      const conditions = [
        "LOWER(TRIM(ab.company)) = LOWER(TRIM(?))",
      ];

      const params = [
        actor.company,
      ];

      if (from) {
        conditions.push(
          "ab.attendance_date >= ?"
        );

        params.push(from);
      }

      if (to) {
        conditions.push(
          "ab.attendance_date <= ?"
        );

        params.push(to);
      }

      const [
        rows,
      ] =
        await db
          .promise()
          .query(
            `
            SELECT
              ab.id,

              DATE_FORMAT(
                ab.attendance_date,
                '%Y-%m-%d'
              ) AS attendance_date,

              ab.source,
              ab.created_at,

              COUNT(
                ae.id
              ) AS total_count,

              SUM(
                ae.attendance_status =
                  'Unmarked'
              ) AS unmarked_count,

              SUM(
                ae.attendance_status =
                  'Present'
              ) AS present_count,

              SUM(
                ae.attendance_status =
                  'Late'
              ) AS late_count,

              SUM(
                ae.attendance_status =
                  'Absent'
              ) AS absent_count,

              SUM(
                ae.attendance_status =
                  'On Leave'
              ) AS on_leave_count,

              SUM(
                ae.attendance_status =
                  'Rest Day'
              ) AS rest_day_count,

              EXISTS (
                SELECT
                  1

                FROM attendance_evidence AS evidence

                WHERE
                  evidence.batch_id =
                    ab.id
              ) AS has_evidence

            FROM attendance_batches AS ab

            LEFT JOIN attendance_entries AS ae
              ON ae.batch_id =
                ab.id

            WHERE
              ${conditions.join(
                " AND "
              )}

            GROUP BY
              ab.id,
              ab.attendance_date,
              ab.source,
              ab.created_at

            ORDER BY
              ab.attendance_date DESC,
              ab.id DESC

            LIMIT ${limit}
            `,
            params
          );

      return res.json({
        success: true,

        company:
          actor.company,

        history:
          rows.map(
            (row) => ({
              id:
                row.id,

              date:
                row.attendance_date,

              source:
                row.source,

              createdAt:
                row.created_at,

              hasEvidence:
                Boolean(
                  row.has_evidence
                ),

              summary: {
                total:
                  Number(
                    row.total_count ||
                    0
                  ),

                unmarked:
                  Number(
                    row.unmarked_count ||
                    0
                  ),

                present:
                  Number(
                    row.present_count ||
                    0
                  ),

                late:
                  Number(
                    row.late_count ||
                    0
                  ),

                absent:
                  Number(
                    row.absent_count ||
                    0
                  ),

                onLeave:
                  Number(
                    row.on_leave_count ||
                    0
                  ),

                restDay:
                  Number(
                    row.rest_day_count ||
                    0
                  ),
              },
            })
          ),
      });
    } catch (
      error
    ) {
      return sendError(
        res,
        error,
        "GET ATTENDANCE HISTORY"
      );
    }
  };

exports.getAttendanceHistoryDetail =
  async (
    req,
    res
  ) => {
    try {
      const actor =
        getActor(req);

      const id =
        positiveInteger(
          req.params?.id
        );

      if (!id) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid attendance record ID.",
          });
      }

      const [
        batches,
      ] =
        await db
          .promise()
          .query(
            `
            SELECT
              ab.id,

              DATE_FORMAT(
                ab.attendance_date,
                '%Y-%m-%d'
              ) AS attendance_date,

              ab.source,
              ab.created_at,
              ab.updated_at,

              EXISTS (
                SELECT
                  1

                FROM attendance_evidence AS evidence

                WHERE
                  evidence.batch_id =
                    ab.id
              ) AS has_evidence

            FROM attendance_batches AS ab

            WHERE
              ab.id =
                ?

              AND LOWER(
                TRIM(ab.company)
              ) =
              LOWER(
                TRIM(?)
              )

            LIMIT 1
            `,
            [
              id,
              actor.company,
            ]
          );

      if (
        batches.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Attendance record not found.",
          });
      }

      const [
        entries,
      ] =
        await db
          .promise()
          .query(
            `
            SELECT
              id,
              employee_id,
              deployment_assignment_id,
              employee_name,
              position,
              attendance_status,
              note

            FROM attendance_entries

            WHERE
              batch_id =
                ?

            ORDER BY
              employee_name ASC,
              employee_id ASC
            `,
            [
              id,
            ]
          );

      const batch =
        batches[0];

      return res.json({
        success: true,

        attendance: {
          id:
            batch.id,

          date:
            batch.attendance_date,

          company:
            actor.company,

          source:
            batch.source,

          createdAt:
            batch.created_at,

          updatedAt:
            batch.updated_at,

          hasEvidence:
            Boolean(
              batch.has_evidence
            ),

          summary:
            summarize(
              entries
            ),

          entries:
            entries.map(
              mapEntry
            ),
        },
      });
    } catch (
      error
    ) {
      return sendError(
        res,
        error,
        "GET ATTENDANCE DETAIL"
      );
    }
  };

exports.getAttendancePerformance =
  async (
    req,
    res
  ) => {
    try {
      const actor =
        getActor(req);

      const defaultTo =
        getManilaToday();

      const defaultFrom =
        addDays(
          defaultTo,
          -29
        );

      const from =
        req.query?.from
          ? normalizeDate(
              req.query.from
            )
          : defaultFrom;

      const to =
        req.query?.to
          ? normalizeDate(
              req.query.to
            )
          : defaultTo;

      if (
        !from ||
        !to ||
        from > to
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "A valid performance date range is required.",
          });
      }

      const [
        rows,
      ] =
        await db
          .promise()
          .query(
            `
            SELECT
              ae.employee_id,

              MAX(
                ae.employee_name
              ) AS employee_name,

              MAX(
                ae.position
              ) AS position,

              COUNT(*) AS total_records,

              SUM(
                ae.attendance_status =
                  'Unmarked'
              ) AS unmarked_count,

              SUM(
                ae.attendance_status =
                  'Present'
              ) AS present_count,

              SUM(
                ae.attendance_status =
                  'Late'
              ) AS late_count,

              SUM(
                ae.attendance_status =
                  'Absent'
              ) AS absent_count,

              SUM(
                ae.attendance_status =
                  'On Leave'
              ) AS on_leave_count,

              SUM(
                ae.attendance_status =
                  'Rest Day'
              ) AS rest_day_count

            FROM attendance_entries AS ae

            INNER JOIN attendance_batches AS ab
              ON ab.id =
                ae.batch_id

            WHERE
              LOWER(
                TRIM(ab.company)
              ) =
              LOWER(
                TRIM(?)
              )

              AND ab.attendance_date >=
                ?

              AND ab.attendance_date <=
                ?

            GROUP BY
              ae.employee_id

            ORDER BY
              employee_name ASC,
              ae.employee_id ASC
            `,
            [
              actor.company,
              from,
              to,
            ]
          );

      const employees =
        rows.map(
          (row) => {
            const present =
              Number(
                row.present_count ||
                0
              );

            const late =
              Number(
                row.late_count ||
                0
              );

            const absent =
              Number(
                row.absent_count ||
                0
              );

            const eligibleDays =
              present +
              late +
              absent;

            const attendedDays =
              present +
              late;

            return {
              employeeId:
                row.employee_id,

              employeeName:
                row.employee_name,

              position:
                row.position ||
                "Not Assigned",

              totalRecords:
                Number(
                  row.total_records ||
                  0
                ),

              unmarked:
                Number(
                  row.unmarked_count ||
                  0
                ),

              present,
              late,
              absent,

              onLeave:
                Number(
                  row.on_leave_count ||
                  0
                ),

              restDay:
                Number(
                  row.rest_day_count ||
                  0
                ),

              eligibleDays,
              attendedDays,

              attendanceRate:
                eligibleDays > 0
                  ? Number(
                      (
                        (
                          attendedDays /
                          eligibleDays
                        ) *
                        100
                      ).toFixed(2)
                    )
                  : null,
            };
          }
        );

      const summary = {
        totalRecords: 0,
        unmarked: 0,
        present: 0,
        late: 0,
        absent: 0,
        onLeave: 0,
        restDay: 0,
        eligibleDays: 0,
        attendedDays: 0,
        attendanceRate: null,
      };

      for (
        const employee of
        employees
      ) {
        summary.totalRecords +=
          employee.totalRecords;

        summary.unmarked +=
          employee.unmarked;

        summary.present +=
          employee.present;

        summary.late +=
          employee.late;

        summary.absent +=
          employee.absent;

        summary.onLeave +=
          employee.onLeave;

        summary.restDay +=
          employee.restDay;

        summary.eligibleDays +=
          employee.eligibleDays;

        summary.attendedDays +=
          employee.attendedDays;
      }

      if (
        summary.eligibleDays >
        0
      ) {
        summary.attendanceRate =
          Number(
            (
              (
                summary.attendedDays /
                summary.eligibleDays
              ) *
              100
            ).toFixed(2)
          );
      }

      return res.json({
        success: true,

        company:
          actor.company,

        from,
        to,

        formula: {
          numerator:
            "Present + Late",

          denominator:
            "Present + Late + Absent",

          excluded: [
            "On Leave",
            "Rest Day",
            "Unmarked",
          ],
        },

        summary,
        employees,
      });
    } catch (
      error
    ) {
      return sendError(
        res,
        error,
        "GET ATTENDANCE PERFORMANCE"
      );
    }
  };


exports.getAttendanceEvidence =
  async (
    req,
    res
  ) => {
    try {
      const actor =
        getActor(req);

      const batchId =
        positiveInteger(
          req.params?.id
        );

      if (!batchId) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Invalid attendance record ID.",
          });
      }

      const [
        rows,
      ] =
        await db
          .promise()
          .query(
            `
            SELECT
              evidence.object_path,
              evidence.original_name,
              evidence.mime_type,
              evidence.file_size,
              evidence.created_at

            FROM attendance_evidence AS evidence

            INNER JOIN attendance_batches AS batch
              ON batch.id =
                evidence.batch_id

            WHERE
              batch.id =
                ?

              AND LOWER(
                TRIM(
                  batch.company
                )
              ) =
              LOWER(
                TRIM(?)
              )

            LIMIT 1
            `,
            [
              batchId,
              actor.company,
            ]
          );

      if (
        rows.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "Attendance evidence was not found.",
          });
      }

      const evidence =
        rows[0];

      const signed =
        await createSignedDownloadUrl(
          evidence.object_path,
          {
            expiresIn:
              60,
          }
        );

      return res.json({
        success:
          true,

        evidence: {
          batchId,

          originalName:
            evidence.original_name,

          mimeType:
            evidence.mime_type,

          fileSize:
            Number(
              evidence.file_size
            ),

          createdAt:
            evidence.created_at,

          signedUrl:
            signed.signedUrl,

          expiresIn:
            signed.expiresIn,
        },
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "GET ATTENDANCE EVIDENCE"
      );
    }
  };



/*
 * ==================================================
 * INDIVIDUAL EMPLOYEE ATTENDANCE HISTORY
 * ==================================================
 *
 * HR Coordinator only through attendanceRoutes.
 *
 * Scope is derived from the authenticated
 * coordinator's assigned company.
 *
 * This endpoint deliberately reads historical
 * Attendance snapshots instead of current browser
 * state so previous Late/Absent/etc. remain visible.
 */

exports.getEmployeeAttendanceHistory =
  async (
    req,
    res
  ) => {
    try {
      const actor =
        getActor(req);

      const employeeId =
        positiveInteger(
          req.params
            ?.employeeId
        );

      if (!employeeId) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Invalid employee ID.",
          });
      }


      const requestedLimit =
        Number(
          req.query?.limit ??
          365
        );

      const limit =
        Number.isSafeInteger(
          requestedLimit
        ) &&
        requestedLimit > 0
          ? Math.min(
              requestedLimit,
              500
            )
          : 365;


      const [
        rows,
      ] =
        await db
          .promise()
          .query(
            `
            SELECT
              ae.id,

              ae.employee_id,

              ae.employee_name,

              ae.position,

              ae.attendance_status,

              ae.note,

              ab.id AS batch_id,

              DATE_FORMAT(
                ab.attendance_date,
                '%Y-%m-%d'
              ) AS attendance_date,

              ab.source,

              ab.created_at,

              EXISTS (
                SELECT
                  1

                FROM attendance_evidence AS evidence

                WHERE
                  evidence.batch_id =
                    ab.id
              ) AS has_evidence

            FROM attendance_entries AS ae

            INNER JOIN attendance_batches AS ab
              ON ab.id =
                ae.batch_id

            WHERE
              ae.employee_id =
                ?

              AND LOWER(
                TRIM(
                  ab.company
                )
              ) =
              LOWER(
                TRIM(?)
              )

            ORDER BY
              ab.attendance_date DESC,
              ae.id DESC

            LIMIT ${limit}
            `,
            [
              employeeId,
              actor.company,
            ]
          );


      if (
        rows.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "No Attendance history was found for this employee in your assigned company.",
          });
      }


      const summary =
        summarize(
          rows
        );

      const eligibleDays =
        summary.present +
        summary.late +
        summary.absent;

      const attendedDays =
        summary.present +
        summary.late;

      const attendanceRate =
        eligibleDays > 0
          ? Number(
              (
                (
                  attendedDays /
                  eligibleDays
                ) *
                100
              ).toFixed(2)
            )
          : null;


      const latest =
        rows[0];


      return res.json({
        success:
          true,

        company:
          actor.company,

        employee: {
          employeeId,

          employeeName:
            latest.employee_name,

          position:
            latest.position ||
            "Not Assigned",
        },

        summary: {
          ...summary,

          eligibleDays,

          attendedDays,

          attendanceRate,
        },

        history:
          rows.map(
            (row) => ({
              id:
                row.id,

              batchId:
                row.batch_id,

              date:
                row.attendance_date,

              status:
                row.attendance_status,

              source:
                row.source,

              note:
                row.note ||
                "",

              hasEvidence:
                Boolean(
                  row.has_evidence
                ),

              createdAt:
                row.created_at,
            })
          ),
      });
    } catch (
      error
    ) {
      return sendError(
        res,
        error,
        "GET EMPLOYEE ATTENDANCE HISTORY"
      );
    }
  };
