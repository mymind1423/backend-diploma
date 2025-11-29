const oracledb = require("oracledb");
const Joi = require("joi");
const rateLimit = require("express-rate-limit");
const QRCode = require("qrcode");
const fs = require("fs");

// --------------------
// Configuration Oracle
// --------------------
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  connectString: `(DESCRIPTION=
      (ADDRESS=(PROTOCOL=TCP)(HOST=${process.env.DB_HOST})(PORT=${process.env.DB_PORT}))
      (CONNECT_DATA=(SERVICE_NAME=${process.env.DB_SERVICE}))
    )`
};

// --------------------
// Validation Joi pour la référence
// --------------------
const refSchema = Joi.object({
  reference: Joi.string().alphanum().min(5).max(20).required()
});

function validateReference(req, res, next) {
  const { error, value } = refSchema.validate(req.params);
  if (error) {
    return res.status(400).json({
      error: "Référence invalide",
      details: error.details.map(d => d.message)
    });
  }
  req.params = value;
  next();
}

// --------------------
// Rate limiter spécifique
// --------------------
const diplomeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 requêtes par IP
  message: { error: "Trop de requêtes, réessayez plus tard." }
});

// --------------------
// Controller sécurisé
// --------------------
async function getDiplomeByReference(req, res) {
  const { reference } = req.params;

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      "SELECT * FROM diplomes WHERE reference = :ref",
      [reference],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "Diplôme non trouvé", reference });
    } else{
      // Après avoir trouvé le diplôme :
      await connection.execute(
        `INSERT INTO SEARCH_LOG (REFERENCE, USERNAME)
         VALUES (:ref, :username)`,
        {
          ref: reference,
          username: req.user?.username || "unknown"
        },
        { autoCommit: true }
      );
        await connection.execute(
          `INSERT INTO DIPLOMES_VERIFIED_LOG (REFERENCE, USERNAME)
           VALUES (:ref, :username)`,
          {
            ref: reference,
            username: req.user?.username || "unknown"
          },
          { autoCommit: true }
        );
        const row = result.rows[0];
        // Vérifier si l'étudiant existe déjà
        const studentCheck = await connection.execute(
          `SELECT ID_ETUDIANT FROM STUDENTS WHERE ID_ETUDIANT = :id`,
          [ row.ID_ETUDIANT ]
        );
        
        if (studentCheck.rows.length === 0) {
          // Ajouter étudiant automatiquement
          await connection.execute(
            `INSERT INTO STUDENTS (
              ID_ETUDIANT, FULL_NAME, DATE_NAISSANCE,
              FILIERE, EMAIL, TELEPHONE, ADRESSE
            ) VALUES (
              :id, :name, :dob, :filiere, :email, :tel, :addr
            )`,
            {
              id: row.ID_ETUDIANT,
              name: row.FULL_NAME,
              dob: row.DATE_NAISSANCE,
              filiere: row.FILIERE,
              email: row.EMAIL,
              tel: row.TELEPHONE,
              addr: row.ADRESSE
            },
            { autoCommit: true }
          );
        }
    }

    const row = result.rows[0];
    console.log(row.ID_ETUDIANT);

    // --- Génération URL PDF ---
    const pdfUrl = `https://backend-diploma-q2sg.onrender.com/diplomes/${row.REFERENCE}.pdf`;

    // --- Génération QR ---
    const qrCodeBase64 = await QRCode.toDataURL(pdfUrl);

    res.json({
      reference,
      found: true,
      data: row,
      pdfUrl,
      qrCode: qrCodeBase64
    });
  } catch (err) {
    console.error("Erreur Oracle:", err);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch {}
    }
  }
}

module.exports = {
  getDiplomeByReference,
  validateReference,
  diplomeLimiter
};
