const {searchMultiple} = require('./scraper-test');

searchMultiple('sut').then(r => {
  console.log('\n=== SOK ===');
  console.log(r.sok);
  console.log('\n=== TAHTAKALE ===');
  console.log(r.tahtakale);
  console.log('\n=== CARREFOUR ===');
  console.log(r.carrefour);
}).catch(console.error);
