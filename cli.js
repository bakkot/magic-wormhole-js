#!/Users/kevin/.nvm/versions/node/v12.1.0/bin/node
'use strict';

let rendezvous = require('./lib/rendezvous.js');
let unencrypted = require('./lib/unencrypted.js');
let encrypted = require('./lib/encrypted.js');

let { panic, decodeAscii, encodeAscii } = require('./lib/util.js');

let url = 'ws://relay.magic-wormhole.io:4000/v1';
let appid = 'lothar.com/wormhole/text-or-file-xfer';

let side = Math.floor(Math.random() * 2 ** 40).toString(16);

let defaultEphemeralPassword = 'test-test'; // only used for sending the string 'example'
let messageToSend = 'example';

// omit nameplate and ephemeralPassword to send, provide to receive
async function go(nameplate = null, ephemeralPassword = null) {
  let rendezvousChannel = await rendezvous.init(url);
  let unencryptedChannel, code;
  if (nameplate === null) {
    unencryptedChannel = await unencrypted.initSender(rendezvousChannel, side);
    code = unencryptedChannel.nameplate + '-' + defaultEphemeralPassword;
    console.log('wormhole code:', code);
  } else {
    unencryptedChannel = await unencrypted.initReceiver(rendezvousChannel, side, nameplate);
    code = nameplate + '-' + ephemeralPassword;
  }

  let wormhole = await encrypted.init(unencryptedChannel, side, code);

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
  // TODO confirm version information, maybe?

  console.log('established secure channel!');

  if (nameplate === null) {
    wormhole.send('0', encodeAscii(JSON.stringify({ offer: { message: messageToSend } })));

    let encodedAnswer = await waitForPhase('0');
    let answer = JSON.parse(decodeAscii(encodedAnswer));
    if (!{}.hasOwnProperty.call(answer, 'answer') || !{}.hasOwnProperty.call(answer.answer, 'message_ack') || answer.answer.message_ack !== 'ok') {
      panic('unexpected answer ' + decodeAscii(encodedAnswer));
    }

    console.log('text message sent');
  } else {
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
  }
  // TODO cleanup
  process.exit(0);
}

// TODO replace this with a library that does this, if there exists one that isn't awful
switch (process.argv[2]) {
  case '--help': {
    usage(0);
  }
  case 'send-demo': {
    if (process.argv.length !== 3) {
      usage();
    }
    go();
    break;
  }
  case 'receive': {
    if (process.argv.length !== 4) {
      usage();
    }
    let codeArg = process.argv[3];
    let dash = codeArg.indexOf('-');
    if (dash === -1) {
      console.error('Code must be of the form 0-wormhole-code');
      usage();
    }
    let nameplate = codeArg.slice(0, dash);
    let ephemeralPassword = codeArg.slice(dash + 1);
    go(nameplate, ephemeralPassword);
    break;
  }
  default: {
    usage();
  }
}

function usage(code = 1) {
  console.log(`Usage: node ${process.argv[1]} [command]

Commands:
  send-demo       send sample text over wormhole
  receive <code>  receive text over wormhole`);
  process.exit(code);
}
