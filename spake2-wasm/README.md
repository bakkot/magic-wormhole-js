# Building

Ensure you have `rust` and `cargo`, and a modern `clang`.

Install `wasm-pack`:

```sh
cargo install wasm-pack
```

Then build:

```sh
wasm-pack build --target=nodejs
```


## `No available targets are compatible with triple "wasm32-unknown-unknown"`

This error indicates your clang is out of date: for example, you're on MacOS using the built-in version.

On a mac you can fix this with

```sh
brew install llvm
```

And then prefixing the `wasm-pack` command as follows:

```sh
PATH=/usr/local/opt/llvm/bin:$PATH wasm-pack build --target=nodejs
```


## Dev notes

We need to explicitly specify `rand = { version = "0.6", features = ["wasm-bindgen"] }` in order for `spake2` to work (specifically the feature flag). Otherwise it panics at runtime.
