const oracledb = require("oracledb");

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  connectString: `(DESCRIPTION=
      (ADDRESS=(PROTOCOL=TCP)(HOST=${process.env.DB_HOST})(PORT=${process.env.DB_PORT}))
      (CONNECT_DATA=(SERVICE_NAME=${process.env.DB_SERVICE}))
    )`
};

async function getStats(req, res) {
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const studentsCount = await connection.execute(
      "SELECT COUNT(*) FROM STUDENTS"
    );

    const diplomasVerified = await connection.execute(
      "SELECT COUNT(*) FROM DIPLOMES_VERIFIED_LOG"
    );

    const recentSearches = await connection.execute(
      "SELECT REFERENCE FROM SEARCH_LOG WHERE TRUNC(DATE_SEARCH) = TRUNC(SYSDATE) ORDER BY DATE_SEARCH"
    );

    res.json({
      students: studentsCount.rows[0],
      diplomasVerified: diplomasVerified.rows[0],
      recent: recentSearches.rows.map(r => r.REFERENCE)
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { getStats };
