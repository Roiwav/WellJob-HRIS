import NotificationCard from "../components/notifications/NotificationCard";
import NotificationTable from "../components/notifications/NotificationTable";

export default function Notifications() {

  const notifications = [

    {
      id: 1,
      priority: "High",
      message: "Employee Juan Dela Cruz has a disciplinary case.",
      date: "Mar 15, 2026",
      status: "Unread"
    },

    {
      id: 2,
      priority: "Medium",
      message: "Maria Santos contract will expire soon.",
      date: "Mar 18, 2026",
      status: "Unread"
    },

    {
      id: 3,
      priority: "Low",
      message: "New deployment assigned to Pedro Reyes.",
      date: "Mar 20, 2026",
      status: "Read"
    }

  ];

  return (

    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-bold">
          Notifications Center
        </h1>

        <p className="text-gray-500 text-sm">
          System alerts and employee compliance notifications
        </p>
      </div>

      {/* ALERT CARDS */}

      <div className="grid md:grid-cols-3 gap-4">

        <NotificationCard
          type="High"
          message="1 High Risk Employee Detected"
          date="Today"
        />

        <NotificationCard
          type="Medium"
          message="3 Expiring Employee Documents"
          date="Today"
        />

        <NotificationCard
          type="Low"
          message="2 New Deployments Recorded"
          date="Today"
        />

      </div>

      {/* TABLE */}

      <NotificationTable notifications={notifications} />

    </div>

  );
}