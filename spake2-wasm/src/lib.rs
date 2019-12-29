extern crate rand;
extern crate spake2;
extern crate wasm_bindgen;

use spake2::{Ed25519Group, Identity, Password, SPAKE2};

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct GroupWrapper {
    group: SPAKE2<Ed25519Group>,
    outbound_msg: Vec<u8>,
}

#[wasm_bindgen]
pub fn start(id: &str, password: &str) -> GroupWrapper {
    let (group, outbound_msg) = SPAKE2::<Ed25519Group>::start_symmetric(
        &Password::new(password.as_bytes()),
        &Identity::new(id.as_bytes()),
    );
    return GroupWrapper {
        group,
        outbound_msg,
    };
}

#[wasm_bindgen]
pub fn msg(wrapper: &GroupWrapper) -> Vec<u8> {
    wrapper.outbound_msg.clone()
}

#[wasm_bindgen]
pub fn finish(wrapper: GroupWrapper, inbound: Vec<u8>) -> Vec<u8> {
    // TODO not unwrap
    wrapper.group.finish(&inbound).unwrap()
}
