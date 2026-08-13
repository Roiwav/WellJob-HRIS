const express = require("express");

const router = express.Router();

const {
  getSmartSuggestions,
} = require("../controllers/smartSuggestionController");

const {
  takeSmartSuggestionAction,
  dismissSmartSuggestion,
} = require("../controllers/smartSuggestionStateController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

const SMART_SUGGESTION_ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
];

/*
 * GET SMART SUGGESTIONS
 *
 * Existing deterministic / rule-based DSS.
 *
 * Do not change:
 * - thresholds
 * - prioritization
 * - recommendation rules
 * - category rules
 *
 * Accessible only to:
 * - SUPER_ADMIN
 * - HR_MANAGER
 */
router.get(
  "/smart-suggestions",
  verifyToken,
  authorizeRoles(
    ...SMART_SUGGESTION_ROLES
  ),
  getSmartSuggestions
);

/*
 * SAVE SMART SUGGESTION ACTION
 *
 * Expected compatibility payload:
 * {
 *   userKey,
 *   role,
 *   suggestionKey,
 *   actionType,
 *   actionNotes
 * }
 *
 * SECURITY:
 * userKey and role in the request body are NOT
 * used for authorization or state ownership.
 *
 * Trusted identity comes from verifyToken -> req.user.
 */
router.post(
  "/smart-suggestions/action",
  verifyToken,
  authorizeRoles(
    ...SMART_SUGGESTION_ROLES
  ),
  takeSmartSuggestionAction
);

/*
 * DISMISS SMART SUGGESTION
 *
 * Expected compatibility payload:
 * {
 *   userKey,
 *   role,
 *   suggestionKey,
 *   dismissReason
 * }
 *
 * SECURITY:
 * userKey and role in the request body are NOT
 * used for authorization or state ownership.
 *
 * Trusted identity comes from verifyToken -> req.user.
 */
router.post(
  "/smart-suggestions/dismiss",
  verifyToken,
  authorizeRoles(
    ...SMART_SUGGESTION_ROLES
  ),
  dismissSmartSuggestion
);

module.exports = router;