/**
 * Uninstall Dessert Cafe Manager Windows Service
 */

const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'Dessert Cafe Manager',
  script: path.join(__dirname, 'service.js')
});

svc.on('uninstall', function() {
  console.log('Service uninstalled successfully!');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

console.log('Uninstalling Dessert Cafe Manager service...\n');
svc.uninstall();
