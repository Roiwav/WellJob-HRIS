export function clarifyActiveAssessmentText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(
      /\bHigh confidence because\b/gi,
      "Strong rule indicators are present because"
    )
    .replace(
      /\bModerate confidence because\b/gi,
      "Moderate rule indicators are present because"
    )
    .replace(
      /\bLow confidence because\b/gi,
      "Limited rule indicators are present because"
    )
    .replace(
      /\bconfidence level\b/gi,
      "rule-based assessment"
    )
    .replace(
      /\b(\d+(?:\.\d+)?)\s+(?:total recorded|recorded|active) violation\(s\)/gi,
      (_, count) =>
        `${count} ${Number(count) === 1 ? "violation" : "violations"} still counted`
    )
    .replace(
      /\b(\d+(?:\.\d+)?)\s+violation\(s\)/gi,
      (_, count) =>
        `${count} ${Number(count) === 1 ? "violation" : "violations"} still counted`
    )
    .replace(
      /\b(\d+(?:\.\d+)?)\s+critical incident\(s\)/gi,
      (_, count) =>
        `${count} critical ${Number(count) === 1 ? "incident" : "incidents"}`
    )
    .replace(
      /\b(\d+(?:\.\d+)?)\s+critical case\(s\)/gi,
      (_, count) =>
        `${count} critical ${Number(count) === 1 ? "case" : "cases"}`
    )
    .replace(
      /\b(\d+(?:\.\d+)?)\s+incident\(s\)/gi,
      (_, count) =>
        `${count} ${Number(count) === 1 ? "incident" : "incidents"}`
    )
    .replace(
      /\b(\d+(?:\.\d+)?)\s+((?:[\w-]+\s+)*)case\(s\)/gi,
      (_, count, description) =>
        `${count} ${description}${Number(count) === 1 ? "case" : "cases"}`
    )
    .replace(
      /\b(\d+(?:\.\d+)?)\s+time\(s\)/gi,
      (_, count) =>
        `${count} ${Number(count) === 1 ? "time" : "times"}`
    )
    .replace(
      /\bhistorical severity score\b/gi,
      "Original total severity points"
    )
    .replace(
      /\bactive severity score\b/gi,
      "current severity score"
    )
    .replace(
      /\btotal severity score\b/gi,
      "current severity score"
    )
    .replace(
      /(?<!current )(?<!historical )(?<!original total )\bseverity score\b/gi,
      "current severity score"
    )
    .replace(
      /\ban current severity score\b/gi,
      "a current severity score"
    );
}

export function formatCount(count, singular, plural = `${singular}s`) {
  const safeCount = Number(count || 0);
  return `${safeCount} ${safeCount === 1 ? singular : plural}`;
}

export function getRuleIndicatorLabel(value) {
  switch (value) {
    case "High Confidence":
      return "Strong Rule Indicators";
    case "Moderate Confidence":
      return "Moderate Rule Indicators";
    case "Low Confidence":
    default:
      return "Limited Rule Indicators";
  }
}