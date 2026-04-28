import {
  FiAlertTriangle,
  FiCheckCircle,
} from "react-icons/fi";

export function CustomAlert({ type = "error", title, message, onClose }) {
  const isSuccess = type === "success";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div
          className={`px-6 py-5 ${
            isSuccess
              ? "bg-gradient-to-r from-emerald-600 to-green-600"
              : "bg-gradient-to-r from-red-600 to-rose-600"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
              {isSuccess ? (
                <FiCheckCircle size={24} />
              ) : (
                <FiAlertTriangle size={24} />
              )}
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-white">{title}</h3>
              <p className="mt-1 text-sm text-white/85">{message}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm ${
              isSuccess
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export function SectionTitle({ icon, title }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
      {icon}
      {title}
    </h3>
  );
}

export function Field({ label, required = false, icon = null, children }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        {icon}
        <span>
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      </label>
      {children}
    </div>
  );
}

export function ReadonlyBadge({ label, value, styleMap, placeholder }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}
      </label>

      <div className="flex min-h-[46px] items-center rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-900">
        {value ? (
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
              styleMap[value] || "border-gray-200 bg-gray-100 text-gray-700"
            }`}
          >
            {value}
          </span>
        ) : (
          <span className="text-sm text-gray-400">{placeholder}</span>
        )}
      </div>
    </div>
  );
}

export function PolicyCard({ formData }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        Policy Reference
      </p>

      <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">
        {formData.violationCategory} • {formData.violationSection}
      </p>

      <p
        className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400"
        dangerouslySetInnerHTML={{
          __html: formData.violationDescription || "",
        }}
      />
    </div>
  );
}

export function PenaltiesCard({ penalties = [], offenseCount }) {
  if (!Array.isArray(penalties) || penalties.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Penalties
        </p>
        <p className="mt-2 text-sm text-gray-500">No penalties configured.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        Penalties
      </p>

      <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
        {penalties.map((penalty, index) => {
          const isSelected =
            Number(penalty?.offenseNo) === Number(offenseCount);

          return (
            <li
              key={`${penalty?.label || "penalty"}-${index}`}
              className={`flex gap-2 rounded-xl px-2 py-1.5 ${
                isSelected
                  ? "bg-red-50 font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300"
                  : ""
              }`}
            >
              <span className="text-red-500">•</span>
              <span>
                <span className="font-semibold">
                  {penalty?.label || `${index + 1} offense`}:
                </span>{" "}
                {penalty?.action || "No penalty specified"}
                {isSelected && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                    Selected
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ReviewItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}

export function FooterButtons({ children }) {
  return (
    <div className="flex justify-end gap-3 border-t border-gray-200 bg-white pt-5 dark:border-white/10 dark:bg-slate-900">
      {children}
    </div>
  );
}

export function ModalStyle() {
  return (
    <style>{`
      .input-field {
        width: 100%;
        border-radius: 0.875rem;
        border: 1px solid rgb(209 213 219);
        background: white;
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        outline: none;
      }

      .input-field:focus {
        border-color: rgb(239 68 68);
        box-shadow: 0 0 0 3px rgb(254 226 226);
      }

      .dark .input-field {
        border-color: rgba(255, 255, 255, 0.1);
        background: rgb(15 23 42);
        color: white;
      }

      .dark .input-field::placeholder {
        color: rgb(148 163 184);
      }
    `}</style>
  );
}