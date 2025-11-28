const express = require("express");
const router = express.Router();
const { getStats } = require("../controllers/statsController");
const { authenticateToken } = require("../middleware/auth");

router.get("/", authenticateToken, getStats);

module.exports = router;
