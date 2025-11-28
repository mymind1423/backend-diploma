const jwt = require("jsonwebtoken");

// Exemple login
async function login(req, res) {
  const { username, password } = req.body;

  // Vérifier utilisateur (à adapter à ta base)
  if (username !== "admin" || password !== "admin123") {
    return res.status(401).json({ error: "Utilisateur ou mot de passe invalide" });
  }

  const user = { id: 1, username };

  // Générer tokens
  const accessToken = jwt.sign(
    { sub: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { sub: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  // Envoyer refresh token dans cookie sécurisé
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
  });

  // Retourner access token dans le body
  res.json({ accessToken });
}

module.exports = { login };
