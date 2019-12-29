'use strict';

let WS = require('ws');

let { encodeAscii } = require('./util.js');

function getId() {
  return Math.floor(Math.random() * 2 ** 16).toString(16); // need this be crypto random?
}

async function init(url) {
  let socket = new WS(url);
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {

      // TODO think about what receiving messages should look like. Probably an observable, sigh.
      let subs = [];

      socket.addEventListener('message', m => {
        // TODO wait for welcome message before resolving
        let message = JSON.parse(m.data);
        if (message.type === 'ack') {
          return;
        }
        // console.log('r', message);

        subs.forEach(sub => sub(message));
      });

      function send(type, obj) {
        if ({}.hasOwnProperty.call(obj, 'id') || {}.hasOwnProperty.call(obj, 'type')) {
          throw new Error('object must not have "id" or "type" properties');
        }
        let id = getId();
        socket.send(encodeAscii(JSON.stringify({ ...obj, id, type })));
      }

      function subscribe(listener) {
        subs.push(listener);
      }

      resolve({ send, subscribe });
    });
    socket.addEventListener('error', e => {
      console.error('error', e);
      reject(e);
    });
  });
}

module.exports = { init };
