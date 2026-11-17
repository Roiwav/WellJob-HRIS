export const RECOMMENDATIONS_PER_PAGE = 5;

function toPositiveInteger(value, fallback) {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

export function paginateRecommendations(
  recommendations,
  requestedPage = 1,
  pageSize = RECOMMENDATIONS_PER_PAGE
) {
  const records = Array.isArray(recommendations)
    ? recommendations
    : [];
  const safePageSize = toPositiveInteger(
    pageSize,
    RECOMMENDATIONS_PER_PAGE
  );
  const totalRecommendations = records.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalRecommendations / safePageSize)
  );
  const currentPage = Math.min(
    toPositiveInteger(requestedPage, 1),
    totalPages
  );
  const startIndex = (currentPage - 1) * safePageSize;
  const endIndex = Math.min(
    startIndex + safePageSize,
    totalRecommendations
  );

  return {
    currentPage,
    totalPages,
    totalRecommendations,
    recommendations: records.slice(startIndex, endIndex),
    startEntry:
      totalRecommendations === 0 ? 0 : startIndex + 1,
    endEntry: endIndex,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
  };
}