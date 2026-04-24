import AuditLogsPage from "../components/audit/AuditLogsPage.jsx";

export default function OperationalAuditLogs() {
  return (
    <AuditLogsPage
      category="OPERATIONAL"
      title="Operational Audit Logs"
      description="Monitor HR-related activities such as employee records, incidents, deployments, and operational updates."
    />
  );
}