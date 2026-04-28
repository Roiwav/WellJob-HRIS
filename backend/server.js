// server.js

const express = require("express");
const cors = require("cors");
const path = require("path");

// 🔥 ROUTES
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const incidentRoutes = require("./routes/incidentRoutes");
const deploymentRoutes = require("./routes/deploymentRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");

// 🔥 KUNIN ANG CHANGE PASSWORD FUNCTION
const { changePassword } = require("./controllers/userController");

// 🔥 INIT APP
const app = express();

// 🔥 MIDDLEWARE
app.use(cors());
app.use(express.json());

// 🔥 STATIC FILES (for documents)
app.use("/documents", express.static(path.join(__dirname, "documents")));

// 🚀 DIRECT ROUTE (Ito ang fix! Para sigurado tayong babasahin niya ito bago ang iba)
app.put("/api/users/change-password", changePassword);

// 🔥 ROUTES
app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", employeeRoutes);
app.use("/api", incidentRoutes);
app.use("/api", deploymentRoutes);

app.use("/api", auditLogRoutes);

// 🔥 DEFAULT TEST ROUTE
app.get("/", (req, res) => {
  res.send("API is running...");
});

// 🔥 PORT
const PORT = process.env.PORT || 5000;

// 🔥 START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});