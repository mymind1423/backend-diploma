const Tesseract = require('tesseract.js');
const fs = require('fs');

async function recognizeImage(filePath) {
  try {
    const { data } = await Tesseract.recognize(filePath, 'fra');
    return data.text;
  } catch (err) {
    console.error("Erreur OCR:", err);
    throw err;
  } finally {
    fs.unlink(filePath, () => {}); // Supprime le fichier temporaire
  }
}

module.exports = { recognizeImage };
