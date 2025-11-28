const oracledb = require("oracledb");
require("dotenv").config({ path: __dirname + "/../../.env" });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const poolPromise = oracledb.createPool({
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
  poolMin: 1,
  poolMax: 5,
  poolIncrement: 1
});

module.exports = poolPromise;
