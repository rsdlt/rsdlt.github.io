---
title: Basic Operator Overloading with Traits 
author: rsdlt
date: 2022-08-07 12:22:00 +0800
categories: [Rust, Traits]
tags: [rust, traits, operator overloading, user-define types, expressions]
pin: 
math: true
---


In this post I want to share one of my favorite characteristics about Rust: how it provides the capability to **overload an operator** to support arithmetic (and other) operations on our own **user-defined types**. 

But first, let's quickly review the use of arithmetic operators on common numeric types...

## Operators on Common Numeric Types

Like many programming languages, Rust provides a set of **binary operators** to process arithmetic **expressions**:

| Operator [^2] | Expression                   | Example |
| :-----------: | ---------------------------- | ------- |
|       +       | Addition                     | a + 10  |
|       -       | Subtraction                  | a - 10  |
|      /=       | Compound assignment division | a /= 10 |

Utilizing these operators to evaluate expressions on common numeric types, like `u16`, `i32` or `f64` is trivial:

~~~ rust

fn trivial() {
    let mut a = 40;
    let b = 20;
    
    assert_eq!(a + b, 60);
    assert_eq!(a - b, 10);
    
    a /= b;
    assert_eq!(a, 2);   
}
~~~

Pretty simple and straightforward. 

## Overloading User-Defined Types

Now, let's see what happens if we define `a` and `b` in more complex ways, for example as geometric homogeneous vectors, and try to add them with `+`:

$$
\begin{align}
  \vec{a} = 
  \begin{bmatrix}
    x & y & z & w
  \end{bmatrix}
\end{align}
$$


$$
\begin{aligned}
  \vec{b} = 
  \begin{bmatrix}
    x & y & z & w
  \end{bmatrix}
\end{aligned}
$$

$$
\begin{aligned}
  \vec{a} + \vec{b} = 
  \begin{bmatrix}
    x_{a} + x_{b} & y_{a} + y_{b} & z_{a} + z_{b} & w_{a} + w_{b}
  \end{bmatrix}
\end{aligned}
$$

We can conveniently define both $$ \vec{a} $$ and $$ \vec{b} $$ vectors in Rust using a `named-field Struct`:

~~~ rust
struct Vector {
    x: i32,
    y: i32,
    z: i32,
    w: i32,
}

fn more_complex() {
    let a = Vector {
        x: 1,
        y: 2,
        z: 3,
        w: 0,
    };
    let b = Vector {
        x: 5,
        y: 6,
        z: 7,
        w: 0,
    };

assert_eq!(
    a + b,
    Vector {
        x: 6,
        y: 8,
        z: 10,
        w: 0
    }
);
}
~~~

## Compiler Love
However when we try to add them, we are greeted with juicy errors from the compiler:
~~~ rust
error[E0369]: cannot add `Vector` to `Vector`
   --> src/lib.rs:58:22
    |
58  |         assert_eq!(a + b, vec![5, 7, 9, 11]);
    |                    - ^ - Vector
    |                    |
    |                    Vector
    |
note: an implementation of `Add<_>` might be missing for `Vector`
   --> src/lib.rs:6:5
    |
6   |     struct Vector {
    |     ^^^^^^^^^^^^^ must implement `Add<_>`
note: the following trait must be implemented
   --> /home/rsdlt/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/core/src/ops/arith.rs:100:1
    |
100 | / pub trait Add<Rhs = Self> {
101 | |     /// The resulting type after applying the `+` operator.
102 | |     #[stable(feature = "rust1", since = "1.0.0")]
103 | |     type Output;
...   |
114 | |     fn add(self, rhs: Rhs) -> Self::Output;
115 | | }
    | |_^
~~~

And it is precisely the clarity and verbosity of the compiler one of Rust's most distinguished qualities. The compiler is telling us exactly what we need to do:
1. Check the [E0369 error code documentation](https://doc.rust-lang.org/error-index.html#E0369) which clearly states that `A binary operation was attempted on a type which doesn’t support it.`
2. The binary operation happened in `a + b`
3. `struct Vector` must implement `'Add<>'`
4. `pub trait Add<Rhs = Self> {...}` implementation is detailed

So following the compiler's gentle guidance we proceed to implement the `Add` trait for the `struct Vector`...

First we bring the `Add` trait into scope so that we can use it:
~~~ rust
use std::ops::Add;
~~~

Second, we implement `Add<>` for `struct Vector`:
~~~ rust
struct Vector {
    x: i32,
    y: i32,
    z: i32,
    w: i32,
}

impl Add for Vector{
    type Output = Self;

    fn add(self, rhs: Self) -> Self {}
}
~~~

Third, we define our desired behavior in the extension method `add()`, which in this particular case basically means adding the vectors component-wise and returning the added vector: 

$$
\begin{align}
  \vec{a} + \vec{b} = 
  \begin{bmatrix}
    x_{a} + x_{b} & y_{a} + y_{b} & z_{a} + z_{b} & w_{a} + w_{b}
  \end{bmatrix}
\end{align}
$$

 ~~~ rust
fn add(self, rhs: Self) -> Self {
    Self {
        x: self.x + rhs.x,
        y: self.y + rhs.y,
        z: self.z + rhs.z,
        w: self.w + rhs.w,
    }
}
 ~~~

 Now, everything should be fine and we should be able to add our own user-defined types! But when we run the program we get another lovely compiler error:

 ~~~ rust
error[E0277]: `Vector` doesn't implement `Debug`
  --> src/lib.rs:61:9
   |
61 | /         assert_eq!(
62 | |             a + b,
63 | |             Vector {
64 | |                 x: 6,
...  |
68 | |             }
69 | |         );
   | |_________^ `Vector` cannot be formatted using `{:?}`
   |
   = help: the trait `Debug` is not implemented for `Vector`
   = note: add `#[derive(Debug)]` to `Vector` or manually `impl Debug for Vector`
   = note: this error originates in the macro `assert_eq` (in Nightly builds, run with -Z macro-backtrace for more info)
help: consider annotating `Vector` with `#[derive(Debug)]`
   |
7  |     #[derive(Debug)]
 ~~~

And again, the compiler ***does an extraordinary job*** in explaining exactly what is happening and how to fix it:
1. Check [E0277 error code documentation](https://doc.rust-lang.org/error-index.html#E0277) which clearly states that `tried to use a type which doesn’t implement some trait in a place which expected that trait.`
2. Our `struct Vector` is not implementing another trait called `Debug`
3. To implement `Debug` we need to add `#[derive(Debug)]` to our `struct Vector` or manually implement it

So its just a matter of following the compiler guidance and adding `#[derive(Debug)]` to `Vector`:
~~~ rust
 #[derive(PartialEq, Debug)]
 struct Vector {
     x: i32,
     y: i32,
     z: i32,
     w: i32,
 }
~~~
And it compiles! 

## Next Steps
Now we can use the `+` operator to add `Vectors` where all elements are of type `i32`. Here are the things that we could do next to expand our operator capabilities:
- Implement other binary operator traits like `+=`, `-`, `*`, `/` for our `Vector` type.
- Refactor `struct Vector` to `struct Vector<T>` to leverage generics in order to use other common numeric types like `f64`, `usize`, or even more complex user-defined types like `Matrices`:
  
$$
\begin{aligned} 
  A_{4\times 4} = 
  \begin{bmatrix}
    a_{11} & a_{12} & a_{13} & a_{14}\\
    a_{21} & a_{22} & a_{23} & a_{24}\\
    a_{31} & a_{32} & a_{33} & a_{34}\\
    a_{41} & a_{42} & a_{43} & a_{44}
  \end{bmatrix}
\end{aligned}
$$

I'm currently working on a personal project to implement a ray tracer fully built in Rust and the implementation of its **built-in traits** is extremely useful in defining vector and matrix operations in a _natural way_. 

Many programming languages, like `C++`, offer the capability to overload operators, however the way in which Rust implements it through `traits` and particularly how it guides us at compile time, with extremely rich feedback, is on a league of its own.

***
**_Links, references and disclaimers:_**   

[^2]: For a full list of supported operators visit [https://doc.rust-lang.org/std/index.html](https://doc.rust-lang.org/std/index.html)
 


