const express = require("express");
const router = express.Router();

const {
  getSmartSuggestions,
  markSmartSuggestionReviewed,
  dismissSmartSuggestion,
} = require("../controllers/smartSuggestionController");

router.get("/smart-suggestions", getSmartSuggestions);
router.post("/smart-suggestions/review", markSmartSuggestionReviewed);
router.post("/smart-suggestions/dismiss", dismissSmartSuggestion);

module.exports = router;