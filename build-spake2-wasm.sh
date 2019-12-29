#!/bin/bash

set -e

cd spake2-wasm
wasm-pack build --target=nodejs
rm pkg/.gitignore pkg/package.json pkg/README.md
cd ..
