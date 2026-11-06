/*
 * Add the nullable user avatar reference required by authentication,
 * profile-picture, navbar, and Messenger queries.
 *
 * Existing users remain valid. No filename is guessed or backfilled.
 */
ALTER TABLE users
  ADD COLUMN avatar_filename VARCHAR(255) DEFAULT NULL
  AFTER assigned_company;
