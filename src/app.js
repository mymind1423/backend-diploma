// server.js
require('dotenv').config({ path: __dirname + '/.env' });
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const path = require('path');

const ocrRoutes = require("./routes/ocrRoutes");
const diplomeRoutes = require("./routes/diplomeRoutes");
const authRoutes = require("./routes/authRoutes");
const statsRoutes = require("./routes/statsRoutes");
const studentsRoutes = require("./routes/studentsRoutes");
const { authenticateToken } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

/* ------------------------------------------------------------------
   1️⃣ Autoriser les images statiques (sinon NotSameOrigin)
------------------------------------------------------------------ */
app.use("/pictures", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

/* ------------------------------------------------------------------
   2️⃣ Rendre le dossier /upload/pictures /upload/diplomes /upload/releves accessible
------------------------------------------------------------------ */
app.use(
  "/pictures",
  express.static(path.join(__dirname, "../uploads/pictures"))
);

app.use(
  "/diplomes",
  express.static(path.join(__dirname, "../uploads/diplomes"))
);

app.use(
  "/releves",
  express.static(path.join(__dirname, "../uploads/releves"))
);


console.log("📁 Static images path:", path.join(__dirname, "../upload/pictures"));

/* ------------------------------------------------------------------
   3️⃣ Helmet (allégé pour permettre les images)
------------------------------------------------------------------ */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "http://localhost:3000"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

/* ------------------------------------------------------------------
   4️⃣ CORS sécurisé pour API (mais pas pour /pictures)
------------------------------------------------------------------ */
const AllowedOrigin = [
  "https://diploma-checker.vercel.app",
  "http://localhost:50566"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (AllowedOrigin.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});


app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(morgan("combined"));

/* ------------------------------------------------------------------
   5️⃣ Rate limiting
------------------------------------------------------------------ */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Trop de tentatives de connexion. Réessayez plus tard." }
});
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Trop de fichiers uploadés. Réessayez plus tard." }
});

app.use("/api/auth/login", loginLimiter);
app.use("/api/ocr/upload", uploadLimiter);

/* ------------------------------------------------------------------
   6️⃣ Routes API
------------------------------------------------------------------ */
app.use("/api/auth", authRoutes);
app.use("/api/stats", authenticateToken, statsRoutes);
app.use("/api/students", authenticateToken, studentsRoutes);
app.use("/api/ocr", authenticateToken, ocrRoutes);
app.use("/api/diplomes", authenticateToken, diplomeRoutes);

/* ------------------------------------------------------------------
   7️⃣ 404 handler
------------------------------------------------------------------ */
app.use((req, res) => {
  res.status(404).json({ error: "Route introuvable" });
});

/* ------------------------------------------------------------------
   8️⃣ Error handler
------------------------------------------------------------------ */
app.use((err, req, res, next) => {
  console.error(err);
  const msg = isProd ? "Erreur interne" : err.message;
  res.status(err.status || 500).json({ error: msg });
});

/* ------------------------------------------------------------------
   9️⃣ Start server
------------------------------------------------------------------ */
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));








