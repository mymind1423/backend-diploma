const oracledb = require("oracledb");

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  connectString: `(DESCRIPTION=
      (ADDRESS=(PROTOCOL=TCP)(HOST=${process.env.DB_HOST})(PORT=${process.env.DB_PORT}))
      (CONNECT_DATA=(SERVICE_NAME=${process.env.DB_SERVICE}))
    )`
};

async function getStudents(req, res) {
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      `
      SELECT 
        ID,
        ID_ETUDIANT,
        FULL_NAME,
        DATE_NAISSANCE,
        FILIERE,
        EMAIL,
        TELEPHONE,
        ADRESSE
      FROM STUDENTS
      ORDER BY ID
      `
    );

    res.json(
      result.rows.map(row => ({
        id: row[0],
        reference: row[1],
        fullName: row[2],
        dateNaissance: row[3],
        filiere: row[4],
        email: row[5],
        telephone: row[6],
        adresse: row[7]
      }))
    );


  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { getStudents };
