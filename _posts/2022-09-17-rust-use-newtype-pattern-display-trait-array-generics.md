---
title: Implementing the Display Trait on a Generic Array using Newtype Pattern  
author: rsdlt
date: 2022-09-17 18:15:00 +0800
categories: [Rust, Traits]
tags: [rust, trait, generics, newtype, array, display, const]
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

Probably one of the first things that someone does when learning a new programming language is to implement the famous `"Hello, world!"` message, which in the case of [Rust] comes with the boilerplate code via the `cargo new` command:

```rust
fn main() {
    println!("Hello, world!");
}
```

And then, start experimenting on how to display different `types` in the terminal, like `strings`, `integers`, `floats`, etc.:

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

In Rust it's pretty straightforward until we try to print a `struct` or other user-defined types:

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

The compiler yields an error and advice:

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

What's happening here?

## The Debug and Display traits

The compiler is basically saying that it doesn't know how to print the `struct Planet` type.

However, it's providing two alternatives:

1. Use the built-in formatters with `{:?}` or `{:#?}` in the `println!` macro, which requires implementing the `Debug` trait on the `struct Planet` type, or
2. Implement the `std::fmt::Display` trait and define the formatter for the type.

Let's review both alternatives in more detail.

First, the `Debug` trait can be implemented using the `#[derive(Debug)]` attribute:

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

And when running the program, the `struct Planet` type is printed using the built-in formatters provided by the `Debug` trait:

```terminal
λ cargo run -q
Planet { name: "Earth", surface_area: 510072000, polar_radius: 6356.752 }
Planet {
    name: "Earth",
    surface_area: 510072000,
    polar_radius: 6356.752,
}
```

On the other hand, implementing the `Display` trait isn't as straightforward as `Debug`, but can be accomplished by bringing `std::fmt::Display` into scope and writing an `impl` block for the `struct Planet` type, which defines the custom formatter in the `fn fmt(...)` function:

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


## Arrays and the 'Orphan Rule'


Now, let's try to follow the same steps but with an `Array`…

First, by defining an array of four `f64` elements and trying to print it with `println!`:

```rust
type MyArray = [f64; 4];

fn main() {
    let my_array: MyArray = [1.5, 2.5, 3.5, 4.5];
    println!("{}", my_array);
}
```

The compiler yields the same error code and advice for the `Array` type, just as it did for the `struct` type:

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

Following the compiler's guidance and using the built-in `"{:?}"` and `"{:#?}"` formatters works, just like with the `struct` type, and the array is printed:

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

Great!

Now, let's try to define a custom formatter via the `Display` trait for the `Array` type, just as we did with the `struct`:

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

Ups! Unfortunately, this doesn't work like it did with the `struct` type.

Looking closely at the compiler feedback, it's complaining that **arrays are always foreign types**.

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

It turns out that by implementing `Display` on any `Array` we're violating Rust's **Orphan Rule** which essentially forbid implementing a foreign trait on a foreign type.

A **foreign** type or trait is that which isn't local to our crate.

A **local** type or trait is that which is defined in our crate.

So, to overcome the *Orphan Rule* we must either:

- Implement a local trait on a foreign type: `impl MyCustomTrait for Vec<T>`, or
- Implement a foreign trait on a local type: `impl Display for MyStruct`.

Because the `struct Planet` was a type defined in our crate we were able to implement `Display`, a foreign trait, for it.

However, even if we define an `Array` in our crate, like we did with `MyArray` above, Rust will always treat arrays as a foreign type.

`Display` will always be a *foreign trait* and any `Array` that we define locally in our crate will always be a *foreign type*…

What can be done?

## The Newtype Pattern to the rescue

According to the [Rust Programming Language book], the `Newtype pattern` comes from the [Haskell Programming Language Newtype], and the idea is to essentially define a **local wrapper type** that encloses the `foreign type` in order to implement the `foreign trait` for the wrapper.

So, in a summary:

- Define a *new* `Wrapper` type local to the crate.
- Include the `foreign type` as an element of the `Wrapper` type.
- Implement the `foreign trait` for the `Wrapper` type.

One convenient approach is to use a *thin wrapper*, that's a `Wrapper type` that provides a straightforward way to get to the enclosed or `wrapped type` with minimum friction.

A `Tuple Struct` is a suitable *thin wrapper* type:

```rust
type MyArray = [f64; 4];

struct Wrap(MyArray);
```

It's not verbose, not redundant and allows a straightforward access to the underlying type with `wrap.0`:

```rust
fn main() {
    let my_array: MyArray = [1.5, 2.5, 3.5, 4.5];
    let my_wrap = Wrap(my_array);
    println!("{:?}", my_wrap.0)
}
```

```terminal
λ cargo run -q
[1.5, 2.5, 3.5, 4.5]
```

Now it's possible to implement the *foreign* `Display` trait for the *local* `Wrap` type that encloses the *foreign* `Array` type:

```rust
type MyArray = [f64; 4];

struct Wrap(MyArray);

impl Display for Wrap {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "-> Array:\n{}, {}, {}, {}",
            self.0[0], self.0[1], self.0[2], self.0[3]
        )
    }
}

fn main() {
    let my_array: MyArray = [1.5, 2.5, 3.5, 4.5];
    let my_wrap = Wrap(my_array);
    println!("{}", my_wrap)
}
```

When the program is executed, the custom format for the `Array` type is used via the `Display` trait:

```terminal
λ cargo run -q
-> Array:
1.5, 2.5, 3.5, 4.5
```

This code works well but is rather limited to:

- A single data type: `f64`.
- An array of size `4`.
- One `Array` type.

It's possible to leverage Rust's generics to make it more *extendable* and *idiomatic*.

## Extensibility with Generics

The first thing to do is make `Array` a generic type:

```rust
type MyArray<T, N> = [T; N];
```

However, the code above will fail to compile because 'N', which represents the size of the array, isn't a value:

```terminal
error[E0423]: expected value, found type parameter `N`
  --> src/main.rs:22:26
   |
22 | type MyArray<T, N> = [T; N];
   |                          ^ not a value
```

It's necessary to use Rust's [Const Generics] in order to make the array completely generic, as per the RFC definition:

>*Const Generics allow types to be generic over constant values; among other things this will allow users to write impls which are abstract over all array types.*

```rust
type MyArray<T, const N: usize> = [T; N];
```

And now, it's possible to make the `Wrap` type generic as well:

```rust
struct Wrap<T, const N: usize>(MyArray<T, N>);
```

Next, we need to make the `impl` of `Display` generic for arrays of any type and of any size, by declaring the `impl` with the same generics as those of the Wrap:

```rust
impl<T, const N: usize> Display for Wrap<T, N>
```

Then it's necessary to bound the `Array` type to those types that implement the `Display` trait, plus any other trait that's required for our particular implementation:

```rust
impl<T, const N: usize> Display for Wrap<T, N>
where
    T: PartialEq + Display,
```

In this particular case, the bound with the `PartialEq` trait is required because I'm making an equality comparison between elements of the array.

Last thing to do is to implement the required `Display` trait function: `fn fmt(...) -> std::fmt::Result`, with the desired custom formatter:

```rust
impl<T, const N: usize> Display for Wrap<T, N>
where
    T: PartialEq + Display,
{
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let separator = ", ";
        let mut s = "Array -> ".to_string();

        for element in &self.0 {
            s.push_str(&element.to_string());
            if element != self.0.last().unwrap() {
                s.push_str(&separator);
            }
        }
        write!(f, "{}", s)
    }
}
```

Finally!

It's now possible to define an `Array` of any size and of any type, so long as that type implements `Display`, and print it using the `println!` macro with a custom formatter:

```rust
fn main() {
    let my_array_f = [1.5, 2.5, 3.5, 4.5, 5.2, 6.75, 8.90];
    let my_array_c = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    let my_array_s = [
        "Hello".to_string(),
        "World!".to_string(),
        "from Rust!".to_string(),
    ];

    let my_wrap = Wrap(my_array_f);
    println!("{}", my_wrap);

    let my_wrap = Wrap(my_array_c);
    println!("{}", my_wrap);

    let my_wrap = Wrap(my_array_s);
    println!("{}", my_wrap);
}
```

Rust's powerful type inference detects the type of the `Array` and it's size, thanks to const generics!

And the result in the terminal is the following:

```terminal
λ cargo run -q
Array -> 1.5, 2.5, 3.5, 4.5, 5.2, 6.75, 8.9
Array -> a, b, c, d, e, f, g, h, i, j
Array -> Hello, World!, from Rust!
```

---

**_Links, references and disclaimers:_**

- Header Photo by [Faris Mohammed](https://unsplash.com/@pkmfaris) on [Unsplash](https://unsplash.com/).
- The [Rust] Programming Language.
- The [Rust Programming Language book].
- Rust's [Const Generics] RFC:  2000-const-generics.
- The [Haskell] Programming Language. 
- The [Haskell Programming Language Newtype].

[Rust]:https://www.rust-lang.org
[Rust Programming Language book]:https://doc.rust-lang.org/stable/book/ch19-03-advanced-traits.html#using-the-newtype-pattern-to-implement-external-traits-on-external-types
[Haskell Programming Language Newtype]:https://wiki.haskell.org/Newtype
[Const Generics]:https://rust-lang.github.io/rfcs/2000-const-generics.html
[Haskell]:https://www.haskell.org/
