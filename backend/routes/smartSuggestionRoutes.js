const express = require("express");
const router = express.Router();

const { getSmartSuggestions } = require("../controllers/smartSuggestionController");

router.get("/smart-suggestions", getSmartSuggestions);

module.exports = router;