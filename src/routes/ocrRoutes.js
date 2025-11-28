const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { uploadOCR, upload, ocrUploadLimiter } = require("../controllers/ocrController");

router.use(authenticateToken);

router.post("/upload", ocrUploadLimiter, upload.single("file"), uploadOCR);

router.get("/ping", (req, res) => res.json({ message: "OCR OK" }));

module.exports = router;
