/**
 * Converts legacy violation-policy formatting into safe plain text.
 *
 * SECURITY:
 * - The returned value must be rendered using normal React interpolation.
 * - Never pass the returned value into dangerouslySetInnerHTML.
 *
 * Legacy policy data currently uses:
 * - <br>, <br/>, <br /> for line breaks
 * - <strong>...</strong> for emphasis
 *
 * Unknown HTML remains plain text and will therefore be escaped by React.
 */
export function formatPolicyDescriptionAsPlainText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?strong\s*>/gi, "")
    .replace(/\r\n?/g, "\n");
}