import { useState } from "react";
import DeploymentTable from "../components/deployments/DeploymentTable";
import DeploymentModal from "../components/deployments/DeploymentModal";

export default function Deployments() {

  const [selectedDeployment, setSelectedDeployment] = useState(null);

  const deployments = [
    {
      id: 1,
      employee: "Juan Dela Cruz",
      company: "ABC Security",
      location: "Manila",
      start: "2026-01-10",
      end: "2026-06-10",
      status: "Active"
    },
    {
      id: 2,
      employee: "Maria Santos",
      company: "XYZ Corp",
      location: "Laguna",
      start: "2026-02-01",
      end: "2026-07-01",
      status: "Pending"
    },
    {
      id: 3,
      employee: "Pedro Reyes",
      company: "Delta Inc",
      location: "Cavite",
      start: "2025-08-01",
      end: "2026-02-01",
      status: "Completed"
    }
  ];

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