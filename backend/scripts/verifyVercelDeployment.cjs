"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(
      filePath,
      "utf8"
    )
  );
}

function getVercelToken() {
  if (
    String(
      process.env.VERCEL_TOKEN ||
        ""
    ).trim()
  ) {
    return process.env.VERCEL_TOKEN.trim();
  }

  const home = os.homedir();
  const appData =
    process.env.APPDATA ||
    path.join(
      home,
      "AppData",
      "Roaming"
    );
  const localAppData =
    process.env.LOCALAPPDATA ||
    path.join(
      home,
      "AppData",
      "Local"
    );

  const candidates = [
    path.join(
      appData,
      "com.vercel.cli",
      "Data",
      "auth.json"
    ),
    path.join(
      appData,
      "com.vercel.cli",
      "auth.json"
    ),
    path.join(
      home,
      ".vercel",
      "auth.json"
    ),
    path.join(
      localAppData,
      "com.vercel.cli",
      "Data",
      "auth.json"
    ),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const auth = readJson(candidate);
    const token = String(
      auth.token ||
        ""
    ).trim();

    if (token) {
      return token;
    }
  }

  throw new Error(
    "No Vercel CLI authentication token is available."
  );
}

async function getLatestProductionDeployment(
  project,
  token
) {
  const query =
    new URLSearchParams({
      projectId:
        project.projectId,
      teamId:
        project.orgId,
      target:
        "production",
      limit:
        "10",
    });

  const response =
    await fetch(
      `https://api.vercel.com/v6/deployments?${query}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    );

  if (!response.ok) {
    throw new Error(
      `Vercel deployment lookup failed with HTTP ${response.status}.`
    );
  }

  const data =
    await response.json();
  const deployments =
    Array.isArray(
      data.deployments
    )
      ? data.deployments
      : [];

  const deployment =
    deployments.find(
      (item) =>
        item.readyState ===
        "READY"
    ) ||
    deployments[0] ||
    null;

  if (!deployment) {
    return {
      project:
        project.projectName,
      deployment:
        null,
    };
  }

  const meta =
    deployment.meta ||
    {};

  return {
    project:
      project.projectName,
    deployment: {
      id:
        deployment.uid,
      url:
        deployment.url
          ? `https://${deployment.url}`
          : null,
      readyState:
        deployment.readyState,
      target:
        deployment.target,
      createdAt:
        Number.isFinite(
          Number(
            deployment.created
          )
        )
          ? new Date(
              Number(
                deployment.created
              )
            ).toISOString()
          : null,
      gitCommitSha:
        meta.githubCommitSha ||
        meta.gitlabCommitSha ||
        meta.bitbucketCommitSha ||
        null,
      gitCommitRef:
        meta.githubCommitRef ||
        meta.gitlabCommitRef ||
        meta.bitbucketCommitRef ||
        null,
      gitCommitMessage:
        meta.githubCommitMessage ||
        meta.gitlabCommitMessage ||
        meta.bitbucketCommitMessage ||
        null,
    },
  };
}

async function main() {
  const repositoryRoot =
    path.resolve(
      __dirname,
      "..",
      ".."
    );
  const token =
    getVercelToken();
  const projectFiles = [
    path.join(
      repositoryRoot,
      "frontend",
      ".vercel",
      "project.json"
    ),
    path.join(
      repositoryRoot,
      "backend",
      ".vercel",
      "project.json"
    ),
  ];

  const projects =
    projectFiles.map(
      readJson
    );

  const results =
    await Promise.all(
      projects.map(
        (project) =>
          getLatestProductionDeployment(
            project,
            token
          )
      )
    );

  console.log(
    JSON.stringify(
      results,
      null,
      2
    )
  );
}

main().catch(
  (error) => {
    console.error(
      `VERCEL DEPLOYMENT VERIFICATION FAILED: ${error.message}`
    );
    process.exitCode = 1;
  }
);
