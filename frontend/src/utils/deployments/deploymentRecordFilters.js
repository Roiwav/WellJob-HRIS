import {
  getDeploymentEndReasonDisplay,
} from "./deploymentHelpers.js";

export const CURRENT_ASSIGNMENT_END_REASONS = [
  "End of Assignment / Pulled Out by Client",
  "Transferred / Reassigned",
];

export const EMPLOYMENT_SEPARATION_END_REASONS = [
  "Resigned",
  "Terminated",
  "AWOL",
];

export const DEPLOYMENT_END_REASON_GROUPS =
  Object.freeze({
    DEPLOYMENT_END:
      "deployment-end",
    EMPLOYMENT_SEPARATION:
      "employment-separation",
    HISTORICAL:
      "historical",
  });

function getDeploymentEndReasonGroup(
  reason
) {
  if (
    CURRENT_ASSIGNMENT_END_REASONS.includes(
      reason
    ) ||
    reason ===
      "Completed Contract"
  ) {
    return DEPLOYMENT_END_REASON_GROUPS.DEPLOYMENT_END;
  }

  if (
    EMPLOYMENT_SEPARATION_END_REASONS.includes(
      reason
    )
  ) {
    return DEPLOYMENT_END_REASON_GROUPS.EMPLOYMENT_SEPARATION;
  }

  return DEPLOYMENT_END_REASON_GROUPS.HISTORICAL;
}

export function getDeploymentEndReasonOptions(historicalReasons = []) {
  const reasons = new Set([
    ...CURRENT_ASSIGNMENT_END_REASONS,
    ...EMPLOYMENT_SEPARATION_END_REASONS,
  ]);

  for (const value of historicalReasons) {
    const reason = String(value || "").trim();
    if (reason) {
      reasons.add(reason);
    }
  }

  const labelCounts =
    new Map();

  const options =
    Array.from(reasons).map(
      (value) => {
        const label =
          getDeploymentEndReasonDisplay(
            value
          );

        labelCounts.set(
          label,
          (labelCounts.get(label) ||
            0) + 1
        );

        return {
          value,
          label,
          group:
            getDeploymentEndReasonGroup(
              value
            ),
        };
      }
    );

  return options.map(
    (option) => {
      if (
        labelCounts.get(
          option.label
        ) <= 1
      ) {
        return option;
      }

      return {
        ...option,
        label:
          option.value ===
          "Completed Contract"
            ? `${option.label} (legacy record)`
            : `${option.label} (recorded reason)`,
      };
    }
  );
}

export function reconcileDeploymentEndReason(status, endReason) {
  if (!endReason) {
    return "";
  }

  return status === "" || status === "Completed" ? endReason : "";
}