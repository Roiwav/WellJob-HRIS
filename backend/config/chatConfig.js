
/**
 * WELLJOB Solutions - Messenger Database Configuration
 *
 * This configuration matches the existing WELLJOB users table.
 *
 * IMPORTANT:
 * Never accept table or column names from a request body,
 * URL, or user input.
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

  // No profile picture column currently exists.
  // Change this only after adding an avatar column.
  avatarColumn: null,
};

/**
 * Validate static database identifiers.
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
 * Escape database identifiers.
 */
const col = (name) => `\`${name}\``;

const table = col(config.usersTable);

/**
 * Generate a consistent SELECT statement
 * for retrieving WELLJOB user information.
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
      ? `${alias}.${col(config.avatarColumn)} AS avatarUrl`
      : "NULL AS avatarUrl",
  ].join(", ");

module.exports = {
  config,
  col,
  table,
  userSelect,
};