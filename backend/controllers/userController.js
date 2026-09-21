const bcrypt = require("bcrypt");

const { randomBytes } = require("node:crypto");
const {
  sendAccountCredentials,
} = require("../utils/accountCredentialsMailer");
const db = require("../config/db");
const { logAudit } = require("../utils/auditLogger");
const {
  isValidName,
  generateAccountCredentials,
} = require("../utils/helpers");

const SUPPORTED_ACCOUNT_ROLES = new Set([
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
  "HR_COORDINATOR",
  "IT_SUPPORT",
]);

const CREATABLE_ACCOUNT_ROLES = new Set([
  "HR_MANAGER",
  "HR_STAFF",
  "HR_COORDINATOR",
  "IT_SUPPORT",
]);

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/* Email is initially unverified. Only a completed email-link flow may
 * populate email_verified_at; administrative registration must not do so. */
function parseRecoveryEmail(value) {
  if (value === undefined || value === null || value === "") {
    return { valid: true, email: null };
  }
  if (typeof value !== "string") return { valid: false, email: null };
  const email = value.trim().toLowerCase();
  if (!email) return { valid: true, email: null };
  const valid = email.length <= 254 &&
    /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email) &&
    !email.split("@")[1].split(".").some(part => part.startsWith("-") || part.endsWith("-"));
  return { valid, email: valid ? email : null };
}

function normalizeRole(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const aliases = {
    SUPERADMIN: "SUPER_ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
    HRMANAGER: "HR_MANAGER",
    HR_MANAGER: "HR_MANAGER",
    HRSTAFF: "HR_STAFF",
    HR_STAFF: "HR_STAFF",
    HRCOORDINATOR: "HR_COORDINATOR",
    HR_COORDINATOR: "HR_COORDINATOR",
    ITSUPPORT: "IT_SUPPORT",
    IT_SUPPORT: "IT_SUPPORT",
  };

  return aliases[normalized] || normalized;
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCompany(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

  return normalized || null;
}

function parsePositiveUserId(value) {
  const normalized = String(value ?? "").trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const numericId = Number(normalized);

  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    return null;
  }

  return numericId;
}

function isValidPassword(value) {
  if (
    typeof value !== "string" ||
    value.length < PASSWORD_MIN_LENGTH ||
    value.length > PASSWORD_MAX_LENGTH
  ) {
    return false;
  }

  return (
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[!@#$%^&*()_+]/.test(value)
  );
}

async function getCanonicalAuthenticatedUser(req) {
  const authenticatedId = parsePositiveUserId(
    req.user?.id ?? req.user?.userId
  );

  if (!authenticatedId) {
    return null;
  }

  const [rows] = await db.promise().query(
    `
    SELECT
      id,
      user_id,
      full_name,
      username,
      role,
      assigned_company,
      status
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [authenticatedId]
  );

  if (rows.length === 0) {
    return null;
  }

  const user = rows[0];

  return {
    ...user,
    role: normalizeRole(user.role),
    assigned_company: normalizeCompany(user.assigned_company),
    status: normalizeStatus(user.status),
  };
}

function toAuditActor(user) {
  const username = String(user?.username || "").trim();

  return {
    userId: user?.user_id ?? user?.id,
    username,
    fullName:
      String(user?.full_name || "").trim() ||
      username ||
      "Authenticated User",
    role: normalizeRole(user?.role),
  };
}

function canManageTargetAccount({
  requester,
  target,
}) {
  if (!requester || requester.status !== "ACTIVE") {
    return {
      allowed: false,
      status: 403,
      message:
        "Your account is not allowed to perform account-management actions.",
    };
  }

  if (
    !SUPPORTED_ACCOUNT_ROLES.has(requester.role) ||
    !SUPPORTED_ACCOUNT_ROLES.has(target.role)
  ) {
    return {
      allowed: false,
      status: 403,
      message:
        "This account-management action is not permitted.",
    };
  }

  if (Number(requester.id) === Number(target.id)) {
    return {
      allowed: false,
      status: 403,
      message:
        "Administrative account actions cannot target your own account.",
    };
  }

  if (target.role === "SUPER_ADMIN") {
    return {
      allowed: false,
      status: 403,
      message:
        "Super Admin accounts cannot be managed through this endpoint.",
    };
  }

  if (requester.role === "SUPER_ADMIN") {
    return {
      allowed: true,
    };
  }

  /*
   * Preserve the existing IT Support authority:
   * IT Support may manage HR Staff only.
   *
   * HR Coordinator is intentionally excluded.
   */
  if (
    requester.role === "IT_SUPPORT" &&
    target.role === "HR_STAFF"
  ) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    status: 403,
    message:
      "You are not allowed to manage this account.",
  };
}

/*
 * ==================================================
 * COMPANY MASTER HELPERS
 * ==================================================
 *
 * client_companies is the authoritative source for
 * selectable client-company options.
 *
 * Existing operational string fields remain intact
 * for backward compatibility and historical scope:
 *
 * - users.assigned_company
 * - employees.company
 * - deployment_assignments.company
 * - incidents.company
 *
 * New HR Coordinator assignments may only reference
 * ACTIVE records from client_companies.
 */
async function getCanonicalCompanyName(value) {
  const requestedCompany =
    normalizeCompany(value);

  if (!requestedCompany) {
    return null;
  }

  const [rows] =
    await db.promise().query(
      `
      SELECT
        id,
        company_name
      FROM client_companies
      WHERE is_active = 1
        AND LOWER(TRIM(company_name)) = LOWER(?)
      LIMIT 1
      `,
      [requestedCompany]
    );

  if (rows.length === 0) {
    return null;
  }

  return normalizeCompany(
    rows[0].company_name
  );
}

async function listCanonicalCompanies() {
  const [rows] =
    await db.promise().query(
      `
      SELECT
        company_name
      FROM client_companies
      WHERE is_active = 1
      ORDER BY company_name ASC
      `
    );

  const companies = [];
  const seen = new Set();

  for (const row of rows) {
    const company =
      normalizeCompany(
        row.company_name
      );

    if (!company) {
      continue;
    }

    const key =
      company.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    companies.push(company);
  }

  return companies;
}

/*
 * ==================================================
 * GET USERS
 * ==================================================
 */

exports.getUsers = async (req, res) => {
  try {
    const requester = await getCanonicalAuthenticatedUser(req);

    if (
      !requester ||
      requester.status !== "ACTIVE" ||
      !["SUPER_ADMIN", "IT_SUPPORT"].includes(requester.role)
    ) {
      return res.status(403).json({
        message: "Access denied.",
      });
    }

    const isSuperAdmin = requester.role === "SUPER_ADMIN";

    const [users] = await db.promise().query(
      `
      SELECT
        id,
        user_id,
        full_name,
        username,
        email,
        email_verified_at,
        role,
        assigned_company,
        status,
        must_change_password,
        account_credentials_delivery_status
      FROM users
      ORDER BY id DESC
      `
    );

    return res.json(
      users.map((user) => {
        const assignedCompany = normalizeCompany(
          user.assigned_company
        );

        const deliveryStatus =
          user.account_credentials_delivery_status ?? null;

        const recoveryEmail = parseRecoveryEmail(user.email);

        const canResendInitialCredentials =
          isSuperAdmin &&
          normalizeStatus(user.status) === "INACTIVE" &&
          deliveryStatus === "FAILED" &&
          Number(user.must_change_password) === 1 &&
          CREATABLE_ACCOUNT_ROLES.has(
            normalizeRole(user.role)
          ) &&
          recoveryEmail.valid &&
          Boolean(recoveryEmail.email);

        /*
         * Do not expose internal password-change state
         * or credentials-delivery details to IT Support.
         *
         * The resend controller independently verifies
         * eligibility; this frontend flag is for display
         * purposes only.
         */
        const {
          email_verified_at: verifiedAt,
          must_change_password: _mustChangePassword,
          account_credentials_delivery_status:
            _internalDeliveryStatus,
          ...safeUser
        } = user;

        return {
          ...safeUser,

          email: isSuperAdmin ? user.email : null,

          email_verified:
            isSuperAdmin &&
            Boolean(user.email && verifiedAt),

          assigned_company: assignedCompany,
          assignedCompany,

          account_credentials_delivery_status:
            isSuperAdmin ? deliveryStatus : null,

          can_resend_initial_credentials:
            canResendInitialCredentials,
        };
      })
    );
  } catch (_error) {
    console.error("FETCH USERS ERROR.");

    return res.status(500).json({
      message: "Fetch users error",
    });
  }
};

/*
 * ==================================================
 * GET COMPANY OPTIONS
 * ==================================================
 *
 * Used by the Super Admin Portal when assigning or
 * transferring an HR Coordinator to a client.
 *
 * Only ACTIVE client companies are returned.
 */

exports.getCompanyOptions =
  async (
    req,
    res
  ) => {
    try {
      const requester =
        await getCanonicalAuthenticatedUser(
          req
        );

      if (!requester) {
        return res
          .status(401)
          .json({
            message:
              "Authenticated account not found.",
          });
      }

      if (
        requester.status !== "ACTIVE" ||
        requester.role !== "SUPER_ADMIN"
      ) {
        return res
          .status(403)
          .json({
            message:
              "Only Super Admin can view HR Coordinator company assignment options.",
          });
      }

      const companies =
        await listCanonicalCompanies();

      return res.json({
        companies,
      });
    } catch (error) {
      console.error(
        "FETCH COMPANY OPTIONS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            "Fetch company options error",
        });
    }
  };

/*
 * ==================================================
 * CREATE USER
 * ==================================================
 */

/*
 * ==================================================
 * CREATE USER
 * ==================================================
 *
 * Security rules:
 * - Only Super Admin can create accounts.
 * - A valid recipient email is required.
 * - The backend generates the temporary password.
 * - Never trust or use a password supplied by the browser.
 * - Never return credentials in the API response.
 * - Keep the account inactive until SMTP accepts the
 *   credentials email.
 */

exports.createUser = async (req, res) => {
  const { name, role } = req.body || {};

  const requestedAssignedCompany =
    req.body?.assignedCompany ??
    req.body?.assigned_company;

  const recoveryEmail = parseRecoveryEmail(
    req.body?.email
  );

  try {
    /*
     * --------------------------------------------------
     * VALIDATE ACCOUNT DETAILS
     * --------------------------------------------------
     */

    if (!recoveryEmail.valid || !recoveryEmail.email) {
      return res.status(400).json({
        message:
          "A valid recovery email address is required to send the new user's account credentials.",
      });
    }

    const trimmedName = String(name || "").trim();
    const normalizedRole = normalizeRole(role);

    if (!trimmedName) {
      return res.status(400).json({
        message: "Full name is required.",
      });
    }

    if (!isValidName(trimmedName)) {
      return res.status(400).json({
        message: "Full name must contain letters only.",
      });
    }

    if (!CREATABLE_ACCOUNT_ROLES.has(normalizedRole)) {
      return res.status(400).json({
        message:
          "A valid creatable account role is required.",
      });
    }

    /*
     * --------------------------------------------------
     * AUTHORIZE SUPER ADMIN
     * --------------------------------------------------
     */

    const requester =
      await getCanonicalAuthenticatedUser(req);

    if (!requester) {
      return res.status(401).json({
        message: "Authenticated account not found.",
      });
    }

    if (
      requester.status !== "ACTIVE" ||
      requester.role !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        message:
          "Only Super Admin can create system user accounts.",
      });
    }

    /*
     * --------------------------------------------------
     * VALIDATE HR COORDINATOR COMPANY ASSIGNMENT
     * --------------------------------------------------
     */

    let assignedCompany = null;

    if (normalizedRole === "HR_COORDINATOR") {
      assignedCompany = await getCanonicalCompanyName(
        requestedAssignedCompany
      );

      if (!assignedCompany) {
        return res.status(400).json({
          message:
            "A valid active company assignment is required for an HR Coordinator account.",
        });
      }
    } else if (normalizeCompany(requestedAssignedCompany)) {
      return res.status(400).json({
        message:
          "Company assignment can only be set for HR Coordinator accounts.",
      });
    }

    /*
     * --------------------------------------------------
     * GENERATE CREDENTIALS ON THE SERVER ONLY
     * --------------------------------------------------
     *
     * Ignore req.body.temporaryPassword if submitted
     * by an older frontend.
     */

    const { userId, username } =
      await generateAccountCredentials(normalizedRole);

    const temporaryPassword =
      `${randomBytes(24).toString("base64url")}Aa1!`;

    const passwordHash = await bcrypt.hash(
      temporaryPassword,
      10
    );

    /*
     * --------------------------------------------------
     * INSERT INACTIVE ACCOUNT WITH PENDING DELIVERY
     * --------------------------------------------------
     */

    let insertedUserId;

    try {
      const [insertResult] = await db.promise().query(
        `
        INSERT INTO users
        (
          user_id,
          full_name,
          username,
          email,
          password,
          role,
          assigned_company,
          status,
          must_change_password,
          account_credentials_delivery_status
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'Inactive',
          1,
          'PENDING'
        )
        `,
        [
          userId,
          trimmedName,
          username,
          recoveryEmail.email,
          passwordHash,
          normalizedRole,
          assignedCompany,
        ]
      );

      insertedUserId = insertResult.insertId;
    } catch (error) {
      if (
        error?.code === "ER_DUP_ENTRY" &&
        String(error?.sqlMessage || "").includes(
          "uq_users_email"
        )
      ) {
        return res.status(409).json({
          message:
            "This recovery email is already registered.",
        });
      }

      if (error?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message:
            "An account identifier is already in use. Refresh the account list and try again.",
        });
      }

      console.error(
        "CREATE USER DATABASE INSERT FAILED."
      );

      return res.status(500).json({
        message:
          "Unable to create the account. No credentials email was sent.",
      });
    }

    /*
     * --------------------------------------------------
     * CLAIM THE INITIAL DELIVERY ATTEMPT
     * --------------------------------------------------
     *
     * If this update fails, do not attempt to send.
     * The account remains Inactive for investigation.
     */

    try {
      const [sendingResult] = await db.promise().query(
        `
        UPDATE users
        SET account_credentials_delivery_status = 'SENDING'
        WHERE id = ?
          AND status = 'Inactive'
          AND account_credentials_delivery_status = 'PENDING'
        `,
        [insertedUserId]
      );

      if (Number(sendingResult.affectedRows) !== 1) {
        console.error(
          "CREATE USER DELIVERY CLAIM NOT APPLIED."
        );

        return res.status(503).json({
          message:
            "The account was saved as inactive, but credentials delivery could not be started. Do not create the account again. Contact WELLJOB IT Support.",
        });
      }
    } catch (_error) {
      console.error(
        "CREATE USER DELIVERY CLAIM FAILED."
      );

      return res.status(503).json({
        message:
          "The account was saved as inactive, but credentials delivery could not be started. Do not create the account again. Contact WELLJOB IT Support.",
      });
    }

    /*
     * --------------------------------------------------
     * SEND CREDENTIALS TO THE REGISTERED EMAIL
     * --------------------------------------------------
     *
     * Never return, print, or audit-log the temporary
     * password.
     *
     * A mailer error does not always prove that the
     * recipient received nothing. A future resend must
     * generate a NEW password and invalidate the old one.
     */

    try {
      await sendAccountCredentials({
        to: recoveryEmail.email,
        fullName: trimmedName,
        userId,
        username,
        role: normalizedRole,
        assignedCompany,
        temporaryPassword,
      });
    } catch (_error) {
      console.error(
        "CREATE USER EMAIL DELIVERY FAILED."
      );

      let failureStatusRecorded = false;

      try {
        const [failedResult] = await db.promise().query(
          `
          UPDATE users
          SET account_credentials_delivery_status = 'FAILED'
          WHERE id = ?
            AND status = 'Inactive'
            AND account_credentials_delivery_status = 'SENDING'
          `,
          [insertedUserId]
        );

        failureStatusRecorded =
          Number(failedResult.affectedRows) === 1;
      } catch (_statusError) {
        console.error(
          "CREATE USER DELIVERY FAILURE STATUS UPDATE FAILED."
        );
      }

      if (!failureStatusRecorded) {
        return res.status(503).json({
          message:
            "Credentials delivery encountered an error, but the account's delivery status could not be confirmed. Do not create the account again or attempt to resend credentials. Contact WELLJOB IT Support.",
        });
      }

      return res.status(503).json({
        message:
          "The account was saved as inactive, but its credentials email could not be sent successfully. Do not create the account again. Contact WELLJOB IT Support to resolve the delivery issue.",
      });
    }

    /*
     * --------------------------------------------------
     * RECORD SMTP ACCEPTANCE BEFORE ACTIVATION
     * --------------------------------------------------
     *
     * SMTP_ACCEPTED means the SMTP server accepted
     * the message; it does not guarantee inbox delivery.
     *
     * If this database update fails after the mailer
     * succeeds, leave the account Inactive. Do not mark
     * it FAILED and do not automatically resend.
     */

    let smtpAcceptanceRecorded = false;

    try {
      const [acceptedResult] = await db.promise().query(
        `
        UPDATE users
        SET account_credentials_delivery_status = 'SMTP_ACCEPTED'
        WHERE id = ?
          AND status = 'Inactive'
          AND account_credentials_delivery_status = 'SENDING'
        `,
        [insertedUserId]
      );

      smtpAcceptanceRecorded =
        Number(acceptedResult.affectedRows) === 1;
    } catch (_error) {
      console.error(
        "CREATE USER SMTP ACCEPTANCE STATUS UPDATE FAILED."
      );
    }

    if (!smtpAcceptanceRecorded) {
      return res.status(503).json({
        message:
          "The credentials email was accepted for delivery, but the account's delivery status could not be saved. The account remains inactive. Do not create the account again or resend credentials. Contact WELLJOB IT Support.",
      });
    }

    /*
     * --------------------------------------------------
     * ACTIVATE AFTER RECORDED SMTP ACCEPTANCE
     * --------------------------------------------------
     */

    let activationSucceeded = false;

    try {
      const [activationResult] = await db.promise().query(
        `
        UPDATE users
        SET status = 'Active'
        WHERE id = ?
          AND status = 'Inactive'
          AND email = ?
          AND account_credentials_delivery_status = 'SMTP_ACCEPTED'
        `,
        [
          insertedUserId,
          recoveryEmail.email,
        ]
      );

      activationSucceeded =
        Number(activationResult.affectedRows) === 1;
    } catch (_error) {
      console.error(
        "CREATE USER ACTIVATION FAILED."
      );
    }

    if (!activationSucceeded) {
      return res.status(503).json({
        message:
          "The credentials email was accepted for delivery, but the account could not be activated. Do not create the account again or resend credentials. Contact WELLJOB IT Support.",
      });
    }

    /*
     * --------------------------------------------------
     * AUDIT SUCCESS WITHOUT EXPOSING CREDENTIALS
     * --------------------------------------------------
     */

    const actor = toAuditActor(requester);

    try {
      await logAudit({
        userId: actor.userId,
        username: actor.username,
        fullName: actor.fullName,
        role: actor.role,
        action: "CREATE_USER",
        description:
          normalizedRole === "HR_COORDINATOR"
            ? `${actor.fullName} created HR Coordinator account for ${trimmedName} (${username}) assigned to ${assignedCompany}. Credentials email accepted for delivery.`
            : `${actor.fullName} created account for ${trimmedName} (${username}, ${normalizedRole}). Credentials email accepted for delivery.`,
      });
    } catch (_error) {
      console.error(
        "CREATE USER AUDIT LOG FAILED."
      );
    }

    /*
     * --------------------------------------------------
     * ADMIN RESPONSE: CONFIRMATION ONLY
     * --------------------------------------------------
     */

    return res.status(201).json({
      message:
        "Account created. Credentials email accepted for delivery.",
    });
  } catch (_error) {
    console.error(
      "CREATE USER UNEXPECTED ERROR."
    );

    return res.status(500).json({
      message:
        "Unable to complete account creation. Check the account list before trying again.",
    });
  }
};

/*
 * ==================================================
 * REGISTER / UPDATE RECOVERY EMAIL - SUPER ADMIN ONLY
 * ==================================================
 * This DOES NOT verify email ownership or send an email.
 * Changing/clearing the address revokes outstanding recovery links
 * and authenticated sessions. Email verification is added with SMTP.
 */
exports.updateRecoveryEmail = async (req, res) => {
  const targetId = parsePositiveUserId(req.params?.id);
  if (!targetId) return res.status(400).json({ message: "A valid user ID is required." });
  const requested = parseRecoveryEmail(req.body?.email);
  if (!requested.valid) {
    return res.status(400).json({ message: "Enter a valid recovery email address (maximum 254 characters)." });
  }
  try {
    const requester = await getCanonicalAuthenticatedUser(req);
    if (!requester) return res.status(401).json({ message: "Authenticated account not found." });
    if (requester.status !== "ACTIVE" || requester.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Only Super Admin can manage recovery email addresses." });
    }
    const [users] = await db.promise().query(
      `SELECT id, user_id, full_name, username, role, email, email_verified_at, token_version
       FROM users WHERE id = ? LIMIT 1`, [targetId]
    );
    if (!users.length) return res.status(404).json({ message: "User not found." });
    const target = users[0];
    if (target.id === requester.id || normalizeRole(target.role) === "SUPER_ADMIN") {
      return res.status(403).json({ message: "Super Admin recovery email cannot be changed through this endpoint." });
    }
    const previousEmail = target.email || null;
    if (previousEmail === requested.email) {
      return res.json({ message: "Recovery email is already up to date.",
        email: previousEmail, email_verified: Boolean(previousEmail && target.email_verified_at), unchanged: true });
    }
    const [result] = await db.promise().query(
      `UPDATE users SET
         email = ?,
         email_verified_at = NULL,
         email_verification_token_hash = NULL,
         email_verification_expires_at = NULL,
         email_verification_requested_at = NULL,
         password_reset_token_hash = NULL,
         password_reset_expires_at = NULL,
         password_reset_requested_at = NULL,
         token_version = token_version + 1
       WHERE id = ? AND token_version = ? AND (email <=> ?)`,
      [requested.email, targetId, target.token_version, previousEmail]
    );
    if (result.affectedRows !== 1) {
      return res.status(409).json({ message: "The account changed. Refresh and try again." });
    }
    const actor = toAuditActor(requester);
    await logAudit({ userId: actor.userId, username: actor.username,
      fullName: actor.fullName, role: actor.role, action: "UPDATE_RECOVERY_EMAIL",
      description: `${actor.fullName} updated the recovery email registration for ${target.full_name} (${target.username}).` });
    return res.json({ message: "Recovery email saved. The account owner must verify it before password recovery is available.",
      email: requested.email, email_verified: false, unchanged: false });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY" &&
        String(error?.sqlMessage || "").includes("uq_users_email")) {
      return res.status(409).json({ message: "This recovery email is already registered." });
    }
    console.error("UPDATE RECOVERY EMAIL ERROR:", error);
    return res.status(500).json({ message: "Unable to update recovery email." });
  }
};

/*
 * ==================================================
 * UPDATE HR COORDINATOR COMPANY ASSIGNMENT
 * ==================================================
 *
 * Super Admin only.
 *
 * Changing the assignment increments token_version
 * so the coordinator's current session is invalidated.
 *
 * The destination company must be ACTIVE in the
 * System Configuration company master.
 */

exports.updateAssignedCompany =
  async (
    req,
    res
  ) => {
    const targetId =
      parsePositiveUserId(
        req.params?.id
      );

    const requestedAssignedCompany =
      req.body?.assignedCompany ??
      req.body?.assigned_company;

    if (!targetId) {
      return res
        .status(400)
        .json({
          message:
            "A valid user ID is required.",
        });
    }

    try {
      const requester =
        await getCanonicalAuthenticatedUser(
          req
        );

      if (!requester) {
        return res
          .status(401)
          .json({
            message:
              "Authenticated account not found.",
          });
      }

      if (
        requester.status !== "ACTIVE" ||
        requester.role !== "SUPER_ADMIN"
      ) {
        return res
          .status(403)
          .json({
            message:
              "Only Super Admin can change an HR Coordinator company assignment.",
          });
      }

      if (
        Number(requester.id) ===
        Number(targetId)
      ) {
        return res
          .status(403)
          .json({
            message:
              "Administrative account actions cannot target your own account.",
          });
      }

      const [users] =
        await db.promise().query(
          `
          SELECT
            id,
            user_id,
            full_name,
            username,
            role,
            assigned_company,
            status
          FROM users
          WHERE id = ?
          LIMIT 1
          `,
          [targetId]
        );

      if (
        users.length === 0
      ) {
        return res
          .status(404)
          .json({
            message:
              "User not found",
          });
      }

      const target = {
        ...users[0],

        role:
          normalizeRole(
            users[0].role
          ),

        assigned_company:
          normalizeCompany(
            users[0].assigned_company
          ),

        status:
          normalizeStatus(
            users[0].status
          ),
      };

      if (
        target.role !==
        "HR_COORDINATOR"
      ) {
        return res
          .status(400)
          .json({
            message:
              "Company assignment can only be changed for HR Coordinator accounts.",
          });
      }

      const assignedCompany =
        await getCanonicalCompanyName(
          requestedAssignedCompany
        );

      if (!assignedCompany) {
        return res
          .status(400)
          .json({
            message:
              "A valid active company assignment is required.",
          });
      }

      /*
       * No DB update or session invalidation if
       * nothing actually changed.
       */
      if (
        String(
          target.assigned_company ||
            ""
        ).toLowerCase() ===
        assignedCompany.toLowerCase()
      ) {
        return res.json({
          message:
            "Company assignment is already up to date.",

          assigned_company:
            assignedCompany,

          assignedCompany,
        });
      }

      /*
       * The previous assigned_company value is also
       * checked to prevent silently overwriting a
       * concurrent administrative reassignment.
       */
      const [result] =
        await db.promise().query(
          `
          UPDATE users
          SET
            assigned_company = ?,
            token_version =
              token_version + 1
          WHERE id = ?
            AND role =
              'HR_COORDINATOR'
            AND COALESCE(
              assigned_company,
              ''
            ) = ?
          `,
          [
            assignedCompany,
            targetId,
            target.assigned_company ||
              "",
          ]
        );

      if (
        result.affectedRows !==
        1
      ) {
        return res
          .status(409)
          .json({
            message:
              "The user account changed before the company assignment could be completed. Refresh and try again.",
          });
      }

      const actor =
        toAuditActor(
          requester
        );

      await logAudit({
        userId:
          actor.userId,

        username:
          actor.username,

        fullName:
          actor.fullName,

        role:
          actor.role,

        action:
          "ASSIGN_HR_COORDINATOR_COMPANY",

        description:
          `${actor.fullName} reassigned ${target.full_name} (${target.username}) ` +
          `from ${target.assigned_company || "Unassigned"} to ${assignedCompany}.`,
      });

      return res.json({
        message:
          "HR Coordinator company assignment updated.",

        assigned_company:
          assignedCompany,

        assignedCompany,
      });
    } catch (error) {
      console.error(
        "UPDATE ASSIGNED COMPANY ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            "Update company assignment error",
        });
    }
  };

/*
 * ==================================================
 * RESET PASSWORD
 * ==================================================
 */

exports.resetPassword =
  async (
    req,
    res
  ) => {
    const targetId =
      parsePositiveUserId(
        req.params?.id
      );

    const {
      temporaryPassword,
    } =
      req.body || {};

    if (!targetId) {
      return res
        .status(400)
        .json({
          message:
            "A valid user ID is required.",
        });
    }

    if (
      typeof temporaryPassword !== "string" ||
      temporaryPassword.length <
        PASSWORD_MIN_LENGTH ||
      temporaryPassword.length >
        PASSWORD_MAX_LENGTH
    ) {
      return res
        .status(400)
        .json({
          message:
            "A valid temporary password is required.",
        });
    }

    try {
      const requester =
        await getCanonicalAuthenticatedUser(
          req
        );

      if (!requester) {
        return res
          .status(401)
          .json({
            message:
              "Authenticated account not found.",
          });
      }

      const [users] =
        await db.promise().query(
          `
          SELECT
            id,
            user_id,
            full_name,
            username,
            role,
            status
          FROM users
          WHERE id = ?
          LIMIT 1
          `,
          [targetId]
        );

      if (
        users.length === 0
      ) {
        return res
          .status(404)
          .json({
            message:
              "User not found",
          });
      }

      const user = {
        ...users[0],

        role:
          normalizeRole(
            users[0].role
          ),

        status:
          normalizeStatus(
            users[0].status
          ),
      };

      const permission =
        canManageTargetAccount({
          requester,
          target:
            user,
        });

      if (
        !permission.allowed
      ) {
        return res
          .status(
            permission.status ||
              403
          )
          .json({
            message:
              permission.message ||
              "This account-management action is not permitted.",
          });
      }

      const actor =
        toAuditActor(
          requester
        );

      const hash =
        await bcrypt.hash(
          temporaryPassword,
          10
        );

      const [result] =
        await db.promise().query(
          `
          UPDATE users
          SET
            password = ?,
            must_change_password = 1,
            password_reset_token_hash = NULL,
            password_reset_expires_at = NULL,
            password_reset_requested_at = NULL,
            token_version =
              token_version + 1
          WHERE id = ?
          `,
          [
            hash,
            targetId,
          ]
        );

      if (
        result.affectedRows !==
        1
      ) {
        return res
          .status(409)
          .json({
            message:
              "The user account changed before the password reset could be completed. Refresh and try again.",
          });
      }

      await logAudit({
        userId:
          actor.userId,

        username:
          actor.username,

        fullName:
          actor.fullName,

        role:
          actor.role,

        action:
          "RESET_PASSWORD",

        description:
          `${actor.fullName} reset the password for ${user.full_name} (${user.username}).`,
      });

      return res.json({
        message:
          "Password reset",
      });
    } catch (error) {
      console.error(
        "RESET PASSWORD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            "Reset error",
        });
    }
  };

/*
 * ==================================================
 * TOGGLE USER STATUS
 * ==================================================
 */

exports.toggleStatus = async (req, res) => {
  const targetId = parsePositiveUserId(req.params?.id);

  if (!targetId) {
    return res.status(400).json({
      message: "A valid user ID is required.",
    });
  }

  try {
    const requester = await getCanonicalAuthenticatedUser(req);

    if (!requester) {
      return res.status(401).json({
        message: "Authenticated account not found.",
      });
    }

    const [users] = await db.promise().query(
      `
      SELECT
        id,
        user_id,
        full_name,
        username,
        role,
        status,
        account_credentials_delivery_status
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [targetId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const user = {
      ...users[0],
      role: normalizeRole(users[0].role),
      status: normalizeStatus(users[0].status),
    };

    const permission = canManageTargetAccount({
      requester,
      target: user,
    });

    if (!permission.allowed) {
      return res.status(permission.status || 403).json({
        message:
          permission.message ||
          "This account-management action is not permitted.",
      });
    }

    if (user.status !== "ACTIVE" && user.status !== "INACTIVE") {
      return res.status(409).json({
        message: "User account has an unsupported status.",
      });
    }

    const newStatus =
      user.status === "ACTIVE" ? "Inactive" : "Active";

    /*
     * Never activate an account while its initial
     * credentials delivery is PENDING, SENDING, or FAILED.
     *
     * NULL is allowed for accounts created before
     * credentials-delivery tracking was introduced.
     *
     * An intentionally deactivated account whose initial
     * credentials delivery was SMTP_ACCEPTED can still
     * be reactivated through the existing admin workflow.
     */
    if (
      newStatus === "Active" &&
      user.account_credentials_delivery_status !== null &&
      user.account_credentials_delivery_status !==
        "SMTP_ACCEPTED"
    ) {
      return res.status(409).json({
        message:
          "This account cannot be activated because its initial credentials delivery is incomplete or failed. Resolve credentials delivery before activating the account.",
      });
    }

    const actor = toAuditActor(requester);

    /*
     * Repeat the delivery-status condition in the UPDATE.
     * This prevents activation if delivery status changes
     * between the earlier SELECT and this database write.
     */
    const [result] = await db.promise().query(
      `
      UPDATE users
      SET
        status = ?,
        password_reset_token_hash = NULL,
        password_reset_expires_at = NULL,
        password_reset_requested_at = NULL,
        email_verification_token_hash = NULL,
        email_verification_expires_at = NULL,
        email_verification_requested_at = NULL,
        token_version = token_version + 1
      WHERE id = ?
        AND UPPER(TRIM(status)) = ?
        AND (
          ? = 'Inactive'
          OR account_credentials_delivery_status IS NULL
          OR account_credentials_delivery_status = 'SMTP_ACCEPTED'
        )
      `,
      [
        newStatus,
        targetId,
        user.status,
        newStatus,
      ]
    );

    if (Number(result.affectedRows) !== 1) {
      return res.status(409).json({
        message:
          "The account status or credentials-delivery state changed before this action could be completed. Refresh the account list and try again.",
      });
    }

    try {
      await logAudit({
        userId: actor.userId,
        username: actor.username,
        fullName: actor.fullName,
        role: actor.role,
        action: "TOGGLE_STATUS",
        description:
          `${actor.fullName} changed ${user.full_name} ` +
          `(${user.username}) to ${newStatus}.`,
      });
    } catch (_error) {
      console.error("TOGGLE USER STATUS AUDIT LOG FAILED.");
    }

    return res.json({
      status: newStatus,
    });
  } catch (_error) {
    console.error("TOGGLE USER STATUS ERROR.");

    return res.status(500).json({
      message: "Unable to change the account status.",
    });
  }
};

/*
 * ==================================================
 * CHANGE OWN PASSWORD
 * ==================================================
 */

exports.changePassword =
  async (
    req,
    res
  ) => {
    const authenticatedUserId =
      parsePositiveUserId(
        req.user?.id ??
          req.user?.userId
      );

    const {
      currentPassword,
      newPassword,
    } =
      req.body || {};

    if (
      !authenticatedUserId
    ) {
      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "A verified authenticated user is required.",
        });
    }

    if (
      typeof currentPassword !== "string" ||
      !currentPassword
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Current password is required.",
        });
    }

    if (
      !isValidPassword(
        newPassword
      )
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "New password must be 8 to 128 characters long and include uppercase, lowercase, number, and special character.",
        });
    }

    if (
      currentPassword ===
      newPassword
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Use a password different from your current password.",
        });
    }

    try {
      const [users] =
        await db.promise().query(
          `
          SELECT
            id,
            user_id,
            full_name,
            username,
            password,
            role,
            status,
            token_version
          FROM users
          WHERE id = ?
          LIMIT 1
          `,
          [
            authenticatedUserId,
          ]
        );

      if (
        users.length === 0
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "User not found",
          });
      }

      const user =
        users[0];

      if (
        normalizeStatus(
          user.status
        ) !==
        "ACTIVE"
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "Inactive accounts cannot change passwords.",
          });
      }

      const isMatch =
        await bcrypt.compare(
          currentPassword,
          user.password
        );

      if (!isMatch) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Incorrect current password",
          });
      }

      const hash =
        await bcrypt.hash(
          newPassword,
          10
        );

      /*
       * Password change and session revocation occur
       * in the same database update.
       */
      const [result] =
        await db.promise().query(
          `
          UPDATE users
          SET
            password = ?,
            must_change_password = 0,
            password_reset_token_hash = NULL,
            password_reset_expires_at = NULL,
            password_reset_requested_at = NULL,
            token_version =
              token_version + 1
          WHERE id = ?
            AND token_version = ?
            AND UPPER(
              TRIM(status)
            ) = 'ACTIVE'
          `,
          [
            hash,
            user.id,
            user.token_version,
          ]
        );

      if (
        result.affectedRows !==
        1
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Your account changed before the password update could be completed. Please sign in again and retry.",
          });
      }

      await logAudit({
        userId:
          user.user_id,

        username:
          user.username,

        fullName:
          user.full_name,

        role:
          user.role,

        action:
          "CHANGE_PASSWORD",

        description:
          `${user.full_name || user.username} successfully changed their password.`,
      });

      return res.json({
        success: true,

        message:
          "Password updated successfully. Please sign in again using your new password.",
      });
    } catch (error) {
      console.error(
        "CHANGE PASSWORD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Error changing password",
        });
    }
  };

/*
 * ==================================================
 * RESEND INITIAL ACCOUNT CREDENTIALS
 * ==================================================
 *
 * SUPER_ADMIN ONLY.
 *
 * Eligible target:
 * - Inactive
 * - Initial credentials delivery status is FAILED
 * - Must still change initial password
 * - Has a valid registered recovery email
 *
 * Generates a new password on the server.
 * Never returns credentials to the administrator.
 */
exports.resendAccountCredentials = async (req, res) => {
  const targetId = parsePositiveUserId(req.params?.id);

  if (!targetId) {
    return res.status(400).json({
      message: "A valid user ID is required.",
    });
  }

  try {
    const requester = await getCanonicalAuthenticatedUser(req);

    if (!requester) {
      return res.status(401).json({
        message: "Authenticated account not found.",
      });
    }

    if (
      requester.status !== "ACTIVE" ||
      requester.role !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        message:
          "Only Super Admin can resend initial account credentials.",
      });
    }

    const [users] = await db.promise().query(
      `
      SELECT
        id,
        user_id,
        full_name,
        username,
        email,
        role,
        assigned_company,
        status,
        must_change_password,
        account_credentials_delivery_status
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [targetId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const target = users[0];

    const targetRole = normalizeRole(target.role);
    const targetStatus = normalizeStatus(target.status);
    const recoveryEmail = parseRecoveryEmail(target.email);

    if (
      targetStatus !== "INACTIVE" ||
      target.account_credentials_delivery_status !== "FAILED" ||
      Number(target.must_change_password) !== 1 ||
      !CREATABLE_ACCOUNT_ROLES.has(targetRole) ||
      !recoveryEmail.valid ||
      !recoveryEmail.email
    ) {
      return res.status(409).json({
        message:
          "This account is not eligible for initial credentials resend. Refresh the account list and check its delivery status.",
      });
    }

    /*
     * Generate a NEW temporary password before claiming
     * the resend. The administrator never supplies or
     * receives the password.
     */
    const temporaryPassword =
      `${randomBytes(24).toString("base64url")}Aa1!`;

    const passwordHash = await bcrypt.hash(
      temporaryPassword,
      10
    );

    /*
     * Atomically claim the FAILED account for delivery.
     *
     * The conditions prevent simultaneous resend
     * requests from sending multiple valid passwords.
     *
     * The new password replaces the old one BEFORE
     * sending, so any earlier credentials email becomes
     * invalid if it arrives late.
     */
    const [claimResult] = await db.promise().query(
      `
      UPDATE users
      SET
        account_credentials_delivery_status = 'SENDING',
        password = ?,
        must_change_password = 1,
        password_reset_token_hash = NULL,
        password_reset_expires_at = NULL,
        password_reset_requested_at = NULL,
        email_verification_token_hash = NULL,
        email_verification_expires_at = NULL,
        email_verification_requested_at = NULL,
        token_version = token_version + 1
      WHERE id = ?
        AND status = 'Inactive'
        AND account_credentials_delivery_status = 'FAILED'
        AND must_change_password = 1
        AND email = ?
        AND role = ?
        AND assigned_company <=> ?
      `,
      [
        passwordHash,
        targetId,
        recoveryEmail.email,
        target.role,
        target.assigned_company,
      ]
    );

    if (Number(claimResult.affectedRows) !== 1) {
      return res.status(409).json({
        message:
          "The account changed or another credentials resend is already in progress. Refresh the account list.",
      });
    }

    /*
     * Send credentials exclusively to the registered
     * account email. Do not log the temporary password.
     */
    try {
      await sendAccountCredentials({
        to: recoveryEmail.email,
        fullName: target.full_name,
        userId: target.user_id,
        username: target.username,
        role: targetRole,
        assignedCompany: target.assigned_company,
        temporaryPassword,
      });
    } catch (_error) {
      console.error(
        "RESEND ACCOUNT CREDENTIALS EMAIL DELIVERY FAILED."
      );

      let failureStatusRecorded = false;

      try {
        const [failedResult] = await db.promise().query(
          `
          UPDATE users
          SET account_credentials_delivery_status = 'FAILED'
          WHERE id = ?
            AND status = 'Inactive'
            AND account_credentials_delivery_status = 'SENDING'
            AND password = ?
            AND email = ?
          `,
          [
            targetId,
            passwordHash,
            recoveryEmail.email,
          ]
        );

        failureStatusRecorded =
          Number(failedResult.affectedRows) === 1;
      } catch (_statusError) {
        console.error(
          "RESEND ACCOUNT CREDENTIALS FAILURE STATUS UPDATE FAILED."
        );
      }

      if (!failureStatusRecorded) {
        return res.status(503).json({
          message:
            "Credentials delivery failed, and the account's delivery status could not be confirmed. Do not retry yet. Contact WELLJOB IT Support.",
        });
      }

      return res.status(503).json({
        message:
          "The credentials email could not be sent successfully. The account remains inactive. Check the email service before trying again.",
      });
    }

    /*
     * SMTP acceptance does not guarantee inbox delivery.
     * Record acceptance BEFORE activating the account.
     */
    let acceptanceRecorded = false;

    try {
      const [acceptedResult] = await db.promise().query(
        `
        UPDATE users
        SET account_credentials_delivery_status = 'SMTP_ACCEPTED'
        WHERE id = ?
          AND status = 'Inactive'
          AND account_credentials_delivery_status = 'SENDING'
          AND password = ?
          AND email = ?
        `,
        [
          targetId,
          passwordHash,
          recoveryEmail.email,
        ]
      );

      acceptanceRecorded =
        Number(acceptedResult.affectedRows) === 1;
    } catch (_error) {
      console.error(
        "RESEND ACCOUNT CREDENTIALS SMTP ACCEPTANCE UPDATE FAILED."
      );
    }

    if (!acceptanceRecorded) {
      return res.status(503).json({
        message:
          "The credentials email was accepted for delivery, but the account's delivery state could not be saved. Do not resend again. Contact WELLJOB IT Support.",
      });
    }

    /*
     * Activate ONLY the same account whose new password
     * and registered email still match this resend.
     */
    let activationSucceeded = false;

    try {
      const [activationResult] = await db.promise().query(
        `
        UPDATE users
        SET status = 'Active'
        WHERE id = ?
          AND status = 'Inactive'
          AND account_credentials_delivery_status = 'SMTP_ACCEPTED'
          AND password = ?
          AND email = ?
          AND must_change_password = 1
        `,
        [
          targetId,
          passwordHash,
          recoveryEmail.email,
        ]
      );

      activationSucceeded =
        Number(activationResult.affectedRows) === 1;
    } catch (_error) {
      console.error(
        "RESEND ACCOUNT CREDENTIALS ACTIVATION FAILED."
      );
    }

    if (!activationSucceeded) {
      return res.status(503).json({
        message:
          "The credentials email was accepted for delivery, but the account could not be activated. Do not resend again. Contact WELLJOB IT Support.",
      });
    }

    /*
     * Audit the successful administrative action
     * without including the temporary password.
     */
    const actor = toAuditActor(requester);

    try {
      await logAudit({
        userId: actor.userId,
        username: actor.username,
        fullName: actor.fullName,
        role: actor.role,
        action: "RESEND_ACCOUNT_CREDENTIALS",
        description:
          `${actor.fullName} resent initial account credentials ` +
          `for ${target.full_name} (${target.username}). ` +
          "Credentials email accepted for delivery.",
      });
    } catch (_error) {
      console.error(
        "RESEND ACCOUNT CREDENTIALS AUDIT LOG FAILED."
      );
    }

    return res.status(200).json({
      message:
        "New account credentials email accepted for delivery. The account is now active.",
    });
  } catch (_error) {
    console.error(
      "RESEND ACCOUNT CREDENTIALS UNEXPECTED ERROR."
    );

    return res.status(500).json({
      message:
        "Unable to complete credentials resend. Refresh the account list before trying again.",
    });
  }
};