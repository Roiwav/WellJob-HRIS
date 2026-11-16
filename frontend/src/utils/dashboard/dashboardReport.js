export function buildDashboardCompanyActivityRows(
  companies = []
) {
  return (Array.isArray(companies) ? companies : []).map(
    (company) => [
      company.company,
      company.floatingStandby,
      company.deployed,
      company.endedDeployments,
      company.incidents,
    ]
  );
}