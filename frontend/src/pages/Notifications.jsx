import { useEffect, useState } from "react";
import NotificationCard from "../components/notifications/NotificationCard";
import NotificationTable from "../components/notifications/NotificationTable";

const INCIDENTS_KEY = "incidents";

export default function Notifications() {

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = () => {
    const incidents = JSON.parse(localStorage.getItem(INCIDENTS_KEY)) || [];

    const mapped = incidents.map((incident) => ({
      id: incident.id,
      reportedBy: incident.reportedBy || "Unknown",
      employee: incident.employee,
      violation: incident.violation,
      severity: incident.severity,
      status: incident.status,
      date: incident.date
    }));

    setNotifications(mapped.reverse());
  };

  // 🔥 COUNT CARDS
  const highCount = notifications.filter(n => n.severity === "Critical").length;
  const mediumCount = notifications.filter(n => n.severity === "Major").length;
  const lowCount = notifications.filter(n => n.severity === "Minor").length;

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Notifications Center
        </h1>

        <p className="text-gray-500 dark:text-gray-400 text-sm">
          System alerts and employee compliance notifications
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">

        <NotificationCard
          type="High"
          message={`${highCount} Critical Incidents`}
          date="Today"
        />

        <NotificationCard
          type="Medium"
          message={`${mediumCount} Major Incidents`}
          date="Today"
        />

        <NotificationCard
          type="Low"
          message={`${lowCount} Minor Incidents`}
          date="Today"
        />

      </div>

      <NotificationTable notifications={notifications} />

    </div>
  );
}