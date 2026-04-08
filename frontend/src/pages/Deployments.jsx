import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import DeploymentTable from "../components/deployments/DeploymentTable";
import DeploymentModal from "../components/deployments/DeploymentModal";

/* 🔥 TOAST */
function Toast({ show, message }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed bottom-6 right-6 z-[9999] transform transition-all duration-500 ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <div className="bg-green-600 text-white px-5 py-3 rounded shadow-lg">
        {message}
      </div>
    </div>,
    document.body
  );
}

export default function Deployments() {

  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [modalMode, setModalMode] = useState("view");
  const [deployments, setDeployments] = useState([]);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const stored =
      JSON.parse(localStorage.getItem("deployments")) || [];
    setDeployments(stored);
  }, []);

  const openView = (deployment) => {
    setModalMode("view");
    setSelectedDeployment(deployment);
  };

  const openEdit = (deployment) => {
    setModalMode("edit");
    setSelectedDeployment(deployment);
  };

  // 🔥 FIX: UPDATE FUNCTION
  const updateDeployment = (updated) => {
    const updatedList = deployments.map((d) =>
      d.id === updated.id ? updated : d
    );

    setDeployments(updatedList);
    localStorage.setItem("deployments", JSON.stringify(updatedList));

    // 🔥 TOAST
    setShowToast(false);

    setTimeout(() => {
      setToastMessage("Deployment updated successfully!");
      setShowToast(true);

      setTimeout(() => setShowToast(false), 2000);
    }, 50);
  };

  return (
    <>
      <div className="space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Deployment Tracking
          </h1>

          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Monitor employee deployments across client companies
          </p>
        </div>

        <DeploymentTable
          deployments={deployments}
          openView={openView}
          openEdit={openEdit}
        />

        <DeploymentModal
          deployment={selectedDeployment}
          mode={modalMode}
          onUpdate={updateDeployment} // 🔥 IMPORTANT
          close={() => setSelectedDeployment(null)}
        />

      </div>

      <Toast show={showToast} message={toastMessage} />
    </>
  );
}