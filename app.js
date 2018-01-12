#! /usr/bin/env node
require('console-stamp')(console, 'HH:MM:ss');

var fs = require('fs');
var argv = require('minimist')(process.argv);
var config_file = (argv.config) ? argv.config : process.env.HOME + "/.config/btmonitor.json";

if (!fs.existsSync(config_file)){
  console.error("Config File not Found! (Looked at given path with Parameter --config or ~/.config/btmonitor.json)");
  process.exit();
} else {
  var config = require(config_file);
}

var noble = require('noble');
var exec  = require('child_process').exec;

var inRange   = true;
var buffer    = [];
var connected = false;

noble.on('stateChange', function(state){
  if (state === 'poweredOn') {
    connected = false;
    noble.startScanning();
  } else {
    connected = false;
    noble.stopScanning();
  }
});

noble.on('discover', function(peripheral) {
  console.log('Bluetooth Device Found!', peripheral.advertisement.localName);
  if(peripheral.uuid == config.uuid){
    console.log("UUID Match found! Stopping Scan and initiating Monitor!")
    noble.stopScanning();
    peripheral.connect(function(error) {
      if(!error){
        console.log("Device Connected!")
        connected = true;
        startInterval(peripheral);
        peripheral.on('disconnect', function(){
          console.log("Device Disconnected!");
          connected = false;
        });
      }
    });
  }
});

function startInterval(device){
  if(connected){
    device.updateRssi(function(err, rssi) {
      if(!err){
        buffer.push(calculateDistance(rssi));
        if(buffer.length == config.bufferSize) {
          deviceDistance = average(buffer);
          console.info(deviceDistance.toFixed(2), "Meters");
          buffer.length = 0;
          if(deviceDistance > config.distance && deviceDistance < config.max_dist) {
            if(inRange) action(config.exit);
          } else {
            if(!inRange) action(config.enter);
          }
        }
      }
    });
    setTimeout(function(){
      startInterval(device);
    }, 100);
  } else {
    noble.startScanning();
  }
}

function action(action){
  inRange = !inRange;
  console.log(action);
  exec(action, function(err){if(err)console.error(err)});
}

function average(arr){
  var total = 0;
  for(var i = 0; i < arr.length; i++) {
      total += arr[i];
  }
  return total / arr.length;
}

function calculateDistance(rssi) {
  var txPower = config.txPower
  if (rssi == 0) {
    return -1.0;
  }
  var ratio = rssi*1.0/txPower;
  if (ratio < 1.0) {
    return Math.pow(ratio,10);
  }
  else {
    var distance =  (0.5) * Math.pow(ratio, 6) + 0.5;
    return distance;
  }
}
