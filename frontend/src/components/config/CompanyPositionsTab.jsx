import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiAlertTriangle,
  FiBriefcase,
  FiCheckCircle,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSlash,
} from "react-icons/fi";

import { API_BASE } from "../../config/api";
import authenticatedFetch from "../../utils/authenticatedFetch";

import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import Dialog from "../ui/Dialog";
import SuccessToast from "../ui/SuccessToast";

const COMPANIES_URL = `${API_BASE}/settings/client-companies`;
const POSITIONS_URL = `${API_BASE}/settings/company-positions`;

const REQUEST_TIMEOUT_MS = 15000;
const MAX_POSITION_LENGTH = 150;

const INPUT_CLASS = [
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5",
  "text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white",
  "dark:focus:border-indigo-400 dark:disabled:bg-slate-800",
].join(" ");

function toNumber(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (["true", "active", "enabled"].includes(normalized)) {
    return true;
  }

  if (["false", "inactive", "disabled"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizeCompany(item) {
  if (!item || typeof item !== "object") return null;

  const id = toNumber(
    item.id ??
      item.companyId ??
      item.company_id
  );

  const companyName = String(
    item.companyName ??
      item.company_name ??
      item.company ??
      item.name ??
      ""
  ).trim();

  if (!id || !companyName) return null;

  return {
    id,
    companyName,
    isActive: toBoolean(
      item.isActive ??
        item.is_active ??
        item.active,
      true
    ),
  };
}

function normalizePosition(item) {
  if (!item || typeof item !== "object") return null;

  const id = toNumber(
    item.id ??
      item.positionId ??
      item.position_id
  );

  const positionName = String(
    item.positionName ??
      item.position_name ??
      item.position ??
      item.name ??
      ""
  ).trim();

  if (!id || !positionName) return null;

  return {
    id,
    positionName,
    isActive: toBoolean(
      item.isActive ??
        item.is_active ??
        item.active,
      true
    ),
  };
}

function normalizeCompanies(data) {
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.companies)
      ? data.companies
      : [];

  return items
    .map(normalizeCompany)
    .filter(Boolean)
    .sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }

      return a.companyName.localeCompare(
        b.companyName,
        "en",
        { sensitivity: "base" }
      );
    });
}

function normalizePositions(data) {
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.positions)
      ? data.positions
      : [];

  return items
    .map(normalizePosition)
    .filter(Boolean)
    .sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }

      return a.positionName.localeCompare(
        b.positionName,
        "en",
        { sensitivity: "base" }
      );
    });
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await authenticatedFetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getErrorMessage(error, fallback) {
  if (error?.name === "AbortError") {
    return "The server took too long to respond. Check that the backend and database are running, then try again.";
  }

  return error?.message || fallback;
}

function StatusBadge({ active }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold",
        active
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
          : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300",
      ].join(" ")}
    >
      {active ? (
        <FiCheckCircle aria-hidden="true" />
      ) : (
        <FiSlash aria-hidden="true" />
      )}

      {active ? "Active" : "Inactive"}
    </span>
  );
}

function MetricCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-800/70">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
          {icon}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {label}
          </p>

          <p className="mt-1 text-xl font-extrabold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function emitPositionUpdate(action, companyId) {
  window.dispatchEvent(
    new CustomEvent("dataUpdated", {
      detail: {
        source: "company-positions-configuration",
        domain: "system-configuration",
        action,
        companyId,
        at: Date.now(),
      },
    })
  );
}

export default function CompanyPositionsTab({
  canEdit = false,
}) {
  const mountedRef = useRef(true);
  const positionRequestRef = useRef(0);

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [positions, setPositions] = useState([]);

  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");
  const [formError, setFormError] = useState("");

  const [pendingPosition, setPendingPosition] = useState(null);

  const selectedCompany = useMemo(
    () =>
      companies.find(
        (company) =>
          String(company.id) === String(selectedCompanyId)
      ) || null,
    [companies, selectedCompanyId]
  );

  const loadCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    setError("");

    try {
      const data = await requestJson(COMPANIES_URL);

      if (!mountedRef.current) return false;

      const nextCompanies = normalizeCompanies(data);

      setCompanies(nextCompanies);

      setSelectedCompanyId((currentId) => {
        const currentExists = nextCompanies.some(
          (company) =>
            String(company.id) === String(currentId)
        );

        if (currentExists) {
          return currentId;
        }

        const firstActive = nextCompanies.find(
          (company) => company.isActive
        );

        return String(
          firstActive?.id ??
            nextCompanies[0]?.id ??
            ""
        );
      });

      return true;
    } catch (loadError) {
      console.error(
        "Unable to load client companies:",
        loadError
      );

      if (mountedRef.current) {
        setError(
          getErrorMessage(
            loadError,
            "Unable to load client companies."
          )
        );
      }

      return false;
    } finally {
      if (mountedRef.current) {
        setLoadingCompanies(false);
      }
    }
  }, []);

  const loadPositions = useCallback(async (companyId) => {
    if (!companyId) {
      setPositions([]);
      return true;
    }

    const requestId = positionRequestRef.current + 1;
    positionRequestRef.current = requestId;

    setLoadingPositions(true);
    setError("");

    try {
      const data = await requestJson(
        `${COMPANIES_URL}/${encodeURIComponent(companyId)}/positions`
      );

      if (
        !mountedRef.current ||
        positionRequestRef.current !== requestId
      ) {
        return false;
      }

      setPositions(normalizePositions(data));
      return true;
    } catch (loadError) {
      console.error(
        "Unable to load company positions:",
        loadError
      );

      if (
        mountedRef.current &&
        positionRequestRef.current === requestId
      ) {
        setError(
          getErrorMessage(
            loadError,
            "Unable to load company positions."
          )
        );
      }

      return false;
    } finally {
      if (
        mountedRef.current &&
        positionRequestRef.current === requestId
      ) {
        setLoadingPositions(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    void loadCompanies();

    return () => {
      mountedRef.current = false;
      positionRequestRef.current += 1;
    };
  }, [loadCompanies]);

  useEffect(() => {
    setQuery("");
    setStatusFilter("All");
    setPendingPosition(null);

    if (selectedCompanyId) {
      void loadPositions(selectedCompanyId);
    } else {
      setPositions([]);
    }
  }, [loadPositions, selectedCompanyId]);

  const activePositionCount = useMemo(
    () =>
      positions.filter(
        (position) => position.isActive
      ).length,
    [positions]
  );

  const inactivePositionCount =
    positions.length - activePositionCount;

  const filteredPositions = useMemo(() => {
    const search = query.trim().toLowerCase();

    return positions.filter((position) => {
      const matchesSearch =
        !search ||
        position.positionName
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" &&
          position.isActive) ||
        (statusFilter === "Inactive" &&
          !position.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [positions, query, statusFilter]);

  const normalizedPositionName = newPositionName
    .trim()
    .replace(/\s+/g, " ");

  const canManageSelectedCompany =
    Boolean(
      canEdit &&
        selectedCompany?.id &&
        selectedCompany.isActive
    );

  const handleRefresh = useCallback(async () => {
    if (saving) return;

    const companyId = selectedCompanyId;

    await loadCompanies();

    if (companyId) {
      await loadPositions(companyId);
    }
  }, [
    loadCompanies,
    loadPositions,
    saving,
    selectedCompanyId,
  ]);

  const handleOpenAdd = useCallback(() => {
    if (!canManageSelectedCompany || saving) return;

    setNewPositionName("");
    setFormError("");
    setShowAddDialog(true);
  }, [canManageSelectedCompany, saving]);

  const handleCloseAdd = useCallback(() => {
    if (saving) return;

    setShowAddDialog(false);
    setNewPositionName("");
    setFormError("");
  }, [saving]);

  const handleAddPosition = useCallback(async () => {
    if (
      !canManageSelectedCompany ||
      saving ||
      !selectedCompany?.id
    ) {
      return;
    }

    if (!normalizedPositionName) {
      setFormError("Position name is required.");
      return;
    }

    if (
      normalizedPositionName.length >
      MAX_POSITION_LENGTH
    ) {
      setFormError(
        `Position name must not exceed ${MAX_POSITION_LENGTH} characters.`
      );
      return;
    }

    const companyId = selectedCompany.id;

    try {
      setSaving(true);
      setFormError("");
      setError("");

      const data = await requestJson(
        `${COMPANIES_URL}/${encodeURIComponent(companyId)}/positions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            positionName: normalizedPositionName,
          }),
        }
      );

      if (!mountedRef.current) return;

      setShowAddDialog(false);
      setNewPositionName("");

      setSuccessMessage(
        data?.message ||
          `${normalizedPositionName} was added successfully.`
      );

      emitPositionUpdate(
        "ADD_COMPANY_POSITION",
        companyId
      );

      await loadPositions(companyId);
    } catch (saveError) {
      console.error(
        "Unable to add company position:",
        saveError
      );

      if (mountedRef.current) {
        setFormError(
          getErrorMessage(
            saveError,
            "Unable to add company position."
          )
        );
      }
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [
    canManageSelectedCompany,
    loadPositions,
    normalizedPositionName,
    saving,
    selectedCompany,
  ]);

  const handleRequestStatusChange = useCallback(
    (position) => {
      if (!canEdit || saving || !position?.id) {
        return;
      }

      if (
        !position.isActive &&
        !selectedCompany?.isActive
      ) {
        setError(
          "Reactivate the client company before reactivating this position."
        );
        return;
      }

      setError("");
      setPendingPosition(position);
    },
    [canEdit, saving, selectedCompany]
  );

  const handleConfirmStatusChange = useCallback(async () => {
    if (
      !canEdit ||
      saving ||
      !pendingPosition?.id ||
      !selectedCompany?.id
    ) {
      return;
    }

    const nextIsActive = !pendingPosition.isActive;

    if (
      nextIsActive &&
      !selectedCompany.isActive
    ) {
      setPendingPosition(null);
      setError(
        "Reactivate the client company before reactivating this position."
      );
      return;
    }

    const companyId = selectedCompany.id;
    const positionName = pendingPosition.positionName;

    try {
      setSaving(true);
      setError("");

      const data = await requestJson(
        `${POSITIONS_URL}/${encodeURIComponent(pendingPosition.id)}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: nextIsActive,
          }),
        }
      );

      if (!mountedRef.current) return;

      setPendingPosition(null);

      setSuccessMessage(
        data?.message ||
          `${positionName} was ${
            nextIsActive
              ? "reactivated"
              : "deactivated"
          } successfully.`
      );

      emitPositionUpdate(
        nextIsActive
          ? "REACTIVATE_COMPANY_POSITION"
          : "DEACTIVATE_COMPANY_POSITION",
        companyId
      );

      await loadPositions(companyId);
    } catch (saveError) {
      console.error(
        "Unable to update position status:",
        saveError
      );

      if (mountedRef.current) {
        setPendingPosition(null);

        setError(
          getErrorMessage(
            saveError,
            "Unable to update company position status."
          )
        );
      }
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [
    canEdit,
    loadPositions,
    pendingPosition,
    saving,
    selectedCompany,
  ]);

  const pendingNextIsActive =
    pendingPosition
      ? !pendingPosition.isActive
      : false;

  return (
    <div className="space-y-6">
      {error && (
        <section
          role="alert"
          className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <div className="flex items-start gap-3">
            <FiAlertTriangle
              className="mt-0.5 shrink-0"
              size={20}
              aria-hidden="true"
            />

            <div className="min-w-0">
              <h3 className="font-extrabold">
                Position configuration error
              </h3>

              <p className="mt-1 text-sm leading-6">
                {error}
              </p>

              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    loadingCompanies ||
                    loadingPositions ||
                    saving
                  }
                  onClick={handleRefresh}
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-6 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
                <FiMapPin
                  size={22}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white">
                  Company Position Master
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-100">
                  Manage approved deployment positions
                  for each client company. Only active
                  positions can be selected for new
                  employee deployments.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    {positions.length} total
                  </span>

                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    {activePositionCount} active
                  </span>

                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    No rename / no hard delete
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<FiRefreshCw />}
                disabled={
                  loadingCompanies ||
                  loadingPositions ||
                  saving
                }
                onClick={handleRefresh}
              >
                Refresh
              </Button>

              {canEdit && (
                <Button
                  type="button"
                  leftIcon={<FiPlus />}
                  disabled={
                    loadingCompanies ||
                    loadingPositions ||
                    saving ||
                    !canManageSelectedCompany
                  }
                  onClick={handleOpenAdd}
                >
                  Add Position
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">
              Client Company
            </span>

            <select
              value={selectedCompanyId}
              disabled={
                loadingCompanies ||
                saving ||
                !companies.length
              }
              onChange={(event) =>
                setSelectedCompanyId(event.target.value)
              }
              className={INPUT_CLASS}
            >
              {!companies.length && (
                <option value="">
                  No companies available
                </option>
              )}

              {companies.map((company) => (
                <option
                  key={company.id}
                  value={company.id}
                >
                  {company.companyName}
                  {company.isActive
                    ? ""
                    : " (Inactive)"}
                </option>
              ))}
            </select>
          </label>

          {selectedCompany && (
            <div
              className={[
                "mt-4 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
                selectedCompany.isActive
                  ? "border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10"
                  : "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <FiBriefcase
                  aria-hidden="true"
                  className="shrink-0"
                />

                <div>
                  <p className="font-extrabold text-gray-900 dark:text-white">
                    {selectedCompany.companyName}
                  </p>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {selectedCompany.isActive
                      ? "Position management is enabled."
                      : "Inactive company: adding and reactivating positions is disabled."}
                  </p>
                </div>
              </div>

              <StatusBadge
                active={selectedCompany.isActive}
              />
            </div>
          )}
        </div>

        <div className="grid gap-3 border-t border-gray-200 p-5 sm:grid-cols-3 sm:p-6 dark:border-white/10">
          <MetricCard
            label="Total Positions"
            value={positions.length}
            icon={<FiMapPin aria-hidden="true" />}
          />

          <MetricCard
            label="Active"
            value={activePositionCount}
            icon={<FiCheckCircle aria-hidden="true" />}
          />

          <MetricCard
            label="Inactive"
            value={inactivePositionCount}
            icon={<FiSlash aria-hidden="true" />}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <FiSearch
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />

            <label
              htmlFor="position-search"
              className="sr-only"
            >
              Search positions
            </label>

            <input
              id="position-search"
              type="search"
              value={query}
              disabled={!selectedCompany}
              placeholder="Search position name..."
              onChange={(event) =>
                setQuery(event.target.value)
              }
              className={`${INPUT_CLASS} pl-11`}
            />
          </div>

          <select
            aria-label="Filter positions by status"
            value={statusFilter}
            disabled={!selectedCompany}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className={INPUT_CLASS}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </section>

      {loadingCompanies || loadingPositions ? (
        <section
          role="status"
          className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 text-sm font-semibold text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
        >
          Loading company position configuration...
        </section>
      ) : !companies.length ? (
        <section className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-white/10 dark:bg-slate-900">
          <h3 className="font-extrabold text-gray-900 dark:text-white">
            No client companies configured
          </h3>

          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Add a client company first before creating
            deployment positions.
          </p>
        </section>
      ) : filteredPositions.length ? (
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-gray-500">
                    Position
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-gray-500">
                    Company
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-gray-500">
                    Status
                  </th>

                  {canEdit && (
                    <th className="px-5 py-3 text-right text-xs font-extrabold uppercase text-gray-500">
                      Action
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {filteredPositions.map((position) => {
                  const reactivateBlocked =
                    !position.isActive &&
                    !selectedCompany?.isActive;

                  return (
                    <tr key={position.id}>
                      <td className="px-5 py-4">
                        <p className="font-extrabold text-gray-900 dark:text-white">
                          {position.positionName}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Position ID: {position.id}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {selectedCompany?.companyName || "-"}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          active={position.isActive}
                        />
                      </td>

                      {canEdit && (
                        <td className="px-5 py-4 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              position.isActive
                                ? "secondary"
                                : "success"
                            }
                            disabled={
                              saving ||
                              reactivateBlocked
                            }
                            onClick={() =>
                              handleRequestStatusChange(
                                position
                              )
                            }
                          >
                            {position.isActive
                              ? "Deactivate"
                              : "Reactivate"}
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-white/10 dark:bg-slate-900">
          <FiMapPin
            className="mx-auto text-gray-400"
            size={28}
            aria-hidden="true"
          />

          <h3 className="mt-3 font-extrabold text-gray-900 dark:text-white">
            No positions found
          </h3>

          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {positions.length
              ? "No position matches the current filters."
              : "No positions are configured for this company yet."}
          </p>
        </section>
      )}

      <Dialog
        open={showAddDialog}
        onClose={handleCloseAdd}
        title="Add Company Position"
        description={
          selectedCompany
            ? `Add an approved deployment position for ${selectedCompany.companyName}.`
            : "Add an approved deployment position."
        }
        size="md"
        preventClose={saving}
        closeOnOverlay={!saving}
        closeOnEscape={!saving}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={handleCloseAdd}
            >
              Cancel
            </Button>

            <Button
              type="button"
              leftIcon={<FiPlus />}
              loading={saving}
              disabled={
                saving ||
                !normalizedPositionName ||
                !canManageSelectedCompany
              }
              onClick={handleAddPosition}
            >
              Add Position
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              <div className="flex items-start gap-3">
                <FiAlertTriangle
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />

                <p>{formError}</p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <p className="text-xs font-bold uppercase text-indigo-700 dark:text-indigo-300">
              Client Company
            </p>

            <p className="mt-1 font-extrabold text-indigo-900 dark:text-indigo-200">
              {selectedCompany?.companyName || "-"}
            </p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">
              Position Name
            </span>

            <input
              type="text"
              value={newPositionName}
              maxLength={MAX_POSITION_LENGTH}
              disabled={
                saving ||
                !canManageSelectedCompany
              }
              placeholder="Example: Checker"
              autoComplete="off"
              onChange={(event) => {
                setNewPositionName(event.target.value);
                setFormError("");
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !saving &&
                  canManageSelectedCompany
                ) {
                  event.preventDefault();
                  void handleAddPosition();
                }
              }}
              className={INPUT_CLASS}
            />

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Maximum {MAX_POSITION_LENGTH} characters.
              Position names must be unique within the
              selected company. Renaming is not available.
            </p>
          </label>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingPosition)}
        title={
          pendingNextIsActive
            ? "Reactivate Company Position?"
            : "Deactivate Company Position?"
        }
        tone="warning"
        confirmLabel={
          pendingNextIsActive
            ? "Reactivate Position"
            : "Deactivate Position"
        }
        cancelLabel="Cancel"
        loading={saving}
        closeOnBackdrop={!saving}
        onClose={() => {
          if (!saving) {
            setPendingPosition(null);
          }
        }}
        onConfirm={handleConfirmStatusChange}
      >
        <p>
          {pendingNextIsActive
            ? "Reactivate"
            : "Deactivate"}{" "}
          <strong>
            {pendingPosition?.positionName}
          </strong>{" "}
          for{" "}
          <strong>
            {selectedCompany?.companyName}
          </strong>
          ?
        </p>

        <p className="mt-2">
          {pendingNextIsActive
            ? "The position will become available again for future employee deployment choices."
            : "The position will be removed from future active choices. Existing deployment history will remain unchanged."}
        </p>
      </ConfirmDialog>

      <SuccessToast
        title="Company position updated"
        message={successMessage}
        duration={4000}
        onClose={() => setSuccessMessage("")}
      />
    </div>
  );
}