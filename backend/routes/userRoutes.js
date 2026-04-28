//userRoutes.js

const express = require("express");
const router = express.Router();
const {
  getUsers,
  createUser,
  resetPassword,
  toggleStatus,
  changePassword 
} = require("../controllers/userController");

router.get("/users", getUsers);
router.post("/users", createUser);
router.put("/users/change-password", changePassword); 
router.put("/users/reset/:id", resetPassword);
router.put("/users/toggle/:id", toggleStatus);

module.exports = router;