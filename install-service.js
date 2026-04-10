/**
 * Install Dessert Cafe Manager as Windows Service
 */

const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'Dessert Cafe Manager',
  description: 'Dessert timer and market price tracker - runs in background',
  script: path.join(__dirname, 'service.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

// Listen for events
svc.on('install', function() {
  console.log('Service installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('alreadyinstalled', function() {
  console.log('Service is already installed.');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log('Service started!');
  console.log('');
  console.log('The server is now running in the background.');
  console.log('It will start automatically when Windows boots.');
  console.log('');
  console.log('Access the app at: http://localhost:5050');
  console.log('');
  console.log('To uninstall, run: uninstall.bat');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Install
console.log('Installing Dessert Cafe Manager as Windows Service...\n');
svc.install();
