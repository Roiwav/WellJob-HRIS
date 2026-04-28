const express = require("express");
const cors = require("cors");
const path = require("path");

// 🔥 ROUTES
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const incidentRoutes = require("./routes/incidentRoutes");
const deploymentRoutes = require("./routes/deploymentRoutes");

// 🔥 INIT APP
const app = express();

// 🔥 MIDDLEWARE
app.use(cors());
app.use(express.json());

// 🔥 STATIC FILES (for documents)
app.use("/documents", express.static(path.join(__dirname, "documents")));

// 🔥 ROUTES
app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", employeeRoutes);
app.use("/api", incidentRoutes);
app.use("/api", deploymentRoutes);


// 🔥 DEFAULT TEST ROUTE (optional, pang debug)
app.get("/", (req, res) => {
  res.send("API is running...");
});

// 🔥 PORT
const PORT = process.env.PORT || 5000;

// 🔥 START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});