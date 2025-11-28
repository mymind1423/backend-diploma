// middleware/validate.js
module.exports = (schema) => (req, res, next) => {
  const options = {
    abortEarly: false, // Retourne toutes les erreurs
    allowUnknown: false, // Refuse les champs non définis
    stripUnknown: true // Supprime les champs inconnus
  };

  const { error, value } = schema.validate(req.body, options);

  if (error) {
    return res.status(400).json({
      error: "Validation échouée",
      details: error.details.map(d => d.message)
    });
  } else {
    req.body = value;
    next();
  }
};
