"use strict";

const MANILA_TIME_ZONE = "Asia/Manila";

function formatSqlDateUtc(date) {
  const year = date.getUTCFullYear();
  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getManilaDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: MANILA_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) =>
        ["year", "month", "day"].includes(part.type)
      )
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function buildMonthlyReportPeriod(year, month) {
  const start = new Date(Date.UTC(year, month, 1));
  const endExclusive = new Date(
    Date.UTC(year, month + 1, 1)
  );
  const monthLabel = new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      timeZone: "UTC",
    }
  ).format(start);

  return {
    start: formatSqlDateUtc(start),
    endExclusive: formatSqlDateUtc(endExclusive),
    label: `${monthLabel} ${year}`,
    snapshotKind: "MONTH_END",
  };
}

function buildAnnualReportPeriod(
  year,
  now = new Date()
) {
  const current = getManilaDateParts(now);

  if (year === current.year) {
    const currentDate = new Date(
      Date.UTC(
        current.year,
        current.month - 1,
        current.day
      )
    );
    const endExclusive = new Date(
      currentDate.getTime() + 24 * 60 * 60 * 1000
    );
    const asOfLabel = new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }
    ).format(currentDate);

    return {
      start: `${year}-01-01`,
      endExclusive: formatSqlDateUtc(endExclusive),
      label: `Year to Date ${year} (as of ${asOfLabel})`,
      snapshotKind: "CURRENT_DATE",
    };
  }

  return {
    start: `${year}-01-01`,
    endExclusive: `${year + 1}-01-01`,
    label: `Full Year ${year}`,
    snapshotKind: "YEAR_END",
  };
}

module.exports = {
  buildAnnualReportPeriod,
  buildMonthlyReportPeriod,
  getManilaDateParts,
};
