export default function DashboardHeader({
  selectedYear,
  setSelectedYear,
  handleExportPDF,
  lastUpdated
}) {

  return (

    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">

      <h1 className="text-2xl font-semibold">
        Workforce Dashboard
      </h1>

      <div className="flex flex-wrap items-center gap-4">

        <div className="text-sm text-gray-500">
          Last Updated:
          <span className="ml-2 font-medium text-gray-700 dark:text-gray-200">
            {lastUpdated}
          </span>
        </div>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="px-4 py-2 rounded-lg border bg-white dark:bg-slate-900"
        >
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>

        <button
          onClick={handleExportPDF}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Export PDF
        </button>

      </div>

    </div>

  );
}