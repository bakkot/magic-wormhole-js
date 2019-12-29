'use strict';

let crypto = require('crypto');

let nacl = require('tweetnacl');

let {
  hkdf,
  sha256,
  bytesToHex,
  hexToBytes,
  decodeAscii,
  encodeAscii,
} = require('./util.js');

let spake2 = require('../spake2-wasm/pkg/spake2_wasm.js');

let appid = 'lothar.com/wormhole/text-or-file-xfer';

// we send exactly one message over the unencrypted protocol. maybe we should do away with it.
async function init({ send, subscribe }, side, password) {
  async function waitForPhase(desiredPhase) {
    return new Promise(resolve => {
      subscribe(({ phase, side, body }) => {
        if (phase === desiredPhase) {
          resolve({ phase, side, body });
        }
      });
    });
  }

  let spake2State = spake2.start(appid, password);
  let outbound = spake2.msg(spake2State);
  // console.log('outbound', outbound);
  let outboundString = JSON.stringify({ pake_v1: bytesToHex(outbound) });
  send('pake', encodeAscii(outboundString));

  console.log('waiting for other party...');

  let theirPake = (await waitForPhase('pake')).body;
  let pakeJson = JSON.parse(decodeAscii(theirPake));

  if (!{}.hasOwnProperty.call(pakeJson, 'pake_v1')) {
    throw new Error('failed to get pake');
  }
  let inbound = hexToBytes(pakeJson.pake_v1);
  // console.log('inbound', inbound)
  let key = spake2.finish(spake2State, inbound);
  // console.log('key', key);

  function mySend(phase, bytes) {
    send(phase, encodeMessage(key, side, phase, bytes));
  }
  let subs = [];
  function mySubscribe(listener) {
    subs.push(listener);
  }
  subscribe(m => {
    subs.forEach(sub => sub({ phase: m.phase, body: decodeMessage(key, m) }));
  });

  return { send: mySend, subscribe: mySubscribe };
  // TODO verifier
}

function encodeMessage(key, side, phase, plaintextBytes) {
  let nonce = new Uint8Array(crypto.randomBytes(24));
  let phaseKey = derivePhaseKey(key, side, phase);
  let out = new Uint8Array([...nonce, ...nacl.secretbox(plaintextBytes, nonce, phaseKey)]);
  // console.log(decodeMessage(key, { body: bytesToHex(out), side, phase }));
  return out;
}

function decodeMessage(key, message) {
  // console.log('d-key', key);
  // console.log('d-m', message);
  let phaseKey = derivePhaseKey(key, message.side, message.phase);
  // console.log('phaseKey', phaseKey);
  let nonce = message.body.slice(0, 24);
  let box = message.body.slice(24);
  return nacl.secretbox.open(box, nonce, phaseKey);
}

function derivePhaseKey(key, side, phase) {
  // key is a list of bytes
  // side and phase are ascii strings
  // see https://github.com/psanford/wormhole-william/blob/db681220101315cbec20ad461c82e27b17c4deeb/wormhole/wormhole.go#L169
  let sideSha = sha256(encodeAscii(side));
  let phaseSha = sha256(encodeAscii(phase));
  let purpose = new Uint8Array([...encodeAscii('wormhole:phase:'), ...sideSha, ...phaseSha]);

  return hkdf(key, purpose);
}

module.exports = { init };
