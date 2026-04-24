import {
  FiAward,
  FiBarChart2,
  FiCheckCircle,
  FiInfo,
  FiLock,
} from "react-icons/fi";

const RATING_SCALE = [
  {
    range: "75% Below",
    rating: "UNSATISFACTORY",
    description:
      "Performance level is absolutely UNACCEPTABLE; FAILS to meet minimum requirements",
    frequency:
      "Frequency of Poor Rating: 1st - Considered one more chance | 2nd - Demotion | 3rd - Termination",
    style: "bg-red-50 text-red-700 border-red-200",
  },
  {
    range: "75%–79%",
    rating: "BELOW SATISFACTORY",
    description:
      "Performance level is NORMALLY ACCEPTABLE; meets minimum requirements",
    frequency: "",
    style: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    range: "80%–87%",
    rating: "SATISFACTORY",
    description:
      "Performance level is MODERATELY ACCEPTABLE; OCCASIONALLY exceeds requirements",
    frequency: "",
    style: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  {
    range: "88%–94%",
    rating: "VERY SATISFACTORY",
    description:
      "Performance level is HIGHLY ACCEPTABLE; FREQUENTLY exceeds requirements",
    frequency: "",
    style: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    range: "95%–100%",
    rating: "[EXCELLENT]",
    description:
      "Performance level is EXCEPTIONAL; CONSISTENTLY exceeds requirements",
    frequency: "",
    style: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
];

const KPI_FACTORS = [
  {
    weight: "10%",
    factor: "I. ATTENDANCE AND PUNCTUALITY",
    description: "(Pagpasok at kahustuhan sa oras)",
    subFactors: [
      "No. of leave of absences",
      "(bilang ng araw ng pagliban na may kaukulang pahintulot)",
      "No. of Absences without Leave",
      "(bilang ng pagliban na walang pahintulot)",
      "Accumulated Tardiness",
      "(kabuuang bilang sa huling oras na itinakda sa pagpasok)",
      "Unauthorized Undertime",
      "(hindi pagbuo sa walong oras (8) na itinakdang pagpasok)",
    ],
  },
  {
    weight: "15%",
    factor: "II. SAFETY AND HOUSEKEEPING",
    description:
      "Concern for order and cleanliness of work area, including proper decorum at work.",
    subFactors: [
      "Understanding / implementing 5’s",
      "(pagpapanatili ng kaayusan at kalinisan sa trabaho)",
    ],
  },
  {
    weight: "5%",
    factor: "III. DEPENDABILITY AND RELIABILITY",
    description:
      "Worthy of confidence, responsible, tried and true solidness; trustability.",
    subFactors: ["(Mapagkakatiwalaan at mapapanagutan sa trabaho)"],
  },
  {
    weight: "20%",
    factor: "IV. JOB WORK ATTITUDE / BEHAVIOR",
    description:
      "General attitude toward work such as desire for self-improvement willingness to help and cooperate with the group, inherent trait of flexibility and resourcefulness in handling situation.",
    subFactors: [
      "Kabuuang pagpapakita sa saloobin patungkol sa trabaho",
      "pagpapabuti sa sarili, kahandaang tumulong",
      "At makipagtulungan sa pangkat at kakayahang umangkop",
      "at kapamaraanan sa paghawak ng sitwasyon",
    ],
  },
  {
    weight: "50%",
    factor: "V. COMPLETION OF WORK",
    description: "Ability to meet deadlines and target output.",
    subFactors: [
      "(Kakayahang matapos ang gawain sa itinakdang araw)",
      "QUALITY AND EFFICIENCY (Kalidad at kahusayan sa trabaho)",
      "ACCURACY (Katumpakan o ganap na kawastuhan)",
      "TIMELINESS (Pagiging napapanahon o maagap)",
      "IMPLEMENTATION AND EXECUTION (Pagsasagawa at pagsasakatuparan)",
    ],
  },
];

export default function KPIThresholdsTab() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-7">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
              <FiBarChart2 size={22} />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-white">
                KPI Evaluation Framework
              </h2>
              <p className="mt-2 text-sm text-emerald-100">
                Fixed company performance rating scale
              </p>
            </div>
          </div>
        </div>

        {/* RATING SCALE */}
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
              Rating Scale
            </h3>

            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <FiLock size={14} />
              Fixed
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {RATING_SCALE.map((item, index) => (
              <div
                key={index}
                className={`rounded-2xl border p-4 shadow-sm ${item.style}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{item.range}</span>
                  <FiAward size={16} />
                </div>

                <h4 className="mt-2 text-base font-extrabold">
                  {item.rating}
                </h4>

                <p className="mt-2 text-xs leading-5">
                  {item.description}
                </p>

                {item.frequency && (
                  <div className="mt-3 rounded-xl bg-white/70 p-2 text-xs font-medium">
                    {item.frequency}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* KPI FACTORS */}
        <div className="border-t border-gray-200 p-6 dark:border-white/10">
          <h3 className="mb-6 text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
            KPI Factors
          </h3>

          <div className="space-y-4">
            {KPI_FACTORS.map((item, index) => (
              <div
                key={index}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">
                      {item.factor}
                    </h4>

                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {item.description}
                    </p>
                  </div>

                  <span className="rounded-xl bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                    {item.weight}
                  </span>
                </div>

                <div className="mt-4 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {item.subFactors.map((sub, i) => (
                    <p key={i} className="flex gap-2">
                      <FiCheckCircle className="mt-1 text-emerald-500" size={14} />
                      <span>{sub}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-800">
          <div className="flex gap-3">
            <FiInfo className="mt-0.5 shrink-0" />
            <p className="text-sm leading-6">
              KPI ratings are based on the company evaluation sheet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}