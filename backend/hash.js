const bcrypt = require("bcrypt");

bcrypt.hash("K7@pL9!xQ2#", 10).then((hash) => {
  console.log("HASH:");
  console.log(hash);
});