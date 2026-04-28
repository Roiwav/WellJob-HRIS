const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "100.119.171.111",
  user: "remoteuser",
  password: "",
  database: "welljob_db",
});

db.connect((err) => {
  if (err) console.error("DB Error:", err);
  else console.log("MySQL Connected");
});

module.exports = db;

