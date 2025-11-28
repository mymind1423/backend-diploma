const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const validate = require("../middleware/validate");
const { loginSchema } = require("../schemas/authSchemas");

const USERS = [
  { id: 1, username: "admin", passwordHash: bcrypt.hashSync("admin123", 10) }
];

// Middleware spécifique pour limiter les tentatives brute-force
const rateLimit = require("express-rate-limit");
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 tentatives
  message: { error: "Trop de tentatives de connexion. Réessayez plus tard." }
});

router.post("/login", loginLimiter, validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username);

  if (!user) return res.status(401).json({ error: "Utilisateur ou mot de passe invalide" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Utilisateur ou mot de passe invalide" });

  const token = jwt.sign(
    { sub: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 60 * 60 * 1000
  });

  // après avoir généré le token
  res.json({
    success: true,
    accessToken: token
  });
});

router.post("/refresh", (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: "Refresh token manquant" });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const newAccessToken = generateAccessToken({ id: decoded.sub });
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ error: "Refresh token invalide" });
  }
});


router.post("/logout", (req, res) => {
	res.clearCookie("refreshToken", { httpOnly: true, sameSite: "Strict", secure: process.env.NODE_ENV === "production" });
	res.json({ message: "Déconnecté" });
});

module.exports = router;
