// middleware/auth.js
require("dotenv").config();
const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  // 1) vérifier cookie 'token'
  const tokenFromCookie = req.cookies && req.cookies.token;

  // 2) ou header Authorization: Bearer <token>
  const authHeader = req.headers["authorization"];
  const tokenFromHeader = authHeader && authHeader.split(" ")[1];

  const token = tokenFromCookie || tokenFromHeader;
  if (!token) return res.status(401).json({ error: "Token manquant" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

module.exports = {
  authenticateToken
};
