'use strict';

let crypto = require('crypto');
let HKDF = require('@aws-crypto/hkdf-node').HKDF;

function hkdf(key, bytes) {
  // we'd prefer to pretend buffers don't exist
  return new Uint8Array(HKDF('sha256')(key)(32, bytes));
}

function sha256(bytes) {
  return new Uint8Array(crypto.createHash('sha256').update(bytes).digest());
}


// this is kinda obscene. it would be better to use primitives for this.

function bytesToHex(bytes) {
  return [...bytes].map(byte => {
    if (typeof byte !== 'number' || Object.is(byte, NaN) || byte < 0 || byte > 255) {
      throw new Error('bad byte: ' + byte);
    }
    return byte.toString(16).padStart(2, '0');
  }).join('');
}

function hexToBytes(hexStr) {
  if (hexStr.length % 2 !== 0) {
    hexStr = '0' + hexStr;
  }
  hexStr = hexStr.toLowerCase();
  // we could just construct the Uint8Array directly, I guess
  let out = [];
  for (let i = 0; i < hexStr.length; i += 2) {
    let byte = parseInt(hexStr[i], 16) * 16 + parseInt(hexStr[i + 1], 16);
    if (Object.is(byte, NaN)) {
      throw new Error('bad byte: ' + hexStr[i] + hexStr[i + 1]);
    }
    out.push(byte);
  }
  return new Uint8Array(out);
}

function decodeAscii(bytes) {
  return [...bytes].map(byte => {
    if (typeof byte !== 'number' || Object.is(byte, NaN) || byte < 0 || byte > 127) {
      // bound at 127 because I am sure as hell not implementing utf-8 decoding
      throw new Error('bad byte: ' + byte);
    }
    return String.fromCharCode(byte);
  }).join('');
}

function encodeAscii(ascii) {
  return new Uint8Array(ascii.split('').map(c => {
    let byte = c.charCodeAt(0);
    if (byte < 0 || byte > 127) {
      throw new Error('bad char: ' + c);
    }
    return byte;
  }));
}

function panic(msg) {
  console.error(msg);
  process.exit(1);
}


module.exports = {
  hkdf,
  sha256,
  bytesToHex,
  hexToBytes,
  decodeAscii,
  encodeAscii,
  panic,
};
