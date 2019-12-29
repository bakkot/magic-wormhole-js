'use strict';

let rendezvous = require('./lib/rendezvous.js');
let unencrypted = require('./lib/unencrypted.js');
let encrypted = require('./lib/encrypted.js');

let { panic, decodeAscii, encodeAscii } = require('./lib/util.js');

let url = 'ws://relay.magic-wormhole.io:4000/v1';
let appid = 'lothar.com/wormhole/text-or-file-xfer';

let side = Math.floor(Math.random() * 2 ** 40).toString(16); // need this be crypto random?

let arg = process.argv[process.argv.length - 1];
let dash = arg.indexOf('-');
if (process.argv.length < 3 || dash === -1) {
  panic('expecting nameplate/key pair as argument');
}
let nameplate = arg.slice(0, dash);
let password = arg.slice(dash + 1);

(async () => {
  let r = await rendezvous.init(url);
  let u = await unencrypted.initReceiver(r, side, nameplate);
  let wormhole = await encrypted.init(u, side, nameplate + '-' + password);

  wormhole.send('version', encodeAscii(JSON.stringify({ app_versions: {} })));

  async function waitForPhase(desiredPhase) {
    return new Promise(resolve => {
      wormhole.subscribe(({ phase, body }) => {
        if (phase === desiredPhase) {
          resolve(body);
        }
      });
    });
  }

  let versionBytes = await waitForPhase('version');
  if (versionBytes === null) {
    throw new Error('failed to establish secure channel');
  }
  let theirVersion = decodeAscii(versionBytes);


  console.log('established secure channel!');


  let firstMessage = await waitForPhase('0');
  let offerObj = JSON.parse(decodeAscii(firstMessage));
  if ({}.hasOwnProperty.call(offerObj, 'transit')) {
    panic('files/directories are not supported');
  }
  if (!{}.hasOwnProperty.call(offerObj, 'offer') || !{}.hasOwnProperty.call(offerObj.offer, 'message')) {
    panic('unexpected message ' + decodeAscii(offer));
  }
  console.log('got message:');
  console.log(offerObj.offer.message);

  wormhole.send('0', encodeAscii(JSON.stringify({ answer: { message_ack: 'ok' } })));

  // TODO cleanup
  process.exit(0);
})();

