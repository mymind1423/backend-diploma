const multer = require('multer');
const fs = require('fs');
const QRCode = require("qrcode");
const path = require('path');
const Tesseract = require('tesseract.js');
const oracledb = require('oracledb');
const sharp = require('sharp');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');

// --------------------
// Configuration Oracle
// --------------------
const dbConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING
};

// --------------------
// Middleware rate limiter pour OCR upload
// --------------------
const ocrUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'Trop de requêtes OCR, réessayez plus tard.' }
});

// --------------------
// Multer upload sécurisé
// --------------------
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Type de fichier non autorisé'), false);
  }
});

// --------------------
// Validation Joi
// --------------------
const ocrSchema = Joi.object({
  // Pour l'instant, on peut valider seulement la présence du fichier
  file: Joi.required()
});

// --------------------
// Helper OCR sécurisé
// --------------------
const autoRotateImage = async (imagePath) => {
  const osd = await Tesseract.recognize(imagePath, 'fra', { tessedit_pageseg_mode: 0 });
  const angle = osd.data.orientation?.deg || 0;
  if (angle !== 0) {
    const rotatedPath = imagePath.replace(/(\.\w+)$/, `_rot${angle}$1`);
    await sharp(imagePath).rotate(angle).toFile(rotatedPath);
    return rotatedPath;
  }
  return imagePath;
};

const rotateAndOCR = async (imagePath) => {
  const result = await Tesseract.recognize(imagePath, 'fra', {
    tessedit_pageseg_mode: 6,
    tessedit_ocr_engine_mode: 1
  });
  return result.data.text;
};

// --------------------
// Controller uploadOCR sécurisé
// --------------------
async function uploadOCR(req, res) {
  console.log("req.file:", req.file);
  // Validation Joi
  const { error } = ocrSchema.validate({ file: req.file });
  if (error) return res.status(400).json({ error: 'Fichier invalide ou manquant' });

  const uploadPath = req.file.path;
  let text = '';
  let pdfDir;

  try {
    // Si PDF, convertir page 2 en PNG
    if (req.file.originalname.toLowerCase().endsWith('.pdf')) {
      const safeName = path.parse(req.file.originalname).name.replace(/[^a-zA-Z0-9_-]/g, '_');
      pdfDir = path.join('uploads', safeName);
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir);

      await new Promise((resolve, reject) => {
        const cmd = `pdftocairo -png -r 150 -f 2 -l 2 "${uploadPath}" "${pdfDir}/page"`;
        require('child_process').exec(cmd, (err) => (err ? reject(err) : resolve()));
      });

      let imgPath = path.join(pdfDir, 'page-2.png');
      const resizedPath = imgPath.replace('.png', '_small.png');
      await sharp(imgPath).resize({ width: 1300, withoutEnlargement: true }).toFile(resizedPath);

      let finalPath = await autoRotateImage(resizedPath);
      text = await rotateAndOCR(finalPath);

      // Vérifier référence, sinon rotation 90°
      if (!/[\dA-Z]{5,}/.test(text)) {
        const rot90 = resizedPath.replace('.png', '_rot90.png');
        await sharp(resizedPath).rotate(90).toFile(rot90);
        text = await rotateAndOCR(rot90);
      }
    } else {
      // Image directe
      text = (await Tesseract.recognize(uploadPath, 'fra')).data.text;
    }

    // Recherche référence
    const refMatch = text.match(/\b\d{5}\b/);
    if (!refMatch) return res.json({ error: 'Aucune référence trouvée', text });
    const reference = refMatch[0];

    // Requête Oracle sécurisée
    let connection;
    try {
      connection = await oracledb.getConnection(dbConfig);
      const result = await connection.execute(
        `SELECT * FROM diplomes WHERE reference = :ref`,
        [reference],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows.length === 0) {
        return res.json({ reference, found: false, text });
      }else{
        // Après avoir trouvé le diplôme :
        await connection.execute(
          `INSERT INTO SEARCH_LOG (REFERENCE, USERNAME)
           VALUES (:ref, :user)`,
          {
            ref: reference,
            user: req.user?.username || "unknown"
          },
          { autoCommit: true }
        );
        await connection.execute(
          `INSERT INTO DIPLOMES_VERIFIED_LOG (REFERENCE, USERNAME)
           VALUES (:ref, :user)`,
          {
            ref: reference,
            user: req.user?.username || "unknown"
          },
          { autoCommit: true }
        );
        // Vérifier si l'étudiant existe déjà
        const studentCheck = await connection.execute(
          `SELECT ID_ETUDIANT FROM STUDENTS WHERE ID_ETUDIANT = :id`,
          [ diploma.ID_ETUDIANT ]
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
              id: diploma.ID_ETUDIANT,
              name: diploma.FULL_NAME,
              dob: diploma.DATE_NAISSANCE,
              filiere: diploma.FILIERE,
              email: diploma.EMAIL,
              tel: diploma.TELEPHONE,
              addr: diploma.ADRESSE
            },
            { autoCommit: true }
          );
        }
      }

      const row = result.rows[0];

      // --- Génération URL PDF ---
      const pdfUrl = `http://localhost:3000/diplomes/${row.REFERENCE}.pdf`;

      // --- Génération QR ---
      const qrCodeBase64 = await QRCode.toDataURL(pdfUrl);

      return res.json({
        reference,
        found: true,
        data: row,
        pdfUrl,
        qrCode: qrCodeBase64
      });
    } finally {
      if (connection) await connection.close();
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    // Nettoyage fichiers temporaires
    fs.unlink(uploadPath, () => {});
    if (pdfDir && fs.existsSync(pdfDir)) fs.rmSync(pdfDir, { recursive: true, force: true });
  }
}

module.exports = { uploadOCR, upload, ocrUploadLimiter };
