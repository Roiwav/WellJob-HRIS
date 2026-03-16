import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ReportGenerator({ employees }) {

  const generateReport = () => {

    const doc = new jsPDF();

    doc.text("KPI Compliance Report", 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [["Employee", "Company", "Violations"]],
      body: employees.map(e => [
        e.name,
        e.company,
        e.violationCount
      ])
    });

    doc.save("kpi-report.pdf");
  };

  return (

    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">

      <h3 className="font-semibold text-lg mb-4">
        Reports Center
      </h3>

      <button
        onClick={generateReport}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        Generate KPI Report
      </button>

    </div>
  );
}