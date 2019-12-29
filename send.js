'use strict';

let rendezvous = require('./lib/rendezvous.js');
let unencrypted = require('./lib/unencrypted.js');
let encrypted = require('./lib/encrypted.js');

let { panic, decodeAscii, encodeAscii } = require('./lib/util.js');

let url = 'ws://relay.magic-wormhole.io:4000/v1';
let appid = 'lothar.com/wormhole/text-or-file-xfer';

let side = Math.floor(Math.random() * 2 ** 40).toString(16); // need this be crypto random?

let password = 'test-test'; // lol

(async () => {
  let r = await rendezvous.init(url);
  let u = await unencrypted.initSender(r, side);

  console.log('wormhole code:', u.nameplate + '-' + password);

  let wormhole = await encrypted.init(u, side, u.nameplate + '-' + password);

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



  wormhole.send('0', encodeAscii(JSON.stringify({ offer: { message: 'example' } })));


  let encodedAnswer = await waitForPhase('0');
  let answer = JSON.parse(decodeAscii(encodedAnswer));
  if (!{}.hasOwnProperty.call(answer, 'answer') || !{}.hasOwnProperty.call(answer.answer, 'message_ack') || answer.answer.message_ack !== 'ok') {
    panic('unexpected answer ' + decodeAscii(encodedAnswer));
  }

  console.log('text message sent');

  // TODO cleanunp
  process.exit(0);
})();
