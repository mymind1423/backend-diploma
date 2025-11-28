const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { getDiplomeByReference, validateReference, diplomeLimiter } = require("../controllers/diplomeController");

router.use(authenticateToken);

router.get(
  "/:reference",
  diplomeLimiter,
  validateReference,
  getDiplomeByReference
);

module.exports = router;
