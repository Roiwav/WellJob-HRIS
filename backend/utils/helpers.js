const db = require("../config/db");

/*
 * ==================================================
 * NAME VALIDATION
 * ==================================================
 */
function isValidName(name) {
  return /^[A-Za-z\s.'-]+$/.test(name);
}

/*
 * ==================================================
 * GENERATE ACCOUNT CREDENTIALS
 * ==================================================
 *
 * Generates sequential internal account IDs:
 *
 * HR_STAFF       -> HR01, HR02, ...
 * HR_MANAGER     -> HM01, HM02, ...
 * HR_COORDINATOR -> HC01, HC02, ...
 * IT_SUPPORT     -> IT01, IT02, ...
 *
 * Username equivalents:
 *
 * HR_STAFF       -> hr01, hr02, ...
 * HR_MANAGER     -> hm01, hm02, ...
 * HR_COORDINATOR -> hc01, hc02, ...
 * IT_SUPPORT     -> it01, it02, ...
 */
async function generateAccountCredentials(
  role
) {
  const ROLE_PREFIX = {
    HR_STAFF: "HR",
    HR_MANAGER: "HM",
    HR_COORDINATOR: "HC",
    IT_SUPPORT: "IT",
  };

  const USERNAME_PREFIX = {
    HR_STAFF: "hr",
    HR_MANAGER: "hm",
    HR_COORDINATOR: "hc",
    IT_SUPPORT: "it",
  };

  const userPrefix =
    ROLE_PREFIX[role];

  const usernamePrefix =
    USERNAME_PREFIX[role];

  /*
   * Fail safely if an unsupported role reaches
   * this helper.
   */
  if (
    !userPrefix ||
    !usernamePrefix
  ) {
    throw new Error(
      `Unsupported account role: ${role}`
    );
  }

  const [users] =
    await db
      .promise()
      .query(
        `
        SELECT user_id
        FROM users
        WHERE role = ?
          AND user_id LIKE ?
        `,
        [
          role,
          `${userPrefix}%`,
        ]
      );

  const maxNumber =
    users.reduce(
      (
        max,
        user
      ) => {
        const numericPart =
          String(
            user.user_id || ""
          ).replace(
            userPrefix,
            ""
          );

        const parsed =
          Number.parseInt(
            numericPart,
            10
          );

        return Number.isNaN(
          parsed
        )
          ? max
          : Math.max(
              max,
              parsed
            );
      },
      0
    );

  const nextNumber =
    maxNumber + 1;

  const padded =
    String(
      nextNumber
    ).padStart(
      2,
      "0"
    );

  return {
    userId:
      `${userPrefix}${padded}`,

    username:
      `${usernamePrefix}${padded}`,
  };
}

module.exports = {
  isValidName,
  generateAccountCredentials,
};