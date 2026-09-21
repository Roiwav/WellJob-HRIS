const db = require("../config/db");

const {
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

const AUDIT_PAGE_SIZE_DEFAULT = 25;
const AUDIT_PAGE_SIZE_MAX = 100;

const AUDIT_ROLE = Object.freeze({
  ALL: "ALL",
  SUPER_ADMIN: "SUPER_ADMIN",
  HR_MANAGER: "HR_MANAGER",
  HR_STAFF: "HR_STAFF",
  IT_SUPPORT: "IT_SUPPORT",
});

function cleanCategory(category) {
  const value = String(
    category || ""
  )
    .trim()
    .toUpperCase();

  if (
    value ===
    AUDIT_CATEGORY.TECHNICAL
  ) {
    return AUDIT_CATEGORY.TECHNICAL;
  }

  if (
    value ===
    AUDIT_CATEGORY.OPERATIONAL
  ) {
    return AUDIT_CATEGORY.OPERATIONAL;
  }

  return null;
}

function parsePositiveInteger(
  value,
  fallback
) {
  const parsed =
    Number.parseInt(
      String(value ?? ""),
      10
    );

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
}

function cleanAuditRole(role) {
  const value = String(
    role || AUDIT_ROLE.ALL
  )
    .trim()
    .toUpperCase();

  return Object.values(
    AUDIT_ROLE
  ).includes(value)
    ? value
    : null;
}

function cleanSearch(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function buildAuditFilters({
  category,
  role,
  search,
}) {
  const conditions = [
    "category = ?",
  ];

  const params = [
    category,
  ];

  if (
    role !==
    AUDIT_ROLE.ALL
  ) {
    conditions.push(
      "role = ?"
    );

    params.push(role);
  }

  const searchTerms =
    search
      ? search
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean)
      : [];

  searchTerms.forEach(
    (term) => {
      const pattern =
        `%${term}%`;

      conditions.push(
        `(
          LOWER(COALESCE(user_id, '')) LIKE ?
          OR LOWER(COALESCE(username, '')) LIKE ?
          OR LOWER(COALESCE(full_name, '')) LIKE ?
          OR LOWER(COALESCE(role, '')) LIKE ?
          OR LOWER(COALESCE(action, '')) LIKE ?
          OR LOWER(COALESCE(description, '')) LIKE ?
        )`
      );

      params.push(
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern
      );
    }
  );

  return {
    whereSql:
      conditions.join(
        "\nAND "
      ),
    params,
  };
}

/*
 * ==================================================
 * CATEGORY-SPECIFIC AUDIT LOGS
 * ==================================================
 *
 * This endpoint intentionally uses bounded,
 * server-side pagination for every request.
 *
 * Legacy behavior that returned an entire category
 * as one unbounded array has been retired.
 *
 * `view=summary` remains accepted for compatibility
 * with the current frontend. Omitting `view` now uses
 * the same paginated response shape rather than
 * falling back to a full-history query.
 */
exports.getLogsByCategory =
  async (
    req,
    res
  ) => {
    const category =
      cleanCategory(
        req.params.category
      );

    if (!category) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Invalid audit log category.",
          message:
            "Audit log category must be TECHNICAL or OPERATIONAL.",
        });
    }

    const view = String(
      req.query.view || ""
    )
      .trim()
      .toLowerCase();

    if (
      view &&
      view !== "summary"
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Invalid audit log view.",
          message:
            "Audit log view must be summary when specified.",
        });
    }

    const page =
      parsePositiveInteger(
        req.query.page,
        1
      );

    const requestedPageSize =
      parsePositiveInteger(
        req.query.pageSize,
        AUDIT_PAGE_SIZE_DEFAULT
      );

    const pageSize =
      Math.min(
        requestedPageSize,
        AUDIT_PAGE_SIZE_MAX
      );

    const role =
      cleanAuditRole(
        req.query.role
      );

    if (!role) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Invalid audit log role filter.",
          message:
            "Role must be ALL, SUPER_ADMIN, HR_MANAGER, HR_STAFF, or IT_SUPPORT.",
        });
    }

    const search =
      cleanSearch(
        req.query.search
      );

    const {
      whereSql,
      params,
    } =
      buildAuditFilters({
        category,
        role,
        search,
      });

    const offset =
      (page - 1) *
      pageSize;

    try {
      const [
        recordsResult,
        countResult,
        summaryResult,
      ] =
        await Promise.all([
          db
            .promise()
            .query(
              `
              SELECT
                id,
                user_id,
                username,
                role,
                category,
                action,
                description,
                created_at,
                full_name
              FROM audit_logs
              WHERE ${whereSql}
              ORDER BY
                created_at DESC,
                id DESC
              LIMIT ?
              OFFSET ?
              `,
              [
                ...params,
                pageSize,
                offset,
              ]
            ),

          db
            .promise()
            .query(
              `
              SELECT
                COUNT(*) AS total
              FROM audit_logs
              WHERE ${whereSql}
              `,
              params
            ),

          db
            .promise()
            .query(
              `
              SELECT
                COUNT(*) AS total,
                SUM(role = 'SUPER_ADMIN') AS super_admin,
                SUM(role = 'HR_MANAGER') AS hr_manager,
                SUM(role = 'HR_STAFF') AS hr_staff,
                SUM(role = 'IT_SUPPORT') AS it_support
              FROM audit_logs
              WHERE category = ?
              `,
              [
                category,
              ]
            ),
        ]);

      const records =
        recordsResult[0];

      const total =
        Math.max(
          Number(
            countResult[0]?.[0]
              ?.total || 0
          ),
          0
        );

      const summaryRow =
        summaryResult[0]?.[0] ||
        {};

      const totalPages =
        total > 0
          ? Math.ceil(
              total /
                pageSize
            )
          : 1;

      return res
        .status(200)
        .json({
          records,

          pagination: {
            page,
            pageSize,
            total,
            totalPages,
          },

          summary: {
            total:
              Math.max(
                Number(
                  summaryRow.total ||
                    0
                ),
                0
              ),

            superAdmin:
              Math.max(
                Number(
                  summaryRow.super_admin ||
                    0
                ),
                0
              ),

            hrManager:
              Math.max(
                Number(
                  summaryRow.hr_manager ||
                    0
                ),
                0
              ),

            hrStaff:
              Math.max(
                Number(
                  summaryRow.hr_staff ||
                    0
                ),
                0
              ),

            itSupport:
              Math.max(
                Number(
                  summaryRow.it_support ||
                    0
                ),
                0
              ),
          },

          filters: {
            search,
            role,
          },

          fetchedAt:
            new Date()
              .toISOString(),
        });
    } catch (error) {
      console.error(
        "Fetch Audit Logs Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "Failed to fetch audit logs.",
          message:
            "The requested audit log records could not be retrieved.",
        });
    }
  };
