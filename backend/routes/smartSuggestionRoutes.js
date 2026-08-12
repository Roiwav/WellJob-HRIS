const express = require("express");

const router = express.Router();

const {
  getSmartSuggestions,
} = require("../controllers/smartSuggestionController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

router.get(
  "/smart-suggestions",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER"
  ),
  getSmartSuggestions
);

module.exports = router;