import { useState, useEffect } from "react";
import DeploymentTable from "../components/deployments/DeploymentTable";
import DeploymentModal from "../components/deployments/DeploymentModal";

export default function Deployments() {

  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [deployments, setDeployments] = useState([]);

  // 🔥 LOAD DEPLOYMENTS FROM LOCAL STORAGE
  useEffect(() => {
    const stored =
      JSON.parse(localStorage.getItem("deployments")) || [];

    setDeployments(stored);
  }, []);

  return (

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
        openModal={setSelectedDeployment}
      />

      <DeploymentModal
        deployment={selectedDeployment}
        close={() => setSelectedDeployment(null)}
      />

    </div>

  );
}