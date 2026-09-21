import {
  FiAlertTriangle,
  FiBriefcase,
  FiChevronDown,
  FiInfo,
  FiUser,
} from "react-icons/fi";

import FormField from "../ui/FormField";
import {
  ErrorText,
  StatusPill,
} from "./EmployeeComponents";
import {
  toProperName,
} from "./employeeConstants";

const INPUT_CLASS_NAME =
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 " +
  "text-sm font-semibold text-gray-900 outline-none transition " +
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 " +
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 " +
  "dark:border-slate-700 dark:bg-slate-800 dark:text-white " +
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 " +
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500";

const ERROR_INPUT_CLASS_NAME =
  "border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500";

function getInputClassName(
  hasError = false,
  extraClassName = ""
) {
  return [
    INPUT_CLASS_NAME,
    hasError
      ? ERROR_INPUT_CLASS_NAME
      : "",
    extraClassName,
  ]
    .filter(Boolean)
    .join(" ");
}

function getOptionKey(
  option,
  prefix
) {
  const optionId =
    option?.id;

  if (
    optionId !== null &&
    optionId !== undefined &&
    optionId !== ""
  ) {
    return `${prefix}-${optionId}`;
  }

  return `${prefix}-${String(
    option?.name || ""
  )
    .trim()
    .toLowerCase()}`;
}

function getManagedOptionLabel(
  option
) {
  const name =
    String(
      option?.name || ""
    ).trim();

  if (!name) {
    return "";
  }

  if (
    option?.isHistorical
  ) {
    return `${name} (Current - inactive)`;
  }

  return name;
}

export default function EmployeeFormFields({
  mode = "add",
  employeeId = "",
  formData,
  errors,
  duplicateEmployee = null,
  duplicateConfirmed = false,

  companyOptions = [],
  positionOptions = [],

  isLoadingCompanies = false,
  isLoadingPositions = false,
  deploymentOptionsError = "",

  disabled = false,

  onChange,
  onNameBlur,
  onDuplicateConfirmChange,
}) {
  const isEditMode =
    mode === "edit";

  const isDeployed =
    formData?.status ===
    "Deployed";

  const selectedCompany =
    String(
      formData?.company || ""
    ).trim();

  const selectedPosition =
    String(
      formData?.position || ""
    ).trim();

  const companySelectDisabled =
    disabled ||
    isLoadingCompanies;

  const positionSelectDisabled =
    disabled ||
    isLoadingPositions ||
    !selectedCompany;

  const hasCompanyOptions =
    Array.isArray(
      companyOptions
    ) &&
    companyOptions.length >
      0;

  const hasPositionOptions =
    Array.isArray(
      positionOptions
    ) &&
    positionOptions.length >
      0;

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
          <FiUser
            aria-hidden="true"
          />
        </div>

        <div>
          <h3 className="font-extrabold text-gray-900 dark:text-white">
            Basic Employee
            Information
          </h3>

          <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
            Employee ID is the
            official unique
            identifier.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          label="Employee ID"
          error={
            errors?.duplicateId
          }
        >
          <input
            type="text"
            value={
              employeeId
            }
            disabled
            aria-invalid={
              Boolean(
                errors?.duplicateId
              )
            }
            className={
              getInputClassName(
                Boolean(
                  errors?.duplicateId
                ),
                "font-bold"
              )
            }
          />
        </FormField>

        <FormField
          label="Employment Status"
          name="status"
          required
        >
          {({
            id,
            ...fieldProps
          }) => (
            <div className="relative">
              <select
                id={id}
                name="status"
                value={
                  formData?.status ||
                  "Deployed"
                }
                onChange={
                  onChange
                }
                disabled={
                  disabled
                }
                className={
                  getInputClassName(
                    false,
                    "appearance-none pr-10"
                  )
                }
                {...fieldProps}
              >
                <option value="Deployed">
                  Deployed
                </option>

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
            error={
              errors?.name
            }
          >
            {({
              id,
              ...fieldProps
            }) => (
              <input
                id={id}
                type="text"
                name="name"
                value={
                  formData?.name ||
                  ""
                }
                placeholder="e.g. Juan D. Dela Cruz"
                onChange={
                  onChange
                }
                onBlur={
                  onNameBlur
                }
                disabled={
                  disabled
                }
                autoComplete="off"
                aria-invalid={
                  Boolean(
                    errors?.name ||
                    duplicateEmployee
                  )
                }
                className={
                  getInputClassName(
                    Boolean(
                      errors?.name ||
                      duplicateEmployee
                    )
                  )
                }
                {...fieldProps}
              />
            )}
          </FormField>
        </div>

        {isDeployed ? (
          <>
            <div className="md:col-span-2">
              <FormField
                label="Company Assignment"
                name="company"
                required
                error={
                  errors?.company
                }
              >
                {({
                  id,
                  ...fieldProps
                }) => (
                  <div className="relative">
                    <select
                      id={id}
                      name="company"
                      value={
                        selectedCompany
                      }
                      onChange={
                        onChange
                      }
                      disabled={
                        companySelectDisabled
                      }
                      aria-invalid={
                        Boolean(
                          errors?.company
                        )
                      }
                      className={
                        getInputClassName(
                          Boolean(
                            errors?.company
                          ),
                          "appearance-none pr-10"
                        )
                      }
                      {...fieldProps}
                    >
                      <option value="">
                        {isLoadingCompanies
                          ? "Loading companies..."
                          : hasCompanyOptions
                            ? "Select client company"
                            : "No active companies available"}
                      </option>

                      {companyOptions.map(
                        (
                          option
                        ) => (
                          <option
                            key={
                              getOptionKey(
                                option,
                                "company"
                              )
                            }
                            value={
                              option.name
                            }
                          >
                            {
                              getManagedOptionLabel(
                                option
                              )
                            }
                          </option>
                        )
                      )}
                    </select>

                    <FiChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>
                )}
              </FormField>

              {!isLoadingCompanies &&
                !hasCompanyOptions &&
                !deploymentOptionsError && (
                  <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
                    <FiAlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                    />

                    <span>
                      No active client
                      company is currently
                      available for new
                      deployment
                      assignments.
                    </span>
                  </p>
                )}
            </div>

            <div className="md:col-span-2">
              <FormField
                label="Position"
                name="position"
                required
                error={
                  errors?.position
                }
              >
                {({
                  id,
                  ...fieldProps
                }) => (
                  <div className="relative">
                    <select
                      id={id}
                      name="position"
                      value={
                        selectedPosition
                      }
                      onChange={
                        onChange
                      }
                      disabled={
                        positionSelectDisabled
                      }
                      aria-invalid={
                        Boolean(
                          errors?.position
                        )
                      }
                      className={
                        getInputClassName(
                          Boolean(
                            errors?.position
                          ),
                          "appearance-none pr-10"
                        )
                      }
                      {...fieldProps}
                    >
                      <option value="">
                        {!selectedCompany
                          ? "Select a company first"
                          : isLoadingPositions
                            ? "Loading positions..."
                            : hasPositionOptions
                              ? "Select position"
                              : "No active positions available"}
                      </option>

                      {positionOptions.map(
                        (
                          option
                        ) => (
                          <option
                            key={
                              getOptionKey(
                                option,
                                "position"
                              )
                            }
                            value={
                              option.name
                            }
                          >
                            {
                              getManagedOptionLabel(
                                option
                              )
                            }
                          </option>
                        )
                      )}
                    </select>

                    <FiChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>
                )}
              </FormField>

              {selectedCompany &&
                !isLoadingPositions &&
                !hasPositionOptions &&
                !deploymentOptionsError && (
                  <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
                    <FiBriefcase
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                    />

                    <span>
                      No active position is
                      configured for this
                      company.
                    </span>
                  </p>
                )}
            </div>

            <div className="md:col-span-2">
              <FormField
                label="Deployment Start Date"
                name="contractStart"
                required
                error={
                  errors?.contractStart
                }
              >
                {({
                  id,
                  ...fieldProps
                }) => (
                  <input
                    id={id}
                    type="date"
                    name="contractStart"
                    value={
                      formData?.contractStart ||
                      ""
                    }
                    onChange={
                      onChange
                    }
                    disabled={
                      disabled
                    }
                    aria-invalid={
                      Boolean(
                        errors?.contractStart
                      )
                    }
                    className={
                      getInputClassName(
                        Boolean(
                          errors?.contractStart
                        )
                      )
                    }
                    {...fieldProps}
                  />
                )}
              </FormField>
            </div>

            {deploymentOptionsError && (
              <div
                role="alert"
                className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
              >
                <div className="flex items-start gap-3">
                  <FiAlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                  />

                  <div>
                    <p className="font-extrabold">
                      Deployment options
                      unavailable
                    </p>

                    <p className="mt-1 leading-6">
                      {
                        deploymentOptionsError
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isEditMode &&
              (
                companyOptions.some(
                  (
                    option
                  ) =>
                    option?.isHistorical &&
                    option?.name ===
                      selectedCompany
                ) ||
                positionOptions.some(
                  (
                    option
                  ) =>
                    option?.isHistorical &&
                    option?.name ===
                      selectedPosition
                )
              ) && (
                <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  <div className="flex items-start gap-3">
                    <FiInfo
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                    />

                    <div>
                      <p className="font-extrabold">
                        Historical deployment
                        assignment
                      </p>

                      <p className="mt-1 leading-6">
                        The employee&apos;s
                        current company or
                        position is no longer
                        active in System
                        Configuration. You may
                        keep the existing
                        assignment unchanged,
                        but a new assignment
                        must use active company
                        and position options.
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </>
        ) : (
          <div className="md:col-span-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
            <div className="flex items-start gap-3">
              <FiInfo
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="font-extrabold">
                  Floating / Standby
                  Employee
                </p>

                <p className="mt-1 leading-6">
                  Company assignment,
                  position, and deployment
                  start date are not
                  required until the
                  employee is deployed.
                </p>
              </div>
            </div>
          </div>
        )}

        {duplicateEmployee && (
          <div
            role="alert"
            className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <div className="flex gap-3">
              <FiAlertTriangle
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-extrabold">
                    Possible duplicate
                    employee found
                  </p>

                  <StatusPill
                    tone={
                      duplicateConfirmed
                        ? "amber"
                        : "red"
                    }
                  >
                    <FiAlertTriangle
                      aria-hidden="true"
                    />

                    {duplicateConfirmed
                      ? "Duplicate Verified"
                      : "Verification Required"}
                  </StatusPill>
                </div>

                <p className="mt-2 leading-6">
                  Existing record:{" "}
                  <strong>
                    {duplicateEmployee.name ||
                      "Unknown Employee"}
                  </strong>{" "}
                  (
                  {duplicateEmployee.id ||
                    "-"}
                  ). Verify using the
                  employee&apos;s resume
                  or supporting documents.
                </p>

                <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={
                      duplicateConfirmed
                    }
                    onChange={(
                      event
                    ) =>
                      onDuplicateConfirmChange?.(
                        event.target.checked
                      )
                    }
                    disabled={
                      disabled
                    }
                    className="mt-0.5"
                  />

                  <span>
                    I verified the
                    supporting documents
                    and confirm that this
                    is a different
                    employee.
                  </span>
                </label>

                <ErrorText>
                  {
                    errors?.duplicateConfirm
                  }
                </ErrorText>
              </div>
            </div>
          </div>
        )}

        {isEditMode && (
          <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs leading-5 text-gray-600 dark:border-white/10 dark:bg-slate-800 dark:text-gray-300">
            Editing record for{" "}
            <strong>
              {toProperName(
                formData?.name
              ) ||
                employeeId}
            </strong>
            . Changes will only be
            saved after confirmation.
          </div>
        )}
      </div>
    </section>
  );
}