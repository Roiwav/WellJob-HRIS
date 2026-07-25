import {
  FiAlertTriangle,
  FiBriefcase,
  FiChevronDown,
  FiInfo,
  FiUser,
} from "react-icons/fi";

import FormField from "../ui/FormField";

import {
  COMPANY_OPTIONS,
  toProperName,
} from "./employeeConstants";

import {
  ErrorText,
  StatusPill,
} from "./EmployeeComponents";

const INPUT_CLASS_NAME = [
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5",
  "text-sm font-semibold text-gray-900 outline-none transition",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
  "dark:border-slate-700 dark:bg-slate-800 dark:text-white",
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500",
].join(" ");

const ERROR_INPUT_CLASS_NAME = [
  "border-red-500",
  "focus:border-red-500 focus:ring-red-500/20",
  "dark:border-red-500",
].join(" ");

export default function EmployeeFormFields({
  mode = "add",
  employeeId = "",
  formData,
  errors,
  duplicateEmployee = null,
  duplicateConfirmed = false,
  filteredCompanies = COMPANY_OPTIONS,
  showSuggestions = false,
  disabled = false,
  onChange,
  onNameBlur,
  onDuplicateConfirmChange,
  onCompanyFocus,
  onCompanyBlur,
  onCompanySelect,
}) {
  const isEditMode = mode === "edit";
  const isDeployed = formData?.status === "Deployed";

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
          <FiUser aria-hidden="true" />
        </div>

        <div>
          <h3 className="font-extrabold text-gray-900 dark:text-white">
            Basic Employee Information
          </h3>

          <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
            Employee ID is the official unique identifier.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          label="Employee ID"
          error={errors?.duplicateId}
        >
          <input
            type="text"
            value={employeeId}
            disabled
            className={[
              INPUT_CLASS_NAME,
              "font-bold",
              errors?.duplicateId
                ? ERROR_INPUT_CLASS_NAME
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        </FormField>

        <FormField
          label="Employment Status"
          name="status"
          required
        >
          {({ id, ...fieldProps }) => (
            <div className="relative">
              <select
                id={id}
                name="status"
                value={formData?.status || "Deployed"}
                onChange={onChange}
                disabled={disabled}
                className={`${INPUT_CLASS_NAME} appearance-none pr-10`}
                {...fieldProps}
              >
                <option value="Deployed">Deployed</option>

                <option value="Floating / Standby">
                  Floating / Standby
                </option>
              </select>

              <FiChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
            </div>
          )}
        </FormField>

        <div className="md:col-span-2">
          <FormField
            label="Full Name"
            name="name"
            required
            error={errors?.name}
          >
            {({ id, ...fieldProps }) => (
              <input
                id={id}
                type="text"
                name="name"
                placeholder="e.g. Juan D. Dela Cruz"
                value={formData?.name || ""}
                onChange={onChange}
                onBlur={onNameBlur}
                disabled={disabled}
                autoComplete="off"
                className={[
                  INPUT_CLASS_NAME,
                  errors?.name || duplicateEmployee
                    ? ERROR_INPUT_CLASS_NAME
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                {...fieldProps}
              />
            )}
          </FormField>
        </div>

        {isDeployed && (
          <>
            <div className="md:col-span-2">
              <FormField
                label="Company Assignment"
                name="company"
                required
                error={errors?.company}
              >
                {({ id, ...fieldProps }) => (
                  <div className="relative">
                    <input
                      id={id}
                      type="text"
                      name="company"
                      value={formData?.company || ""}
                      onChange={onChange}
                      onFocus={onCompanyFocus}
                      onBlur={onCompanyBlur}
                      disabled={disabled}
                      placeholder="Type or select company name..."
                      autoComplete="off"
                      className={[
                        INPUT_CLASS_NAME,
                        errors?.company
                          ? ERROR_INPUT_CLASS_NAME
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      {...fieldProps}
                    />

                    {showSuggestions &&
                      filteredCompanies.length > 0 &&
                      !disabled && (
                        <div className="absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-slate-900">
                          {filteredCompanies.map((company) => (
                            <button
                              key={company}
                              type="button"
                              onMouseDown={(event) =>
                                event.preventDefault()
                              }
                              onClick={() =>
                                onCompanySelect?.(company)
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-800 transition hover:bg-indigo-50 dark:text-white dark:hover:bg-white/10"
                            >
                              <FiBriefcase className="shrink-0 text-indigo-500" />

                              <span>{company}</span>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                )}
              </FormField>
            </div>

            <div className="md:col-span-2">
              <FormField
                label="Deployment Start Date"
                name="contractStart"
                required
                error={errors?.contractStart}
              >
                {({ id, ...fieldProps }) => (
                  <input
                    id={id}
                    type="date"
                    name="contractStart"
                    value={formData?.contractStart || ""}
                    onChange={onChange}
                    disabled={disabled}
                    className={[
                      INPUT_CLASS_NAME,
                      errors?.contractStart
                        ? ERROR_INPUT_CLASS_NAME
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    {...fieldProps}
                  />
                )}
              </FormField>
            </div>
          </>
        )}

        {!isDeployed && (
          <div className="md:col-span-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
            <div className="flex items-start gap-3">
              <FiInfo className="mt-0.5 shrink-0" />

              <div>
                <p className="font-extrabold">
                  Floating / Standby Employee
                </p>

                <p className="mt-1 leading-6">
                  Company assignment and deployment start date are not
                  required until the employee is deployed.
                </p>
              </div>
            </div>
          </div>
        )}

        {duplicateEmployee && (
          <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <div className="flex gap-3">
              <FiAlertTriangle className="mt-0.5 shrink-0" />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-extrabold">
                    Possible duplicate employee found
                  </p>

                  <StatusPill
                    tone={duplicateConfirmed ? "amber" : "red"}
                  >
                    <FiAlertTriangle />

                    {duplicateConfirmed
                      ? "Duplicate Verified"
                      : "Verification Required"}
                  </StatusPill>
                </div>

                <p className="mt-2 leading-6">
                  Existing record:{" "}
                  <strong>
                    {duplicateEmployee.name || "Unknown Employee"}
                  </strong>{" "}
                  ({duplicateEmployee.id || "-"}). Verify using the
                  employee&apos;s resume or supporting documents.
                </p>

                <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={duplicateConfirmed}
                    onChange={(event) =>
                      onDuplicateConfirmChange?.(
                        event.target.checked
                      )
                    }
                    disabled={disabled}
                    className="mt-0.5"
                  />

                  <span>
                    I verified the supporting documents and confirm that
                    this is a different employee.
                  </span>
                </label>

                <ErrorText>
                  {errors?.duplicateConfirm}
                </ErrorText>
              </div>
            </div>
          </div>
        )}

        {isEditMode && (
          <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs leading-5 text-gray-600 dark:border-white/10 dark:bg-slate-800 dark:text-gray-300">
            Editing record for{" "}
            <strong>{toProperName(formData?.name) || employeeId}</strong>.
            Changes will only be saved after confirmation.
          </div>
        )}
      </div>
    </section>
  );
}