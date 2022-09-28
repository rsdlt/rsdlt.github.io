---
title: Building a Real-Time Web Cipher with Rust, Sycamore and Trunk
author: rsdlt
date: 2022-09-21 12:15:00 +0800
categories: [Rust, Wasm]
tags: [rust, array, wasm, iterator, webassembly]
pin:
math: true
mermaid: true
img_path: /assets/img/vigenere-cypher-iterators/ 
image:
  path: 2022-09-25 15-48.gif 
  width: 885 
  height: 334 
  alt: WASM Vigenére Cipher 
---

> Check the [demo] and the [GitHub] repo.

Some days ago I came across Tim McNamara's [Rust Code Challenges], a great course by the way, where the final challenge is to develop a [Vigenère cipher], which according to Wikipedia resisted all attempts to break it for 310 years.

After completing the Tim's challenge, I thought that deploying a real-time Vigenére cipher on the Web, and without touching a single [JavaScript] line of code would be a fun project. 

Truth is, I loved it!


## Quick summary of the Vigenére cipher 

The Vigenére cipher is a simplified polyalphabetic [substitution] encoder. It's essentially an algorithm where a set of characters or _message_ is substituted with another set of characters or _encoded message_ with the help of a _key_. To decode the encoded message, the receiver performs the inverse substitution process. 

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
    - Which based on their web page is _"… a __reactive__ library for creating web apps in Rust and Webassembly…"_ that can be used to _"… create apps without touching a single line of JS… "_.
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

The UI is handled through a [view!] Rust macro with no closing html tags:

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

---

**_Links, references, and disclaimers:_**

- **Disclaimer:** I am not affiliated, associated, endorsed or sponsored by any the authors or developers of these libraries, books, or courses.

- [Rust] programming language.
- [Sycamore] reactive library.
- [Trunk] WASM web application bundler.
- [WASM] WebAssembly binary instruction format.
- [JavaScript] programming language.
- Tim McNamara's [Rust Code Challenges].

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
