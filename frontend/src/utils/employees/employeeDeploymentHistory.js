function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function getDeploymentKey(
  deployment,
  index
) {
  const id =
    cleanText(
      deployment?.id ??
        deployment?.deploymentId ??
        deployment?.deployment_id
    );

  if (id) {
    return `id:${id}`;
  }

  const naturalKey = [
    deployment?.company,
    deployment?.location,
    deployment?.position,
    deployment?.startDate,
    deployment?.endDate,
    deployment?.status,
  ]
    .map(cleanText)
    .join("|")
    .toLowerCase();

  return naturalKey
    ? `record:${naturalKey}`
    : `record:${index}`;
}

function getDateSortValue(value) {
  const normalized =
    cleanText(value);

  if (!normalized) {
    return 0;
  }

  const timestamp =
    Date.parse(
      `${normalized.slice(0, 10)}T00:00:00Z`
    );

  return Number.isNaN(
    timestamp
  )
    ? 0
    : timestamp;
}

export function normalizeEmployeeDeployment(
  deployment = {}
) {
  return {
    id:
      cleanText(
        deployment.id ??
          deployment.deploymentId ??
          deployment.deployment_id
      ),
    company:
      cleanText(
        deployment.company
      ),
    location:
      cleanText(
        deployment.location ??
          deployment.site ??
          deployment.clientSite
      ),
    position:
      cleanText(
        deployment.position
      ),
    startDate:
      cleanText(
        deployment.startDate ??
          deployment.start_date ??
          deployment.start
      ),
    endDate:
      cleanText(
        deployment.endDate ??
          deployment.end_date ??
          deployment.contractEnd
      ),
    status:
      cleanText(
        deployment.status
      ),
    displayStatus:
      cleanText(
        deployment.displayStatus ??
          deployment.display_status ??
          deployment.status
      ) || "Status unavailable",
  };
}

export function groupEmployeeDeployments(
  deployments
) {
  const unique = [];
  const seen =
    new Set();

  for (const [
    index,
    deployment,
  ] of (
    Array.isArray(
      deployments
    )
      ? deployments
      : []
  ).entries()) {
    const normalized =
      normalizeEmployeeDeployment(
        deployment
      );
    const key =
      getDeploymentKey(
        normalized,
        index
      );

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(
      normalized
    );
  }

  const current =
    unique.filter(
      (deployment) =>
        deployment.status
          .toLowerCase() ===
        "active"
    );

  const previous =
    unique
      .filter(
        (deployment) =>
          deployment.status
            .toLowerCase() !==
          "active"
      )
      .sort(
        (left, right) =>
          getDateSortValue(
            right.endDate ||
              right.startDate
          ) -
            getDateSortValue(
              left.endDate ||
                left.startDate
            ) ||
          getDateSortValue(
            right.startDate
          ) -
            getDateSortValue(
              left.startDate
            )
      );

  return {
    current,
    previous,
    all:
      [
        ...current,
        ...previous,
      ],
  };
}