import AuditLogsPage from "../components/audit/AuditLogsPage.jsx";

export default function TechnicalAuditLogs() {
  return (
    <AuditLogsPage
      category="TECHNICAL"
      title="Technical System Audit"
      description="System-level monitoring including login, password changes, and account maintenance."
    />
  );
}