const packageJson =
  require("../package.json");

function normalizeValue(
  value
) {
  const normalized =
    String(
      value ||
        ""
    ).trim();

  return normalized ||
    null;
}

function getDeploymentMetadata(
  environment = process.env
) {
  const deploymentHost =
    normalizeValue(
      environment
        .VERCEL_URL
    );
  const productionHost =
    normalizeValue(
      environment
        .VERCEL_PROJECT_PRODUCTION_URL
    );

  return {
    service:
      "welljob-hris-backend",
    packageVersion:
      packageJson.version,
    gitCommitSha:
      normalizeValue(
        environment
          .VERCEL_GIT_COMMIT_SHA
      ),
    gitCommitRef:
      normalizeValue(
        environment
          .VERCEL_GIT_COMMIT_REF
      ),
    deploymentEnvironment:
      normalizeValue(
        environment
          .VERCEL_ENV ||
          environment
            .VERCEL_TARGET_ENV ||
          environment
            .NODE_ENV
      ),
    deploymentUrl:
      deploymentHost
        ? `https://${deploymentHost}`
        : null,
    productionUrl:
      productionHost
        ? `https://${productionHost}`
        : null,
  };
}

module.exports = {
  getDeploymentMetadata,
};
