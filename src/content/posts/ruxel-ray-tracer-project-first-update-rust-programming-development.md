---
title: Ruxel - Building a Ray Tracer with Rust (Prelude)  
author: rsdlt
date: 2022-08-10 09:35:00 +0800
categories: [Rust, Ray Tracer]
tags: [rust, ray tracer, 3D, rendering]
pin:
math: true
mermaid: true
---

As far back as I can remember I have always been fascinated by **3D graphics**. And building a **Ray Tracer and Renderer** seems like a fantastic project to sharpen my skills with Rust. 

So I have embarked to build one from the ground up and share my experience over a series of posts.

I have decided to name it `Ruxel`, which is a _portmanteau_ of Rust + pixel. 

My objective is to try to update this series at least on a weekly basis, so here you can expect to find the GitHub and crates.io repositories:


|        GitHub        |  crates.io   |
| :------------------: | :----------: |
| [rsdlt/ruxel][ruxel] | [ruxelcrate] |


## Why a Ray Tracer on Rust
1. 3D graphics processing is _intensive_ on machine resources and greatly benefits from _low-level_ control.
2. Rust is _fast_ and its speed has been benchmarked against `C`, `C++` and `Go` with outstanding results.
3. Rust promises _zero cost_ abstractions 
4. Rust is _free of undefined behavior_ so no dangling pointers, data races, null dereferences or other nasty stuff at runtime.
5. Rust compiler is incredibly _clear and verbose_.


## Goals for Ruxel Version 0.1.0

### Functional

Be able to render and ray trace the following:
- Shapes:
  - Spheres
  - Planes
  - Cubes
  - Cylinders
  - Triangles
  - Patterns
  - OBJ files

- With these attributes:
  - Lights
  - Shading
  - Shadows
  - Patterns
  - Reflections
  - Refractions

### Development 

- Idiomatic and ergonomic code:
  - Semantic typing
  - Semver and features
  - Adherence to Rust's API guidelines
  - Thorough documentation (`rustdoc` and `doc-tests`)
  - Changelog
- Test driven
- Benchmarking and performance testing
- Graceful error handling
- Well-structured
- Single threaded (multithreading for future versions) 


## Interesting Resources
Here are some of the best books[^disc] on these topics that I've come across, and think that can help me with this personal project: 

- Rendering and 3D graphics:
  - [The Ray Tracer Challenge][rtc] by Jamis Buck.[^1]
  - [Physically Based Rendering: From Theory to Implementation][pbr] by Matt Pharr, Wenzel Jakob and Greg Humphreys.[^2]
  - [Real-Time Rendering][rtr] by Tomas Kenine-Möller, Eric Haines, Naty Hoffman, Angelo Pesce, Michal Iwanicki and Sébastien Hillaire[^3]
- Rust programming:
  - [Programming Rust: Fast, Safe Systems Development][prust] by Jim Blandy, Jason Orendorff and Leonora F.S. Tindall[^4]
  - [Rust for Rustaceans][rrust] by Jon Gjengset[^5]

And here are some links with useful insights and information:
- [One Hundred Thousand Lines of Rust][mtklad] by Aleksey Kladov (mtklad)
- [Rust Design Patterns][rdp] found on [rust-unofficial/patterns][rdpr]
- [Rust API Guidelines][rapig] found on [rust-lang/api-guidelines][rapigr]

## Next Steps
Well, without further ado let's start coding! 

***


[ruxel]: https://github.com/rsdlt/ruxel
[ruxelcrate]: https://crates.io/crates/ruxel

[rtc]: https://pragprog.com/search/?q=the-ray-tracer-challenge
[pbr]: https://www.pbr-book.org/
[rtr]: https://www.taylorfrancis.com/books/mono/10.1201/b22086/real-time-rendering-tomas-akenine-mo%C2%A8ller-eric-haines-naty-hoffman

[prust]:https://www.oreilly.com/library/view/programming-rust-2nd/9781492052586/
[rrust]:https://rust-for-rustaceans.com/

[mtklad]: https://matklad.github.io/2021/09/05/Rust100k.html
[rdp]: https://rust-unofficial.github.io/patterns/intro.html
[rdpr]: https://github.com/rust-unofficial/patterns
[rapig]: https://rust-lang.github.io/api-guidelines/
[rapigr]: https://github.com/rust-lang/api-guidelines


**_References and disclaimers:_**

[^disc]: Disclaimer: I am not affiliated, associated, endorsed or sponsored by any these authors or publishers. I own physical copies of these books and use them for personal education purposes.
[^1]: Buck, Jamis. (2019). _The ray tracer challenge: A test-driven guide to your first 3D renderer_. The Pragmatic Programmers.
[^2]: Pharr, M., Jakob, W., Humphreys, G. (2017). _Physically based rendering: From theory to implementation (3rd ed.)_. Morgan Kaufmann
[^3]: Akenine-Möller, T., Haines, E., Hoffman, N., Pesce, A., Iwanicki, M., Hillaire, S. (2018). _Real-time rendering (4th ed.)_. CRC Press, Tailor & Francis Group. 
[^4]: Blandy, J., Orendorff, J, F.S Tindall, L. (2021). _Programming Rust: Fast, safe systems development (2nd ed.)_. O'Reilly
[^5]: Gjengset, J. (2022). _Rust for rustaceans: idiomatic programming for experienced developers_. No Starch Press



