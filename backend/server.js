const path = require("path");

// 🔐 LOAD ENVIRONMENT VARIABLES FIRST
require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const express = require("express");
const cors = require("cors");

// 🔐 MAINTENANCE MIDDLEWARE
const checkMaintenanceMode = require(
  "./middleware/maintenanceMiddleware"
);

// 🔥 ROUTES
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const incidentRoutes = require("./routes/incidentRoutes");
const deploymentRoutes = require("./routes/deploymentRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const kpiDecisionRoutes = require("./routes/kpiDecisionRoutes");
const smartAlertRoutes = require("./routes/smartAlertRoutes");
const smartSuggestionRoutes = require("./routes/smartSuggestionRoutes");
const settingsRoutes = require("./routes/settingsRoutes");

// 🔥 INIT APP
const app = express();

// 🔥 CORE MIDDLEWARE
app.use(cors());
app.use(express.json());

// 🔥 STATIC FILES
app.use(
  "/documents",
  express.static(
    path.join(__dirname, "documents")
  )
);

/*
 * SYSTEM MAINTENANCE GATE
 *
 * Applied only to /api requests.
 *
 * When maintenance mode is OFF:
 * - requests continue normally.
 *
 * When maintenance mode is ON:
 * - login remains reachable,
 * - maintenance status/toggle remain reachable,
 * - valid IT_SUPPORT JWT requests may continue,
 * - all other API users receive HTTP 503.
 *
 * Individual routes still enforce their own
 * authentication and RBAC after this middleware.
 */
app.use(
  "/api",
  checkMaintenanceMode
);

// 🔥 API ROUTES
app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", employeeRoutes);
app.use("/api", incidentRoutes);
app.use("/api", deploymentRoutes);
app.use("/api", kpiDecisionRoutes);
app.use("/api", smartAlertRoutes);
app.use("/api", smartSuggestionRoutes);
app.use("/api", auditLogRoutes);
app.use("/api", settingsRoutes);

// 🔥 DEFAULT TEST ROUTE
app.get("/", (req, res) => {
  res.send("API is running...");
});

// 🔥 PORT
const PORT =
  process.env.PORT || 5000;

// 🔥 START SERVER
app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});