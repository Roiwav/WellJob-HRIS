import { createPortal } from "react-dom";

export default function DeploymentToast({ show, message }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed bottom-6 right-6 z-[9999] transform transition-all duration-500 ${
        show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
      }`}
    >
      <div className="rounded-xl bg-green-600 px-5 py-3 text-white shadow-lg">
        {message}
      </div>
    </div>,
    document.body
  );
}