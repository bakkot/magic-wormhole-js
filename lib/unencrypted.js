'use strict';

let { hexToBytes, bytesToHex } = require('./util.js');

let appid = 'lothar.com/wormhole/text-or-file-xfer';

async function init({ send, subscribe }, side, nameplate = null) {
  async function waitForType(type) {
    return new Promise(resolve => {
      subscribe(m => {
        if (m.type === type) {
          resolve(m);
        }
      });
    });
  }

  send('bind', { appid, side });

  if (nameplate === null) {
    send('allocate', {});
    ({ nameplate } = await waitForType('allocated'));
  }

  // console.log('nameplate', nameplate);

  send('claim', { nameplate });
  let { mailbox } = await waitForType('claimed');

  send('open', { mailbox });

  function mySend(phase, message /*: Uint8Array */) {
    send('add', { phase, body: bytesToHex(message) });
  }

  let subs = [];
  function mySubscribe(listener) {
    subs.push(listener);
  }
  subscribe(m => {
    // with observables, this is .filter().map()
    if (m.side !== side && m.type === 'message') {
      // TODO error handling
      subs.forEach(sub => sub({ phase: m.phase, side: m.side, body: hexToBytes(m.body) }));
    }
  });
  // the fact that we need to return the nameplate seems like an absctraction leak in the wormhole prototocol
  return { nameplate, send: mySend, subscribe: mySubscribe };
}

async function initSender({ send, subscribe }, side) {
  return init({ send, subscribe }, side);
}

async function initReceiver({ send, subscribe }, side, nameplate) {
  return init({ send, subscribe }, side, nameplate);
}

module.exports = { initSender, initReceiver };
