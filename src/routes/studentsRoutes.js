const express = require("express");
const router = express.Router();
const { getStudents } = require("../controllers/studentsController");
const { authenticateToken } = require("../middleware/auth");

router.use(authenticateToken);

router.get("/", getStudents);

module.exports = router;
