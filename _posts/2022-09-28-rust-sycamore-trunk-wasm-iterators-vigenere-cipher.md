---
title: Building a Real-Time Web Cipher with Rust, Sycamore and Trunk
author: rsdlt
date: 2022-09-28 01:00:00 +0800
categories: [Rust, Wasm]
tags: [rust, array, wasm, iterators, webassembly, sycamore, trunk]
pin:
math: false 
mermaid: false
img_path: /assets/img/vigenere-cypher-iterators/ 
image:
  path: 2022-09-25 15-48.gif 
  width: 885 
  height: 334 
  alt: WASM Vigenére Cipher 
---

> Check the [demo] and the [GitHub] repo.

Some days ago I came across Tim McNamara's [Rust Code Challenges], a great course by the way, where the final challenge is to develop a [Vigenère cipher], which according to Wikipedia resisted all attempts to break it for 310 years.

After completing Tim's challenge, I thought that deploying a real-time Vigenére cipher on the Web, and without touching a single line of [JavaScript] code would be a fun project. 

Truth is, I loved it!


## Quick summary of the Vigenére cipher 

The Vigenére cipher is a simplified poly-alphabetic [substitution] encoder. It's essentially an algorithm where a set of characters or _message_ is substituted with another set of characters or _encoded message_ with the help of a _key_. To decode the encoded message, the receiver performs the inverse substitution process. 

The algorithm has 6 steps:

1. Define an _alphabet_ or _dictionary_: the set of characters.
2. Generate a _Vigenére table_: a matrix based on the _dictionary_ with a cyclical shift for each row.
3. Define a _Key_: a sequence of units based on the _dictionary_.
4. Define a _Message_ to encode / decode: another sequence of units based on of the _dictionary_.
5. Make the _Key_ and the _Message_ have the same size (number of units or characters).
6. Encode / Decode by matching each unit (or character) in the message and the key in the _Vigenére table_.

For example:

- Dictionary: ABCD
- Vigenére Matrix:

| A | B | C | D |
|---|---|---|---|
| B | C | D | A |
| C | D | A | B |
| D | A | B | C |

- Key: DCABAD
- Message: BADCAD 
- Encode:
    - Message characters [mc] => column position according to first row = Matrix[0][mc]
    - Key characters [kc] => row position according to first column = Matrix[kc][0]
    - Encoded characters [ec] = Matrix[kc][mc]
- Decode:
    - Decode character [dc] = Matrix[0][ec]

In the case of the first characters Key[0] = 'D' and Message[0] = 'B' the encoded character is Matrix[3][1] = 'A':

| A | `-B-` | C | D |
|---|---|---|---|
| B | C | D | A |
| C | D | A | B |
| `-D-` | `-A-` | B | C |

## Requirements for my implementation

This were my requirements for this implementation (at least for its `v0.1.0`):

- Implemented in [Rust].
- Make it _real-time_: encode and decode while typing the message.
- Deploy on the Web using WebAssembly
- Don't touch a line of JavaScript - because if we can do everything in Rust, then why not?

## WebAssembly + Sycamore + Trunk 

Based on the requirements, I decided that the best technology stack for this project is the following:

- [WebAssembly]: 
    - Which according to [MDN Web Docs] is _"… a low-level assembly-like language with a compact binary that runs __near-native__ performance and provides languages such as Rust with a compilation target…"_
    - So essentially, we write the code in Rust, compile to WebAssembly and any of the 4 major web browsers will [support it].
- [Sycamore]: 
    - Which based on their web page is _"… a __reactive__ library for creating web apps in Rust and WebAssembly…"_ that can be used to _"… create apps without touching a single line of JS… "_.
    - So two big wins here: no JS and reactivity to support real-time encryption / decryption.
- [Trunk]:
    - Which according to the project website is used to _"… build, bundle & ship your Rust WASM application to the web… "_.
    - Pretty neat, and it's also the [recommended build tool] for Sycamore.


This is a very powerful triad.


## The solution

For a clear perspective, this is how all the pieces fit together:
 

![Vigenère cipher solution diagram](general-solution-diagram.png){: width="793" height="324" }
_Vigenére cipher general solution diagram_

- The Sycamore library is like any other crate imported via `Cargo.toml`.
- The elements in green (`cipher.rs`, `main.rs` and `Cargo.toml`) are our Rust application.
- The 'tiny placeholder' `index.html` is a minimum HTML source file used by Trunk to inject the `views` provided by Sycamore.
- The entire Rust project is compiled, built and bundled using Trunk.
- Trunk generates the assets for distribution and hosting:
    - WebAssembly `binary` targeting the wasm32 instruction set.
    - The target HTML file.
    - The "glue" JavaScript file facilitating [interaction] with WebAssembly.

These great benefit of this stack is that all the logic is coded in Rust, even the front-end HTML logic.

## The front-end logic and UI elements

What really caught my attention with Sycamore is how straightforward it is to define the web user interface components and elements.

The user interface is handled through a [view!] Rust macro with no closing html tags:

```rust
view! { cx,
    h1 { }
    div(class="my_class")
    h2 { }
    p { }
    div { }
    my-own-custom-element { }
    footer { }

    // etc.
}
```

This simplicity allowed me to create the initial boilerplate application, with placeholders, and project structure in minutes:

`src/main.rs`:
```rust
mod cipher;
use cipher::Hello;
use sycamore::prelude::*;

#[component]
fn App<G: Html>(cx: Scope) -> View<G> {
    let name = create_signal(cx, String::new());
    let hello_r = cipher::new_hello();
    let displayed_name = || {
        if name.get().is_empty() {
            "".to_string()
        } else {
            name.get().as_ref().clone()
        }
    };

    view! { cx,
        div {
            h2 { "Real-Time Vigénere Cipher" }
            p { input(placeholder="Enter a phrase", bind:value=name) }
            p { strong{"Key: "} (displayed_name())}
            p { strong{"Encrypted: "} (displayed_name())}
            p { strong{"Decrypted: "} (displayed_name())}
        }
    }
}

fn main() {
    sycamore::render(|cx| view! { cx, App {} });
}
```

`index.html`: (the tiny one)
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>WebAssembly Vigénere Cipher</title>
  </head>
  <body></body>
</html>
```

`src/cipher.rs`:
```rust
use std::fmt::Display;

pub struct Hello {
    name: String,
}
pub fn new_hello() -> Hello {
    Hello {
        name: "Rodrigo".to_string(),
    }
}
impl Display for Hello {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name)
    }
}
```

`Cargo.toml`:
```toml
[package]
name = "wasm-vigenere-cipher"
version = "0.1.0"
edition = "2021"

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[dependencies]
sycamore = "0.8.1"
```

With this minimum of scaffolding we can now call Trunk with `trunk serve --open`, let it download, compile and bundle:

```terminal
 
 λ trunk serve --open
2022-09-28T01:49:43.120298Z  INFO  starting build
2022-09-28T01:49:43.123032Z  INFO spawning asset pipelines
2022-09-28T01:49:50.045688Z  INFO building tmp
   Compiling proc-macro2 v1.0.44
   Compiling unicode-ident v1.0.4
   Compiling quote v1.0.21
   Compiling syn v1.0.101
   Compiling wasm-bindgen-shared v0.2.83
    .
    .
    .
    Finished dev [unoptimized + debuginfo] target(s) in 0.46s
2022-09-28T01:50:41.373388Z  INFO fetching cargo artifacts
2022-09-28T01:50:41.441605Z  INFO processing WASM for tmp
2022-09-28T01:50:41.449095Z  INFO using system installed binary app=wasm-bindgen version=0.2.83
2022-09-28T01:50:41.449384Z  INFO calling wasm-bindgen for tmp
2022-09-28T01:50:41.547182Z  INFO copying generated wasm-bindgen artifacts
2022-09-28T01:50:41.550548Z  INFO applying new distribution
2022-09-28T01:50:41.551202Z  INFO  success
```

Trunk spawns a web server and opens the browser window to a fully-reactive application written in Rust:

![boilerplate reactive web app in Rust](first-reactive-web.gif){: width="665" height="253" }
_Boilerplate Reactive Web App in Rust with Sycamore and Trunk_

And looking closely at the output from Trunk in the `/dist/` directory:

`/dist/`
```terminal
 λ la dist
.rw-r--r-- 1.4k rsdlt 27 Sep 21:50  index.html
.rw-r--r--  18k rsdlt 27 Sep 21:50  tmp-4f46f36b75886b4e.js
.rw-r--r-- 943k rsdlt 27 Sep 21:50  tmp-4f46f36b75886b4e_bg.wasm
```

We see the three files of the web application needed for any hosting service.

## Implementing the cipher

With this boilerplate web application the next step is to implement the actual Vigenére cipher logic in the `cipher.rs`, according to the [6 steps outlined above]:

### 1. Define the 'alphabet' or 'dictionary'

At least for an MVP `v0.1.0` I have decided on all the non-control ASCII characters plus '\n' and '\r' which yields a set of `192` characters.

`src/cipher.rs`
```rust
pub(crate) const SIZE: usize = 192;

#[derive(Clone, Copy)]
pub(crate) struct DictWrap(pub(crate) [char; SIZE]);

```

I am using an `array` of `chars` with a size defined by a `const` and wrapped by a `tuple struct`.

The reasoning of using a wrapper is because Arrays are always treated as foreign types and the wrap allow for the implementation of foreign traits on them, like `std::fmt::Display`. 

The actual implementation for the `DictWrap` type is:

`src/cipher.rs`
```rust
// Creates and returns a new dictionary for the Vigenere Matrix.
impl DictWrap {
    pub(crate) fn new() -> DictWrap {
        // Every ASCII character that !is_control().
        let mut dict = r##" !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"##.to_string();
        // Add carriage return to support in web textarea.
        dict.push('\n');
        dict.push('\r');
        let mut dict_char_arr = [' '; SIZE];
        for (idx, ch) in dict.chars().enumerate() {
            dict_char_arr[idx] = ch;
        }
        return DictWrap(dict_char_arr);
    }

    pub(crate) fn get_string(&self) -> String {
        let mut s = String::new();
        for ch in self.0 {
            s.push(ch);
        }
        s
    }
}
```

First, defining the actual set in a raw `&str`, converting to `String` to push both carriage return chars `\n` and `\r` and then populating the `char array` and wrap it with the `struct tuple` (the [Newtype Pattern]).

I'm including a `get_string()` method in order to return the array in `String` form in case is needed for rendering in `HTML`.

### 2. Generate a Vigenére Matrix
The next step is to create the Vigenére table or matrix with the cycled and shifted elements of the `dictionary`:

`src/cipher.rs`
```rust
#[derive(Clone, Copy)]
pub(crate) struct VigMatrixWrap(pub(crate) [[char; SIZE]; SIZE]);

// Creates and returns a new Vigenere Matrix.
impl VigMatrixWrap {
    pub(crate) fn new() -> VigMatrixWrap {
        let mut mat: VigMatrixWrap = VigMatrixWrap([[' '; SIZE]; SIZE]);
        let binding = DictWrap::new().0;
        let mut acc = binding.iter().cycle();

        for r in 0..mat.0.len() {
            for c in 0..mat.0.len() {
                mat.0[r][c] = *acc.next().unwrap();
            }
            acc.next();
        }
        return mat;
    }
}
```

Again using the `Newtype Pattern` on the 2D array in order to have flexibility to implement foreign traits on it.

And the other interesting part is the use of the [cycle iterator], which essentially repeats itself endlessly. With every new row in the `for` cycle the `acc` cycle iterator is shifting in the proper order.

### 3. Define a Key

At least for MVP `v0.1.0` the key is a fixed `&str` hard-coded in `main.rs`:

`src/main.rs`
```rust
    
    let key = "°¡! RüST íS CóÓL ¡!°";
    
```

### 4. Define a Message to encode / decode

This value is be provided dynamically by the user in the `text` field of the HTML:

`src/main.rs`
```rust
    view! { cx,
        div {
            h2 {
                "Real-Time Vigénere Cipher"
            }
            p { input(placeholder="Enter a phrase", bind:value=name) }
        }
    }
```

On the `cipher.rs` side we will receive that value through the `encode` function as defined below.

### 5. Make the Key and Message have the same size

A function to adjust the size of a `Key` is defined as follows:

`src/cipher.rs`
```rust
// Completes the key if the size is not the same as the message.
fn complete_key(key: &str, msg_size: usize) -> String {
    let mut key_chars = key.chars().cycle();
    let mut new_key = "".to_string();
    for _ in 0..msg_size {
        new_key.push(key_chars.next().unwrap());
    }
    new_key
}

```

The interesting part here is again the use of the [cycle iterator], in order to adjust the size of key as small or as large as the message size.

### 6. Encode / Decode functions 

Finally comes the actual encryption logic. Let's start with the `Encode` function first:

`src/cipher.rs`
```rust
// Encodes a message (msg) with a key (key) using a Vigenere Matix (vig_mat).
pub(crate) fn encode(msg: &str, key: &str, vig_mat: VigMatrixWrap) -> Result<String, ErrorCode> {
    // get size of message and key
    let msg_size = msg.chars().count();
    let key_size = key.chars().count();

    // initializations
    let mut encrypted_msg = "".to_string();
    // let vig_mat = VigMatrixWrap::new();

    // if key has a differnt size, then complete it
    let mut key_e = key.to_string();
    if msg_size != key_size {
        key_e = complete_key(key, msg_size);
    }

    // convert to char vectors
    let key_chars: Vec<_> = key_e.to_string().chars().collect();
    let msg_chars: Vec<_> = msg.to_string().chars().collect();

    // encrypt message
    for i in 0..msg_size {
        encrypted_msg.push(vig_matcher(&vig_mat, msg_chars[i], key_chars[i])?);
    }

    Ok(encrypted_msg)
}
```

We define a `function` that receives a `message`, a `key` and a `Vigenére Matrix` and returns either a `String` with the encrypted message or an `ErrorCode`.

The fine part is the use of another `function`, called `vig_matcher`:

`src/cipher.rs`
```rust
// Returns the matching character in the Vigenere matrix, depending
// on the header (ch_m) and column (ch_k) characters provided
fn vig_matcher(m: &VigMatrixWrap, ch_m: char, ch_k: char) -> Result<char, ErrorCode> {
    let idx_c = idx_finder(ch_m, &m)?;
    let idx_r = idx_finder(ch_k, &m)?;

    Ok(m.0[idx_r][idx_c])
}
```

Which actually perform the match of each character between the `Message` and the `Key` by finding their indices in the `Vigenére Matrix` via an `idx_finder` function, that either returns an `index` for matching or an `ErrorCode`:

`src/cipher.rs`
```rust
// Returns the index value of a char in the Vigenere matrix.
fn idx_finder(ch: char, m: &VigMatrixWrap) -> Result<usize, ErrorCode> {
    for (idx, chi) in m.0[0].iter().enumerate() {
        if ch == *chi {
            return Ok(idx);
        }
    }
    Err(ErrorCode::InvalidChar(ch))
}

```


And now the `Decode` function:

`src/cipher.rs`
```rust
// Decodes an encoded message (enc_msg) with a key (key) and a Vigenere Matrix (vig_mat).
pub(crate) fn decode(
    enc_msg: &str,
    key: &str,
    vig_mat: VigMatrixWrap,
) -> Result<String, ErrorCode> {
    // get size of message and key
    let msg_size = enc_msg.chars().count();
    let key_size = key.chars().count();

    // initializations
    let mut decrypted_msg = "".to_string();

    // if key has a differnt size, then complete it
    let mut key_e = key.to_string();
    if msg_size != key_size {
        key_e = complete_key(key, msg_size);
    }

    // convert to char vectors
    let key_chars: Vec<_> = key_e.to_string().chars().collect();
    let msg_chars: Vec<_> = enc_msg.to_string().chars().collect();

    // decrypt message
    for letter in 0..msg_size {
        let mut msg_idx = 0;
        let key_idx = idx_finder(key_chars[letter], &vig_mat)?;
        for c in 0..vig_mat.0.len() {
            if vig_mat.0[key_idx][c] == msg_chars[letter] {
                msg_idx = c;
            }
        }
        decrypted_msg.push(char_finder(msg_idx, &vig_mat)?);
    }

    Ok(decrypted_msg)
}
```

It's the reverse substitution from that of `Encode` and utilizing a `char_finder` function inside the `Vigenére Matrix`:

`src/cipher.rs`
```rust
// Returns the char value of an index in the Vigenere matrix
fn char_finder(idx: usize, m: &VigMatrixWrap) -> Result<char, ErrorCode> {
    for (idi, chi) in m.0[0].iter().enumerate() {
        if idx == idi {
            return Ok(*chi);
        }
    }
    Err(ErrorCode::InvalidIndex(idx))
}
```

The function returns either the `char` or an `ErrorCode`.

The error codes are defined in the following `Enum`:

`src/cipher.rs`
```rust
#[derive(Debug)]
pub(crate) enum ErrorCode {
    InvalidChar(char),
    InvalidIndex(usize),
}
```

And that is pretty much all the encoding / decoding logic that is required.

Now, we just have to connect that logic with the web front-end and user interface elements defined in `main.rs`:

## Putting all together

First declare and initialize the dictionary and the relevant `reactive primitives` via [Sycamore signals]:

`src/main.rs`
```rust
#[component]
fn App<G: Html>(cx: Scope) -> View<G> {
    let key = "°¡! RüST íS CóÓL ¡!°";
    let dict = DictWrap::new().get_string();

    // Signals declaration.
    let phrase = create_signal(cx, String::new());
    let encr_signal = create_signal(cx, String::new());
    let decr_signal = create_signal(cx, String::new());
    let warning_signal = create_signal(cx, String::new());
    let dict_signal = create_signal(cx, String::new());
    let mat_signal = create_signal(cx, VigMatrixWrap::new());
```

The signals react as follows:

- phrase: when the user modifies the message in the `text` HTML field.
- encr_signal: to display in real-time the encoded message.
- decr_signal: to display in real-time the decoded message.
- warning_signal: to display in real-time an error message that comes from the cipher.
- dict_signal: to display the set of characters that comprise the `dictionary`.
- mat_signal: to create the `Vigenére Matrix` that will be used to encode and decode.

Next, we create a [Sycamore memo] which essentially recomputes derive values whenever a dependency changes. In this case if the `phrase` that the user is typing is not empty then we want to encode, decode and alter the signals real-time.

If it's empty, then set the encoded, decoded and warning signals empty as well.

`src/main.rs`
```rust
    // Memo declaration tied to phrase update in the textarea.
    let phrase_update = create_memo(cx, move || {
        if phrase.get().is_empty() {
            encr_signal.set("".to_string());
            decr_signal.set("".to_string());
            warning_signal.set("".to_string());
            dict_signal.set(dict.clone());
        } else {
            match encode(
                &phrase.get().as_ref().clone(),
                key,
                mat_signal.get().as_ref().clone(),
            ) {
                Ok(ok_phrase) => {
                    encr_signal.set(ok_phrase);
                    warning_signal.set("".to_string());
                }
                Err(error_kind) => match error_kind {
                    ErrorCode::InvalidChar(ic) => {
                        warning_signal.set(format!("Invalid character: {}", ic))
                    }
                    ErrorCode::InvalidIndex(ii) => {
                        warning_signal.set(format!("Invalid index: {}", ii))
                    }
                },
            }
            match decode(
                &encr_signal.get().as_ref().clone(),
                key,
                mat_signal.get().as_ref().clone(),
            ) {
                Ok(ok_phrase) => {
                    decr_signal.set(ok_phrase);
                }
                Err(error_kind) => match error_kind {
                    ErrorCode::InvalidChar(ic) => {
                        warning_signal.set(format!("Invalid character: {}", ic))
                    }
                    ErrorCode::InvalidIndex(ii) => {
                        warning_signal.set(format!("Invalid index: {}", ii))
                    }
                },
            }
        }
    });
```

If any of the signals has changed, then the display messages need to change accordingly:

`src/main.rs`
```rust
    let disp_dict = || {
        if dict_signal.get().is_empty() {
            "".to_string()
        } else {
            dict_signal.get().as_ref().clone()
        }
    };
    let disp_encr = || {
        if encr_signal.get().is_empty() {
            "".to_string()
        } else {
            encr_signal.get().as_ref().clone()
        }
    };
    let disp_decr = || {
        if decr_signal.get().is_empty() {
            "".to_string()
        } else {
            decr_signal.get().as_ref().clone()
        }
    };
    let disp_warning = || {
        if warning_signal.get().is_empty() {
            "".to_string()
        } else {
            warning_signal.get().as_ref().clone()
        }
    };
```

Next, we can update the `view!` macro to make it a little more attractive with minimum `CSS` and use a `textarea` for the user input:

`src/main.rs`
```rust
    view! { cx,
        div {
            h1 { "Real-Time Vigénere Cipher" }

            p { strong{"Key: "} "[" span(style="color:Tomato; font-family:'Courier New';"){(key)} "]" }

            p { textarea(placeholder="Enter a phrase...", autofocus=true, maxlength="50000", bind:value=phrase) }
            p { span(style="color:Tomato"){(disp_warning())}}

            p { strong{"Encoded: "} "[" span(style="color:Tomato; font-family:'Courier New';"){(disp_encr())} "]" }
            p { strong{"Decoded: "} "[" span(style="color:MediumSeaGreen; font-family:'Courier New';"){(disp_decr())} "]" }


            p { "The encoding dictionary includes the following set of " (SIZE) " ASCII characters:" br{}
              "[" span(style="color:Orchid;font-family:'Courier';"){(disp_dict())} "]" }

            footer {
                small{"Copyright 2022, " a(href="https://rsdlt.github.io/about/"){"Rodrigo Santiago"} ", " a(href="https://rsdlt.github.io/about/#terms-of-use"){"Terms of use"}}
               p { a(href="https://github.com/rsdlt/wasm-vigenere-cipher"){"GitHub Repo"} }
            }
        }
    }
```

And we can include a `CSS` library, in this case [Water.css], and a icon of [Ferris the crab] the `header` of our tiny HTML:

`index.html`
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"> 
    <title>WebAssembly Vigénere Cipher</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/dark.css">
    <link rel="icon" data-trunk href="rustacean-flat-happy.svg">
  </head>
  <body></body>
</html>
```

When serving with Trunk we see the results in the browser:

![Vigenère cipher with logic and style](demo-1.gif){: width="824" height="328" }
_Vigenére cipher working real-time_

![Vigenère cipher error handling](demo-2.gif){: width="824" height="328" }
_Vigenére cipher error handling_


## Final optimizations

Finally, we can follow [Sycamore recommendations] to optimize the Wasm binary size:

`Cargo.toml`
```toml
[profile.release]
# no backtrace for panic on release
panic = 'abort'
# optimize all codegen units
codegen-units = 1
# optimize aggressively for size
opt-level = 'z'
# enable link time optimization
lto = true
```


`index.html`
```html
    <link data-trunk rel="rust" data-wasm-opt="z" />
```

And build with `--release` flag in Trunk:

```terminal
 λ trunk build --release
 
2022-09-28T04:35:23.399894Z  INFO  starting build
2022-09-28T04:35:23.400629Z  INFO spawning asset pipelines
2022-09-28T04:35:23.468718Z  INFO copying & hashing icon path="rustacean-flat-happy.svg"
2022-09-28T04:35:23.468734Z  INFO building wasm-vigenere-cipher
2022-09-28T04:35:23.469385Z  INFO finished copying & hashing icon path="rustacean-flat-happy.svg"
   Compiling wasm-vigenere-cipher v0.1.1 (/home/rsdlt/Documents/Rust/wasm/wasm-vigenere-cipher)
    Finished release [optimized] target(s) in 3.33s
2022-09-28T04:35:26.841507Z  INFO fetching cargo artifacts
2022-09-28T04:35:26.909764Z  INFO processing WASM for wasm-vigenere-cipher
2022-09-28T04:35:26.940013Z  INFO using system installed binary app=wasm-bindgen version=0.2.83
2022-09-28T04:35:26.940242Z  INFO calling wasm-bindgen for wasm-vigenere-cipher
2022-09-28T04:35:26.978878Z  INFO copying generated wasm-bindgen artifacts
2022-09-28T04:35:26.980450Z  INFO calling wasm-opt
2022-09-28T04:35:27.575436Z  INFO copying generated wasm-opt artifacts
2022-09-28T04:35:27.576565Z  INFO applying new distribution
2022-09-28T04:35:27.577080Z  INFO  success
```

Which yields the following in `/dist/` ready to be hosted:

```terminal
 λ la dist
.rw-r--r--  727 rsdlt 28 Sep 00:35  index.html
.rw-r--r-- 7.4k rsdlt 28 Sep 00:35  rustacean-flat-happy-86989a1226cf0803.svg
.rw-r--r--  16k rsdlt 28 Sep 00:35  wasm-vigenere-cipher-5ddca96cbe025f7f.js
.rw-r--r--  81k rsdlt 28 Sep 00:35  wasm-vigenere-cipher-5ddca96cbe025f7f_bg.wasm
```

The full web application, including the icon of Ferris the crab, is less than 105kb. Pretty nice!

And the result is:

![Vigenère cipher complete](demo-3.gif){: width="912" height="555" }
_Vigenére cipher complete_

I definitely look forward to implementing other Rust projects with [Sycamore] + [Trunk] + [WebAssembly] in the future.

Don't forget to check the [demo] and the [GitHub] repository.

---

**_Links, references, and disclaimers:_**

- **Disclaimer:** I am not affiliated, associated, endorsed or sponsored by any the authors or developers of these libraries, books, or courses.

- [Rust] programming language.
- [Sycamore] reactive library.
- [Trunk] WASM web application bundler.
- [WASM] WebAssembly binary instruction format.
- [JavaScript] programming language.
- Tim McNamara's [Rust Code Challenges].
- [Vigenère cipher] Wikipedia article.
- [substitution] - Substitution cipher Wikipedia article.
- [MDN Web Docs] the Mozilla Dev Network Documentation.
- [Ferris the crab] a lovely mascot.
- [Water.css] a drop-in collection of CSS styles.

[Rust Code Challenges]:https://www.linkedin.com/learning/rust-code-challenges/let-s-put-rust-into-practice?autoplay=true
[Vigenère cipher]:https://en.wikipedia.org/wiki/Vigen%C3%A8re_cipher
[WASM]:https://webassembly.org/
[WebAssembly]:https://webassembly.org/
[Sycamore]:https://sycamore-rs.netlify.app/
[demo]:https://wasm-vigenere-cipher.onrender.com/
[Trunk]:https://trunkrs.dev/
[Rust]:https://www.rust-lang.org/
[GitHub]:https://github.com/rsdlt/wasm-vigenere-cipher
[JavaScript]:https://www.ecma-international.org/publications-and-standards/standards/ecma-262/
[substitution]:https://en.wikipedia.org/wiki/Substitution_cipher
[MDN Web Docs]:http://127.0.0.1:4000/posts/vigenere-cypher-wasm-rust-iterator-function/
[support it]:https://webassembly.org/roadmap/
[recommended build tool]:https://sycamore-rs.netlify.app/docs/getting_started/installation#install-trunk
[interaction]:https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface
[view!]:https://sycamore-rs.netlify.app/docs/basics/view
[6 steps outlined above]:#quick-summary-of-the-vigenére-cipher
[Newtype Pattern]:https://rsdlt.github.io/posts/rust-use-newtype-pattern-display-trait-array-generics/
[cycle iterator]:https://doc.rust-lang.org/std/iter/struct.Cycle.html
[Sycamore signals]:https://sycamore-rs.netlify.app/docs/basics/reactivity#signal
[Sycamore memo]:https://sycamore-rs.netlify.app/docs/basics/reactivity#memos
[Ferris the crab]:https://rustacean.net/
[Water.css]:https://watercss.kognise.dev/
[Sycamore recommendations]:https://sycamore-rs.netlify.app/docs/advanced/optimize_wasm_size
