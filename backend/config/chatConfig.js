
/**
 * ==================================================
 * WELLJOB SOLUTIONS
 * MESSENGER DATABASE CONFIGURATION
 * ==================================================
 *
 * Uses the existing WELLJOB users table.
 *
 * Database table and column identifiers must
 * never come from request parameters or user input.
 */

const config = {
  usersTable: "users",

  // Numeric primary key (AUTO_INCREMENT)
  userIdColumn: "id",

  // Existing username column
  usernameColumn: "username",

  // Existing user role column
  roleColumn: "role",

  // Existing full name column
  fullNameColumn: "full_name",

  /*
   * ==================================================
   * PROFILE PICTURE COLUMN
   * ==================================================
   *
   * This column was added to the existing users table.
   *
   * It contains a server-generated filename such as:
   * 3498551dd71c804b003b92021e5af57a.webp
   *
   * It is NOT a public image URL.
   */
  avatarColumn: "avatar_filename",
};

/**
 * ==================================================
 * VALIDATE STATIC DATABASE IDENTIFIERS
 * ==================================================
 */

for (const [setting, value] of Object.entries(config)) {
  if (
    value !== null &&
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
  ) {
    throw new Error(
      `Invalid static chat DB identifier: ${setting}`
    );
  }
}

/**
 * ==================================================
 * ESCAPE DATABASE IDENTIFIERS
 * ==================================================
 */

const col = (name) => `\`${name}\``;

const table = col(config.usersTable);

/**
 * ==================================================
 * CONSISTENT CHAT USER SELECT
 * ==================================================
 *
 * avatarFilename:
 * Contains the database's avatar_filename value.
 *
 * avatarUrl:
 * Retained temporarily as null for compatibility
 * with the existing Messenger.jsx.
 *
 * A stored filename must not be treated as a
 * publicly accessible image URL.
 *
 * The frontend will fetch the image through:
 *
 * GET /api/users/:id/avatar
 *
 * with the authenticated user's Bearer token.
 */

const userSelect = (alias = "u") =>
  [
    `${alias}.${col(config.userIdColumn)} AS id`,

    `${alias}.${col(config.usernameColumn)} AS username`,

    `${alias}.${col(config.roleColumn)} AS role`,

    config.fullNameColumn
      ? `${alias}.${col(config.fullNameColumn)} AS fullName`
      : "NULL AS fullName",

    config.avatarColumn
      ? `${alias}.${col(config.avatarColumn)} AS avatarFilename`
      : "NULL AS avatarFilename",

    "NULL AS avatarUrl",
  ].join(", ");

/**
 * ==================================================
 * EXPORT CONFIGURATION
 * ==================================================
 */

module.exports = {
  config,
  col,
  table,
  userSelect,
};