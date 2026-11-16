import test from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import {
  addReportContinuationHeader,
  addReportFooters,
  addReportHeader,
  formatReportRole,
  getReportUserName,
} from "../src/utils/pdf/reportPdf.js";

test("PDF identity helpers prefer verified display names and readable roles", () => {
  assert.equal(
    getReportUserName({
      first_name: "Maria",
      last_name: "Santos",
      username: "hm01",
    }),
    "Maria Santos"
  );
  assert.equal(getReportUserName({ username: "hm01" }), "Authorized User");
  assert.equal(formatReportRole("HR_MANAGER"), "HR Manager");
  assert.equal(formatReportRole("IT_SUPPORT"), "IT Support");
});

test("shared PDF design renders a multi-page A4 document with Page X of Y footers", () => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const startY = addReportHeader({
    doc,
    title: "Technical Verification Report",
    metadata: [
      ["Report scope", "Isolated rendering test"],
      ["Prepared by", "Maria Santos"],
      ["Role", "HR Manager"],
      ["Generated on", "Nov 15, 2026, 8:00 PM"],
    ],
  });
  assert.ok(startY > 45);

  doc.text("Page one content", 14, startY + 5);
  doc.addPage();
  addReportContinuationHeader(doc, "Technical Verification Report");
  doc.text("Page two content", 14, 20);
  addReportFooters(doc, { reportTitle: "Technical Verification Report" });

  assert.equal(doc.internal.getNumberOfPages(), 2);
  const bytes = doc.output("arraybuffer");
  assert.ok(bytes.byteLength > 1000);

  const secondPageText = doc.internal.pages[2].join(" ");
  assert.match(secondPageText, /Page 2 of 2/);
});