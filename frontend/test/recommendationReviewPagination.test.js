import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  RECOMMENDATIONS_PER_PAGE,
  paginateRecommendations,
} from "../src/utils/kpi/recommendationPagination.js";

const recommendations = Array.from(
  { length: 12 },
  (_, index) => ({
    id: index + 1,
    name: `Employee ${index + 1}`,
  })
);

test("Recommendation Review displays five ordered records per page", () => {
  const firstPage = paginateRecommendations(
    recommendations,
    1
  );
  const secondPage = paginateRecommendations(
    recommendations,
    2
  );

  assert.equal(RECOMMENDATIONS_PER_PAGE, 5);
  assert.deepEqual(
    firstPage.recommendations.map(({ id }) => id),
    [1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    secondPage.recommendations.map(({ id }) => id),
    [6, 7, 8, 9, 10]
  );
  assert.equal(firstPage.totalPages, 3);
  assert.equal(firstPage.totalRecommendations, 12);
  assert.equal(firstPage.startEntry, 1);
  assert.equal(firstPage.endEntry, 5);
  assert.equal(secondPage.startEntry, 6);
  assert.equal(secondPage.endEntry, 10);
});

test("Recommendation Review exposes correct Previous and Next states", () => {
  const firstPage = paginateRecommendations(
    recommendations,
    1
  );
  const middlePage = paginateRecommendations(
    recommendations,
    2
  );
  const lastPage = paginateRecommendations(
    recommendations,
    3
  );

  assert.equal(firstPage.hasPreviousPage, false);
  assert.equal(firstPage.hasNextPage, true);
  assert.equal(middlePage.hasPreviousPage, true);
  assert.equal(middlePage.hasNextPage, true);
  assert.equal(lastPage.hasPreviousPage, true);
  assert.equal(lastPage.hasNextPage, false);
  assert.deepEqual(
    lastPage.recommendations.map(({ id }) => id),
    [11, 12]
  );
});

test("filtered totals are calculated before pagination without duplicates", () => {
  const filteredRecommendations = recommendations.filter(
    ({ id }) => id % 2 === 0
  );
  const firstPage = paginateRecommendations(
    filteredRecommendations,
    1
  );
  const secondPage = paginateRecommendations(
    filteredRecommendations,
    2
  );
  const visibleIds = [
    ...firstPage.recommendations,
    ...secondPage.recommendations,
  ].map(({ id }) => id);

  assert.equal(firstPage.totalRecommendations, 6);
  assert.equal(firstPage.totalPages, 2);
  assert.deepEqual(visibleIds, [2, 4, 6, 8, 10, 12]);
  assert.equal(new Set(visibleIds).size, visibleIds.length);
});

test("empty results and reduced datasets clamp to the nearest valid page", () => {
  const emptyPage = paginateRecommendations([], 4);
  const reducedPage = paginateRecommendations(
    recommendations.slice(0, 6),
    3
  );

  assert.equal(emptyPage.currentPage, 1);
  assert.equal(emptyPage.totalPages, 1);
  assert.equal(emptyPage.startEntry, 0);
  assert.equal(emptyPage.endEntry, 0);
  assert.deepEqual(emptyPage.recommendations, []);
  assert.equal(reducedPage.currentPage, 2);
  assert.deepEqual(
    reducedPage.recommendations.map(({ id }) => id),
    [6]
  );
});

test("Recommendation Review keeps existing cards, permissions, and decision workflows", async () => {
  const testDirectory = dirname(fileURLToPath(import.meta.url));
  const source = await readFile(
    resolve(
      testDirectory,
      "../src/components/kpi/sections/RecommendationReviewSection.jsx"
    ),
    "utf8"
  );

  assert.match(source, /pagination\.recommendations\.map/);
  assert.match(source, /setCurrentPage\(1\)/);
  assert.match(
    source,
    /currentPage !== pagination\.currentPage[\s\S]*setCurrentPage\(pagination\.currentPage\)/
  );
  assert.doesNotMatch(
    source.slice(
      source.indexOf("async function handleSaved"),
      source.indexOf("return (", source.indexOf("async function handleSaved"))
    ),
    /setSearch/
  );
  assert.match(source, /<PendingRecommendationCard/);
  assert.match(source, /<ReviewRecommendationModal/);
  assert.match(source, /canManageDecisions={\s*canManageDecisions\s*}/);
  assert.match(source, /onSaved={handleSaved}/);
  assert.match(source, /Accept Recommendation/);
  assert.match(source, /Modify HR Action/);
  assert.match(source, /Reject Recommendation/);
  assert.match(source, /aria-label="Show previous recommendation page"/);
  assert.match(source, /aria-label="Show next recommendation page"/);
  assert.match(source, /sm:flex-row/);
});