---
title: Implementing Display Trait on a Generic Array using Newtype Pattern  
author: rsdlt
date: 2022-09-17 11:30:00 +0800
categories: [Rust, Traits]
tags: [rust, trait, generics, newtype, array, display]
pin:
math: true
mermaid: true
img_path: /assets/img/newtype-pattern-array-generics-display-trait/ 
image:
  path: faris-mohammed-PQinRWK1TgU-unsplash.jpg
  width: 1200 
  height: 606 
  alt: Photo by Faris Mohammed via Unsplash 
---

Probably one of the first things that someone does when learning a new programming language is to implement the famous `"Hello, world!"` message, which in the case of [Rust] comes with the boilerplate code via the `cargo new my_app` command:

```rust
fn main() {
    println!("Hello, world!");
}
```

And then take it from there by experimenting on how to display different `types` in the terminal:

```rust
fn main() {
    let planet = "Earth";
    let surface_area = 510072000;
    let polar_radius = 6356.752;
    println!(
        "Hello, {}!\nSurface area: {}\nPolar radius: {}",
        planet, surface_area, polar_radius
    );
}
```

```terminal
λ cargo run -q
Hello, Earth!
Surface area: 510072000
Polar radius: 6356.752
```

However, when trying to print a `struct` the compiler yields an error and advice:

```rust
struct Planet {
    name: String,
    surface_area: i64,
    polar_radius: f64,
}

fn main() {
    let planet = Planet {
        name: "Earth".to_string(),
        surface_area: 510072000,
        polar_radius: 6356.752,
    };
    println!("{}", planet);
}
```

```terminal
 λ cargo run -q
error[E0277]: `Planet` doesn't implement `std::fmt::Display`
  --> src/main.rs:20:20
   |
20 |     println!("{}", planet);
   |                    ^^^^^^ `Planet` cannot be formatted with the default formatter
   |
   = help: the trait `std::fmt::Display` is not implemented for `Planet`
   = note: in format strings you may be able to use `{:?}` (or {:#?} for pretty-print) instead
   = note: this error originates in the macro `$crate::format_args_nl` (in Nightly builds, run with -Z macro-backtrace for more info)

For more information about this error, try `rustc --explain E0277`.
error: could not compile `temp` due to previous error
```

## The Debug and Display traits

The compiler is basically providing two alternatives:

1. Use the built-in formatter by using `{:?}` or `{:#?}`, which requires implementing the `Debug` trait.
2. Implement the `std::fmt::Display` trait.

The `Debug` trait can be implemented using the `#[derive(Debug)]` attribute:

```rust
#[derive(Debug)]
struct Planet {
    name: String,
    surface_area: i64,
    polar_radius: f64,
}

fn main() {
    let planet = Planet {
        name: "Earth".to_string(),
        surface_area: 510072000,
        polar_radius: 6356.752,
    };
    println!("{:?}", planet);
    println!("{:#?}", planet);
}
```

And when running the program the `struct` is printed using the built-in formatters provided by the `Debug` trait:

```terminal
λ cargo run -q
Planet { name: "Earth", surface_area: 510072000, polar_radius: 6356.752 }
Planet {
    name: "Earth",
    surface_area: 510072000,
    polar_radius: 6356.752,
}
```

On the other hand, implementing the `Display` trait isn't as straightforward but can be accomplished by bringing `std::fmt::Display` into scope and writing an `impl` block for the `struct`:

```rust
use std::fmt::Display;

struct Planet {
    name: String,
    surface_area: i64,
    polar_radius: f64,
}

impl Display for Planet {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "-> {}:\n\tSurface: {} km2\n\tPolar radius: {} km",
            self.name, self.surface_area, self.polar_radius
        )
    }
}

fn main() {
    let planet = Planet {
        name: "Earth".to_string(),
        surface_area: 510072000,
        polar_radius: 6356.752,
    };
    println!("{}", planet);
}
```

Implementing `Display` allows the definition of a custom printing format for the type:

```terminal
λ cargo run -q
-> Earth:
	Surface: 510072000 km2
	Polar radius: 6356.752 km
```


## Arrays violate the 'Orphan Rule'


Now, let's try to follow the same steps but with an `Array`…

First, by defining an array of four `f64` elements and trying to print it with `println!`:

```rust
type MyArray = [f64; 4];

fn main() {
    let my_array: MyArray = [1.5, 2.5, 3.5, 4.5];
    println!("{}", my_array);
}
```

The compiler yields the same error and warning for the `Array` as it did for the `struct`:
```terminal
 λ cargo run -q
error[E0277]: `[f64; 4]` doesn't implement `std::fmt::Display`
  --> src/main.rs:25:20
   |
25 |     println!("{}", my_array);
   |                    ^^^^^^^^ `[f64; 4]` cannot be formatted with the default formatter
   |
   = help: the trait `std::fmt::Display` is not implemented for `[f64; 4]`
   = note: in format strings you may be able to use `{:?}` (or {:#?} for pretty-print) instead
   = note: this error originates in the macro `$crate::format_args_nl` (in Nightly builds, run with -Z macro-backtrace for more info)

For more information about this error, try `rustc --explain E0277`.
```

Following the compiler's guidance and using the built-in `"{:?}"` and `"{:#?}"` formatters works and the array is printed:
```terminal
 λ cargo run -q
[1.5, 2.5, 3.5, 4.5]
[
    1.5,
    2.5,
    3.5,
    4.5,
]
```

Now, let's try to define a custom formatter via the `Display` trait, just as we did with the `struct`:

```rust
type MyArray = [f64; 4];

impl Display for MyArray {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}, {}, {}, {}", self[0], self[1], self[2], self[3])
    }
}

fn main() {
    let my_array: MyArray = [1.5, 2.5, 3.5, 4.5];
    println!("{}", my_array);
}
```

Unfortunately, this doesn't work as the compiler yields the following error:

```terminal
 λ cargo run -q
error[E0117]: only traits defined in the current crate can be implemented for arbitrary types
  --> src/main.rs:25:1
   |
25 | impl Display for MyArray {
   | ^^^^^^^^^^^^^^^^^-------
   | |                |
   | |                this is not defined in the current crate because arrays are always foreign
   | impl doesn't use only types from inside the current crate
   |
   = note: define and implement a trait or new type instead

For more information about this error, try `rustc --explain E0117`.
```

The compiler complains that **arrays are always foreign types**.

If we run `rustc --explain E0117` the compiler provides additional details about what is happening here:

```terminal
This error indicates a violation of one of Rust's orphan rules for trait
implementations. The rule prohibits any implementation of a foreign trait (a
trait defined in another crate) where

 - the type that is implementing the trait is foreign
 - all of the parameters being passed to the trait (if there are any) are also
   foreign.

To avoid this kind of error, ensure that at least one local type is referenced
by the `impl`...
```

It turns out that by implementing `Display` on any `Array` we are violating Rust's **Orphan Rule** which essentially forbid implementing a foreign trait on a foreign type.

A foreign type or trait is that which is not local to our crate. 

A local type or trait is that which is defined in our crate.

So, to overcome the *Orphan Rule* we must either:

- Implement a local trait on a foreign type: `impl MyCustomTrait for Vec<T>`, or
- Implement a foreign trait on a local type: `impl Display for MyStruct`.

Because the `struct Planet` was a type defined in our crate we were able to implement `Display`, a foreign trait, for it.

However, even if we define an `Array` in our crate, like we did with `MyArray` above, Rust will always treat arrays as a foreign type.

What can be done? `Display` will always be a *foreign trait* and any `Array` that we define locally in our crate will always be a *foreign type*…

## The Newtype Pattern to the rescue


---

**_Links, references and disclaimers:_**

Header Photo by [Faris Mohammed](https://unsplash.com/@pkmfaris) on [Unsplash](https://unsplash.com/)

[Rust]:https://www.rust-lang.org
