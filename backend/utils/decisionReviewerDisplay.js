// Audit values stay intact. Resolve legacy usernames using current/archived
// profiles; never expose an account username as an HR-facing personal name.
async function resolveDecisionReviewerNames(rows, database) {
  const identities = [...new Set(rows.map((row) => String(row.decided_by || "").trim()).filter(Boolean))];
  if (!identities.length) return rows.map((row) => ({ ...row, reviewer_full_name: null }));
  const placeholders = identities.map(() => "?").join(",");
  const [users] = await database.promise().query(
    `SELECT username, full_name FROM users WHERE username IN (${placeholders}) OR full_name IN (${placeholders})`,
    [...identities, ...identities]
  );
  return rows.map((row) => {
    const identity = String(row.decided_by || "").trim();
    const user = users.find((profile) => profile.username === identity)
      || users.find((profile) => profile.full_name === identity);
    return { ...row, reviewer_full_name: String(user?.full_name || "").trim() || null };
  });
}

module.exports = { resolveDecisionReviewerNames };
