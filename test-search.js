const { searchMultiple } = require("./scraper");

searchMultiple("sut")
  .then((result) => {
    console.log("\n=== SOK ===");
    console.log(result.sok);
    console.log("\n=== MIGROS ===");
    console.log(result.migros);
    console.log("\n=== FILE ===");
    console.log(result.file);
    console.log("\n=== BIM ===");
    console.log(result.bim);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
