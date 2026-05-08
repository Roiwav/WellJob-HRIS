import { useQuery, useQueryClient } from "@tanstack/react-query";

import { isSameEmployee, normalizeStatus } from "../utils/kpi/kpiHelpers";

const API_BASE = "http://localhost:5000/api";
const EMPLOYEE_API_URL = `${API_BASE}/employees`;
const INCIDENT_API_URL = `${API_BASE}/incidents`;

export const KPI_QUERY_KEYS = {
  all: ["kpi"],
  data: ["kpi", "data"],
};

async function requestJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

function isArchivedEmployee(employee) {
  return employee?.archived === true || Number(employee?.archived) === 1;
}

function normalizeBackendEmployee(employee) {
  return {
    ...employee,
    id: employee.id || employee.employeeId || employee.employee_id,
    employeeId: employee.id || employee.employeeId || employee.employee_id,
    name:
      employee.name ||
      employee.full_name ||
      employee.fullName ||
      "Unknown Employee",
    company: employee.company || employee.clientCompany || "Unassigned",
    status: employee.status || "Unknown",
    employmentType: employee.employmentType || employee.employment_type || "",
    contractStart: employee.contractStart || employee.contract_start || null,
    contractEnd: employee.contractEnd || employee.contract_end || null,
    archived: isArchivedEmployee(employee),
    documents: Array.isArray(employee.documents) ? employee.documents : [],
  };
}

function normalizeBackendIncident(incident) {
  const employeeId =
    incident.employeeId ||
    incident.employee_id ||
    incident.empId ||
    incident.employeeID ||
    "";

  const violation =
    incident.violation ||
    incident.violationType ||
    incident.violation_type ||
    "No violation type";

  const date =
    incident.reportedAt ||
    incident.reported_at ||
    incident.date ||
    incident.incidentDate ||
    incident.incident_date ||
    incident.createdAt ||
    incident.created_at ||
    new Date().toISOString();

  return {
    ...incident,
    id: incident.id,
    employeeId,
    employee_id: employeeId,
    employee:
      incident.employee ||
      incident.employeeName ||
      incident.employee_name ||
      "Unknown Employee",
    employeeName:
      incident.employeeName ||
      incident.employee ||
      incident.employee_name ||
      "Unknown Employee",
    company: incident.company || "",
    violation,
    violationType: violation,
    severity: incident.severity || "Minor",
    status: normalizeStatus(incident.status || "Open"),
    date,
    incidentDate: incident.incidentDate || incident.incident_date || date,
    reportedAt: incident.reportedAt || incident.reported_at || date,
    createdAt: incident.createdAt || incident.created_at || date,
    recommendation: incident.recommendation || "",
    sanction:
      incident.sanction || incident.actionTaken || incident.action_taken || "",
    description: incident.description || "",
  };
}

export async function fetchKPIBackendData() {
  const [employeeData, incidentData] = await Promise.all([
    requestJson(EMPLOYEE_API_URL),
    requestJson(INCIDENT_API_URL),
  ]);

  const employeesRaw = Array.isArray(employeeData)
    ? employeeData.map(normalizeBackendEmployee).filter((emp) => !emp.archived)
    : [];

  const normalizedIncidents = Array.isArray(incidentData)
    ? incidentData.map(normalizeBackendIncident)
    : [];

  const incidentsRaw = normalizedIncidents.filter((incident) =>
    employeesRaw.some((emp, index) => isSameEmployee(emp, incident, index))
  );

  return {
    employeesRaw,
    incidentsRaw,
    fetchedAt: new Date().toISOString(),
  };
}

export function useKPIDataQuery(options = {}) {
  return useQuery({
    queryKey: KPI_QUERY_KEYS.data,
    queryFn: fetchKPIBackendData,
    refetchInterval: options.refetchInterval ?? 10000,
    staleTime: options.staleTime ?? 15000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    ...options,
  });
}

export function useInvalidateKPIQueries() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: KPI_QUERY_KEYS.all });
  };
}