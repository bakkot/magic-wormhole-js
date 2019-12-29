# magic-wormhole-js

An unoficial JavaScript port of [magic-wormhole](https://github.com/warner/magic-wormhole).

This gets as far as establishing a secure channel ("Wormohle") between the two parties and sending a simple text message, but does not yet implement the remainder of the [file transfer protocol](https://github.com/warner/magic-wormhole/blob/master/docs/file-transfer-protocol.md). Pull requests welcome!


## Usage

```
npm install
```
to install dependencies, then

```
node cli.js send-demo
```
will send the text "example" using a trivial password and


```
node cli.js receive 0-wormhole-code
```
will receive text.

These interoperate with the python implementation, so you can receive text sent by `send-demo` using `wormhole receive --only-text 0-wormhole-code` and send text to be received by `receive` using `wormhole send --text example`.


## Usage with `npx`

Instead of cloning and installing locally, you can do
```
npx magic-wormhole send-demo
```
and

```
npx magic-wormhole receive 0-wormhole-code
```

anywhere that a modern node and npm is installed.

## Spake2

Spake2 is not widely implemented. This project uses a [rust implementation](https://github.com/RustCrypto/PAKEs/tree/master/spake2) compiled to [WebAssembly](https://en.wikipedia.org/wiki/WebAssembly).

To build the `.wasm` you must have `rust` and `wasm-pack` installed. The built artifacts are committed to this repository, in case you don't have the requisite build tools. The readme under [spake2-wasm][spake2-wasm/] contains notes about building it.

You will need a version of `node` which supports WebAssembly to use this project.


## Protocols

I find the easiest way to think about the magic-wormhole protocol is as a series of nested protocols. They are documented below.

Given a rendezvous server (by default `ws://relay.magic-wormhole.io:4000/v1`) and an `appId` (by default `lothar.com/wormhole/text-or-file-xfer`),

The overall magic-wormhole protocol for the sender consists of:

- Open a websocket to the rendezvous server.
- Establish a channel using the rendezvous protocol on top of the websocket.
- Pick a short hex string at random to be `side`.
- Establish a channel using the unencrypted protocol on top of the channel using the rendezvous protocol using `appId` and `side`.
- Pick an ephemeral password at random.
- Let `nameplate` be the nameplate string from the unencrypted channel.
- Communicate the `nameplate` and the ephemeral password to the receiver.
- Let `password` be the concatenation of `nameplate`, `-`, and the ephemeral password.
- Establish a channel using the encrypted protocol on top of the channel using the unencrypted protocol using `appId`, `side`, and `password`.
- Send `("version", Utf8Encode(JsonStringify({"app_version":{}})))` over the channel using the encrypted protocol.
- Receive a message `theirEncodedVersion` over the channel using the encrypted protocol.
- Assert: `JsonParse(Utf8Decode(theirEncodedVersion))` is a `JsonObject` with an `app_versions` field (which is in my experience always empty).
- ??? [file transfer protocol goes here]
- Profit

The overall magic-wormhole protocol for the receiver consists of:

- Out of band, obtain the `nameplate` and the ephemeral password from the sender.
- Open a websocket to the rendezvous server.
- Establish a channel using the rendezvous protocol on top of the websocket.
- Pick a short hex string at random to be `side`.
- Establish a channel using the unencrypted protocol on top of the channel using the rendezvous protocol using `appId`, `side`, and `nameplate`.
- Let `password` be the concatenation of the nameplate string, `-`, and the ephemeral password.
- Establish a channel using the encrypted protocol on top of the channel using the unencrypted protocol using `appId`, `side`, and `password`.
- Send `("version", Utf8Encode(JsonStringify({"app_version":{}})))` over the channel using the encrypted protocol.
- Receive a message `theirEncodedVersion` over the channel using the encrypted protocol.
- Assert: `JsonParse(Utf8Decode(theirEncodedVersion))` is a `JsonObject` with an `app_versions` field (which is in my experience always empty).
- ??? [file transfer protocol goes here]
- Profit


### Websocket protocol

This is the base protocol.

Messages consist of lists of bytes. How to establish the connection and send and receive messages on it is beyond the scope of this document.

### Rendezvous protocol

Messages consist of `(type: string, object: JsonObject)` pairs, where `object` has neither `id` nor `type` keys. (Actually it's more restricted than that, but I'm not going to document it precisely here.)

#### Establishing

Given

- a websocket

you can establish a channel using the rendezvous protocol as follows:

- Receive a message from the websocket of the form `Utf8Encode(JsonStringify(object))`, where `object` is a `JsonObject` with a `type` key holding the string `"welcome"` and a `welcome` key holding another `JsonObject`. This second object can have the field `"error"`, in which case the connection will terminate.

#### Sending

Once established, you can send a message `(type, object)` on this channel as follows:

- Let `id` be a random short-ish hex string.
- Let `augmented` by a JsonObject with all of the keys and corresponding values in `object`, as well as new fields named `"type"` and `"id"` holding `type` and `id` respectively.
- Let `encoded` be `Utf8Encode(JsonStringify(encoded))`.
- Send `encoded` on the websocket.

#### Receiving

Once established, you can receive a message `(type, object)` on this channel as follows:

- Let `bytes` be a message received from the websocket.
- Let `decoded` be `JsonParse(Utf8Decode(bytes))`.
- Assert: `decoded` has a `type` field containing a string.
- Let `type` be the value of the `type` field of `decoded`, and let `other` be the `JsonObject` holding the remaining keys and corresponding values of `decoded`.
- If `type` is `"ack"`, ignore this and do not receive on this channel.
- Receive `(type, other)` on this channel.


### Unencrypted protocol

Sent messages consist of `(phase: string, message: list of bytes)` pairs.

Recieved messages consist of `(phase: string, side: string, message: list of bytes)` tuples.

#### Establishing (sender side)

Given

- a channel using the rendezvous protocol
- `appId`, a string identifying the app
- `side`, a short string whose characters are drawn from `0-9` and `a-f`

you as the sender can establish a channel using the unencrypted protocol as follows:

- Send `("bind", { "appid": appId, "side": side })` on the rendezvous channel.
- Send `("allocate", {})` on the rendezvous channel.
- Receive `("allocated", { "nameplate": nameplate })` on the rendezvous channel, where `"nameplate"` is a string.
- Send `("claim", { "nameplate": nameplate })`.
- Receive `("claimed", { "mailbox": mailbox })` on the rendezvous channel, where `"mailbox"` is a string.
- Send `("open", { "mailbox": mailbox })`.
- Associate `nameplate` with this channel.

#### Establishing (receiver side)

- TODO

#### Sending

Once established, you can send a message `(phase, message)` on this channel as follows:

- Let `hex` be `HexEncode(message)`.
- Send `("add", { "phase": phase, "body": body })` on the rendezvous channel.

#### Receiving

Once established, you can receive a message `(phase, side, message)` on this channel as follows:

- Let `(type, object)` be a message received from the rendezvous channel.
- Assert: `object` has `phase`, `side`, and `body` fields each containing a string.
- Let `phase` be the value of the `"phase"` field of `object`.
- Let `side` be the value of the `"side"` field of `object`.
- Let `body` be the value of the `"body"` field of `object`.
- Recieve `(phase, side, HexDecode(body))` on this channel.


### Encrypted protocol

This is what the magic-wormhole documentation refers to as a "Wormhole".

Messages consist of `(phase: string, message: list of bytes)` pairs.


#### Establishing

Given

- a channel using the unencrypted protocol
- `appId`, a string identifying the app
- `side`, a short string whose characters are drawn from `0-9` and `a-f`
- `password`, a password shared between both parties

you can establish a channel using the encrypted protocol as follows:

- Associate `side` with this channel.
- Let `state` (an opaque value) and `outbound` (a list of bytes) be the result of initializing the symmetric SPAKE2 protocol ([e.g.](https://github.com/RustCrypto/PAKEs/blob/6859374e6087066cde407534761317b0bd179435/spake2/src/lib.rs#L718)) using `Utf8Encode(appId)` as the identity and `Utf8Encode(password)` as the password.
- Let `encoded` be `Utf8Encode(JsonStringify({ "pake_v1": HexEncode(outbound) }))`.
- Send `("pake", encoded)` on the unencrypted channel.
- Receive `("pake", ignored, theirEncoded)` on the unencrypted channel.
- Let `theirDecoded` be `JsonParse(Utf8Decode(theirEncoded))`.
- Assert: `theirDecoded` has a `"pake_v1"` field containing a string.
- Let `theirPakeHex` be the value of the `"pake_v1"` field of `theirDecoded`.
- Let `theirPake` be `HexDecode(theirPake)`.
- Let `key` (a list of bytes) be the result of finalizing the symmetric SPAKE2 protocol using `state` and `theirPake` ([e.g.](https://github.com/RustCrypto/PAKEs/blob/6859374e6087066cde407534761317b0bd179435/spake2/src/lib.rs#L724)).
- Associate `key` with this channel.

#### Sending

Once established, you can send a message `(phase, message)` on this channel as follows:

- Let `nonce` be `GetRandomBytes(24)`.
- Let `phaseKey` be `DerivePhaseKey(key, side, phase)`.
- Let `ciphertext` be `MakeSecretBox(message, nonce, phaseKey)`.
- Let `full` be the concatenation of `nonce` and `ciphertext`.
- Send `(phase, full)` on the unencrypted channel.

#### Receiving

Once established, you can receive a message `(phase, message)` on this channel as follows:

- Recieve `(phase, theirSide, message)` from the unencrypted channel.
- Let `phaseKey` be `DerivePhaseKey(key, theirSide, phase)`.
- Let `nonce` be the first 24 bytes of `messaage`.
- Let `ciphertext` be the remaining bytes of `message`.
- Let `plaintext` be `OpenSecretBox(ciphertext, nonce, phaseKey)`.
- Receive `(phase, plaintext)` on this channel.


## Helpers

These are types and methods referenced above.

### `byte`

An integer between 0 and 255 inclusive.

### `string`

A list of unicode code points.

### `JsonObject`

An object with keys and values of the kind supported by JSON. Can be written like `{ "foo": bar }`.

### `JsonParse(string): JsonObject`

Return the object given by parsing the input according the JSON specification using the `object` nonterminal as the goal. (I.e., only `{}`-style values are supported for the purposes of this document.)

### `JsonStringify(JsonObject): string`

Return a string representing the input according to the JSON specificatino.

### `Utf8Decode(list of bytes): string`

Return the string given by interpreting the list of bytes as a utf8-encoded sequence of code points according to the unicode spec.

### `Utf8Encode(string): list of bytes`

Return a list of bytes given by encoding the input according to the unicode spec.

### `HexDecode(string): list of bytes`

Return the list of bytes given by [hex decoding](https://en.wikipedia.org/wiki/Hexadecimal#Base16_(transfer_encoding)) the input.

### `HexEncode(list of bytes): string`

Return the string given by [hex encoding](https://en.wikipedia.org/wiki/Hexadecimal#Base16_(transfer_encoding)) the input.

### `GetRandomBytes(number): list of bytes`

From a cryptographically secure source, obtain a list of random bytes of length given by the input.

### `Sha256(list of bytes): list of bytes`

Return the [sha256](https://en.wikipedia.org/wiki/SHA-2) digest of the input.

### `HKDF(key: list of bytes, purpose: list of bytes)`

Return the length-32 expansion of `key` using [HKDF](https://en.wikipedia.org/wiki/HKDF) with `purpose` as the `info` and with no salt.

### `DerivePhaseKey(key: list of bytes, side: string, phase: string)`

This algorithm behaves as follows:

- Let `base` be `Utf8Encode("wormhole:phase:")`.
- Let `sideSha` be `Sha256(Utf8Encode(side))`.
- Let `phaseSha` be `Sha256(Utf8Encode(phase))`.
- Let `purpose` be the list of bytes given by concatenating `base`, `sideSha`, and `phaseSha`.
- Return `HKDF(key, purpose)`.

### `MakeSecretBox(plaintext: list of bytes, nonce: list of bytes, phaseKey: list of bytes)`

Return the result of calling [NaCL](https://nacl.cr.yp.to/secretbox.html)'s `secretbox` method using `plaintext` as the message, `nonce` as the nonce, and `phaseKey` as the key.

### `OpenSecretBox(ciphertext: list of bytes, nonce: list of bytes, phaseKey: list of bytes)`

Return the result of calling [NaCL](https://nacl.cr.yp.to/secretbox.html)'s `secretbox_open` method using `ciphertext` as the ciphertext, `nonce` as the nonce, and `phaseKey` as the key.
