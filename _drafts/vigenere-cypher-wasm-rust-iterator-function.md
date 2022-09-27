---
title: Rust in WebAssembly with Sycamore - Building a Real-Time Cipher
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

> Check the [demo here] and the [GitHub here].

Last week I came across Tim McNamara's [Rust Code Challenges], a great course by the way, where the final challenge is to develop a [Vigenère cipher], which according to Wikipedia resisted all attempts to break it for 310 years.

After completing the Tim's challenge, I thought that deploying a real-time Vigenére cipher in [WebAssembly] without touching a single [JavaScript] line of code would be a fun side project. Truth is, I loved it!

I decided on the [Sycamore] reactive library for the implementation and [Trunk] to build and bundle.

In summary: `let real_time_cipher = Rust + WebAssembly + Sycamore + Trunk;`

## What is WebAssembly?


## Sycamore - A reactive library

## What is Trunk?

## Quick summary of the Vigenére cipher

## The solution

---

**_Links, references, and disclaimers:_**

- **Disclaimer:** I am not affiliated, associated, endorsed or sponsored by any the authors or developers of these libraries, books, or courses. I use them for personal education purposes.

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
[demo here]:https://wasm-vigenere-cipher.onrender.com/
[Trunk]:https://trunkrs.dev/
[Rust]:https://www.rust-lang.org/
[GitHub here]:https://github.com/rsdlt/wasm-vigenere-cipher
[JavaScript]:https://www.ecma-international.org/publications-and-standards/standards/ecma-262/
