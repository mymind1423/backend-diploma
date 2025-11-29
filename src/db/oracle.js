const oracledb = require("oracledb");
require("dotenv").config({ path: __dirname + "/../../.env" });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const poolPromise = oracledb.createPool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  connectString: `(DESCRIPTION=
      (ADDRESS=(PROTOCOL=TCP)(HOST=${process.env.DB_HOST})(PORT=${process.env.DB_PORT}))
      (CONNECT_DATA=(SERVICE_NAME=${process.env.DB_SERVICE}))
    )`
  poolMin: 1,
  poolMax: 5,
  poolIncrement: 1
});

module.exports = poolPromise;
