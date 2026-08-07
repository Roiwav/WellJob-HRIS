const mysql = require("mysql2");

const db = mysql.createPool({
  host: "100.119.171.111",
  user: "remoteuser",
  password: "",
  database: "welljob_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("DB Error:", err);
    return;
  }

  console.log("MySQL Connected");
  connection.release();
});

module.exports = db;
