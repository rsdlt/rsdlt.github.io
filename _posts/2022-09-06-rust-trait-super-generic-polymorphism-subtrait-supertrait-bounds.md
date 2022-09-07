---
title: How to Use Rust Traits, Generics and Bounds  
author: rsdlt
date: 2022-09-06 21:30:00 +0800
categories: [Rust, Traits]
tags: [rust, trait, supertrait, generics, struct, refactoring, bounds]
pin:
math: true
mermaid: true
img_path: /assets/img/rust-generics-traits/ 
image:
  path: brecht-corbeel-8TttTCQLUKw-unsplash.jpg
  width: 1229 
  height: 531 
  alt: Photo by Brecht Corbeel via Unsplash 
---

Every time I am developing the question I am always asking myself is _"is this code idiomatic, ergonomic and extendable enough?"_

I ask myself that question much more at the beginning, when all the scaffolding and critical building blocks are being created, and _particularly_ when defining types that will be the workhorses of the entire project.

Because I know that if I don't do it correctly there will be significant pain in the form of _refactoring_ later on.

And usually the answer to that question is _"yes"_ up until I make some progress and then I realize that my code was in fact _"not extendable enough"_ or that _"there was a better way to do it."_

And then comes the decision to either _refactor_ or continue building on top of the code that I know is just not good enough.

And this is precisely what just happened with my project [Ruxel]…

After I finished developing and testing all the vector and matrix logic for the ray tracer, I came back this weekend to review the code again, including my [Ruxel Part 1] post, and I noticed that my implementation could have leveraged `generics` and `traits` in a much better way by using `trait bounds`.

Hence, I have decided to _refactor_ part of my initial implementation and also share in this post how I plan to leverage Rust's `Traits`, `Generics` and `Bounds` in a way that makes the code more _idiomatic_, _extendable_ and _ergonomic_.

## Main Problem

At the heart of a `ray tracer` exist two types: `Vector3` and `Point3` that are _very_ similar but with key differences, particularly because of its _weight_ `w:` component, when expressed in their _homogeneous_ form:

$$
\begin{align}
  \vec{v} =
  \begin{bmatrix}
    x & y & z & w = 0
  \end{bmatrix}
\end{align}
$$

$$
\begin{align}
  \vec{p} =
  \begin{bmatrix}
    x & y & z & w = 1
  \end{bmatrix}
\end{align}
$$

It's convenient that both types can be declared with either `floating point` or `integer` values.

Both types share `common behavior`, but also each one has its own `specific functionality`.

And both types are _the_ workhorses of the entire project so they need to be implemented in the most _extendable_, _ergonomic_ and _idiomatic_ way.

In summary, this is the scenario to implement:

![Point3 vs Vector3](point3-vector3-comparison.png){: w="792" h="569"}
_Point3 vs Vector3_

What's the best approach?

## Possible Alternatives

There are countless ways to approach the implementation of these types in [Rust]. However,I think the most common a programmer would try are:

1. No generics, no traits
2. Generic structs and traits

Let's review the implications of each in more detail…

### 1. No generics, no traits

To implement this approach, the following `types` would be required:

```rust
struct Point3F64 {
    x: f64,
    y: f64,
    z: f64,
    w: f64,
}

struct Point3I64 {
    x: i64,
    y: i64,
    z: i64,
    w: i64,
}

struct Vector3F64 {
    x: f64,
    y: f64,
    z: f64,
    w: f64,
}

struct Vector3I64 {
    x: i64,
    y: i64,
    z: i64,
    w: i64,
}
```

From the get-go it's clear that this will become a nightmare, as **each** `struct` will need its **own** `impl` block like this:

```rust
impl Vector3F64 {
    fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z, w: 0f64 }
    }

    fn zero() -> Self {
        Self {
            x: 0f64,
            y: 0f64,
            z: 0f64,
            w: 0f64,
        }
    }

    // Other Associated Functions

    fn dot(self, rhs: Vector3F64) -> f64 {
        self.x * rhs.x + self.y * rhs.y + self.z * rhs.z + self.w * rhs.w
    }

    // Other Methods
}
```

And things will get ever more convoluted when implementing `Operator Overloading` for each type:

```rust
impl Add for Vector3F64 {
    type Output = Vector3F64;

    fn add(self, rhs: Self) -> Self::Output {
        Self {
            x: self.x + rhs.x,
            y: self.y + rhs.y,
            z: self.z + rhs.z,
            w: self.z + rhs.w,
        }
    }
}

impl Add for Vector3I64 {
    type Output = Vector3I64;

    fn add(self, rhs: Self) -> Self::Output {
        Self {
            x: self.x + rhs.x,
            y: self.y + rhs.y,
            z: self.z + rhs.z,
            w: self.z + rhs.w,
        }
    }
}
```

Following this approach would require implementing:

|                                    | non-generic implementation  |
|------------------------------------|-------------|
| Associated functions               | 36          |
| Methods                            | 14          |
| Operator overload functions            | 24          |
| Copy attributes                    | 4           |
| Default attributes                 | 4           |
| Display, Debug and PartialEq functions | 1          |

This approach is:

- Not _extendable_, because supporting another primitive type like `i32` has the effect of requiring an additional:

|                                    | new primitive  |
|------------------------------------|-------------|
| Associated functions               | 13          |
| Methods                            | 7          |
| Operator overload functions            | 11          |
| Copy attributes                    | 1           |
| Default attributes                 | 1           |
| Display, Debug and PartialEq functions | 4          |


- Not _idiomatic_, because it is not:
    - Leveraging the capabilities provided by Rust to solve this particular situation 
    - Following the best practices of the Rust community
    - Succint in its approach 
    - Using the expressing power of Rust effectively
- Not _ergonomic_, because it:
    - Is full of development friction
    - Doesn't seek simplicity
    - Is inefficient
    - Makes testing exponentially more complicated

Hence, unless the intention is to support only one primitive per struct type, this approach should be discarded.

### 2. Generic structs and traits

The next approach involves the use of `generics` in the struct declarations as follows:

```rust
struct Vector3<T> {
    x: T,
    y: T,
    z: T,
    w: T,
}

struct Point3<T> {
    x: T,
    y: T,
    z: T,
    w: T,
}
```

From the start, the required struct declarations are reduced to only `2`. Even if in the future the project supports another primitive, like `i32` these struct declarations would not change and no additional declarations would be required.

It's a big step in the right direction.

Implementing the associated functions and methods is also more ergonomic and idiomatic with this approach by leveraging Rust's `trait bounds` using the `where` keyword:

```rust
impl<T> Vector3<T>{
    fn dot(self, rhs: Vector3<T>) -> T
    where T: Copy + Add<Output = T> + Mul<Output = T>
    {
        self.x * rhs.x + self.y * rhs.y + self.z * rhs.z + self.w * rhs.w
    }
}
```

The example above will work for any type that implements the `Copy`, `Add` and `Mul` traits, like: `f64`, `f32`, `i64`, `i32`, etc.

There is no more code to write to _extend_ the dot product functionality for more primitives.

However, in those associated functions where a `value`, other than `Default::default()`, needs to be specified there is still the need to implement them separately:

```rust
impl Point3<f64>{
    fn new(x: f64, y: f64, z: f64)  -> Self{
        Self{x, y, z, w: 1f64}
    }
}

impl Point3<i64>{
    fn new(x: i64, y: i64, z: i64)  -> Self{
        Self{x, y, z, w: 1i64}
    }
}
```

Yet for the cases where `Default::default()` applies there is only one function to specify:

```rust
impl<T> Vector3<T>{
    
    // Other generic associated functions

    fn new(x: T, y: T, z: T) -> Self
    where T: Copy + Add + Mul + Default
    {
        Self{x, y, z, w: Default::default()}
    }
}
```

This generic `new(...)` function of `Vector3<T>` will work with any type that implements the `Copy` and `Default` traits, again like `f64`, `f32`, etc.

By my estimations, with this approach the following implementations would be required:

|                                    | generic implementation  |
|------------------------------------|-------------|
| Associated functions               | 26          |
| Methods                            | 6          |
| Operator overload functions            | 7          |
| Copy attributes                    | 2           |
| Default attributes                 | 2           |
| Display, Debug and PartialEq functions | 3          |

When compared versus the non-generic approach the improvement is _significant_:

|                                    | non-generic | generic | difference |
|------------------------------------|-------------|---------|------------|
| Associated functions               | 36          | 26      | -10        |
| Methods                            | 14          | 6       | -8         |
| Operator overload functions            | 24          | 7       | -17        |
| Copy attributes                    | 4           | 2       | -2         |
| Default attributes                 | 4           | 2       | -2         |
| Display, Debug and PartialEq functions | 12          | 3       | -9         |

Hence, this approach is:

- Much more _extendable_, because supporting other primitive like `i32` would only require an additional:

|                                    | new primitive  |
|------------------------------------|-------------|
| Associated functions               | 9          |
| Methods                            | 0          |
| Operator overload functions            | 0          |
| Copy attributes                    | 0           |
| Default attributes                 | 0           |
| Display, Debug and PartialEq functions | 0          |

- More _idiomatic_, because it:
    - Leverages the `generics` capabilities provided by Rust that solve this particular problem
    - Follow the best practices of the Rust community by using 'trait bounds' and `generics` 
    - Significantly more succint in the approach, as the comparison table above proved
    - Uses the expressing power of Rust effectively 

- More _ergonomic_, because it:
    - Has less developer friction: declaring a new Vector is `let v = Vector3::new(...)` instead of `let v = Vector3F64::new(...)` or `let v = Vector3I32::new(...)`
    - Seeks simplicity with far less code
    - Is efficient as it enables the same capabilities with less
    - Testing is less burdensome as there are far fewer functions and scenarios to validate

It has been a big improvement by utilizing generics with trait bounds.

And most important: there is no impact on the speed and performance because this implementation is using `static dispatch`.

## Supertraits and Subtraits

One additional Rust feature to further provide _extensibility_ to the project is to define three traits in order to group the common behavior in a logical way via `supertraits` and `subtraits`:

![Supertrait and Subtrait structure](point3-vector3-supertrait-subtrait.png){: w="737" h="540"}
_Tuple Supertrait with Vector and Point Subtraits_

> The important part here is that the subraits **don't** inherit the functions or methods from the supertrait. Every type that implements the subtrait **must** implement the functions of the supertrait.
{: .prompt-warning }

What this means in Rust code is the following:

```rust
// -- Trait declarations
trait Tuple<P> {
    fn new(x: P, y: P, z: P) -> Self
    where
        P: Copy + Default;
}

trait Vector<P>: Tuple<P> {
    fn dot(lhs: Vector3<P>, rhs: Vector3<P>) -> P 
    where
        P: Copy + Add<Output = P> + Mul<Output = P>;
}
trait Point<P>: Tuple<P> {
    fn origin(x: P) -> Self
    where
        P: Copy + Default;
}


// -- Supertrait implementations
impl<P> Tuple<P> for Vector3<P> {
    fn new(x: P, y: P, z: P) -> Vector3<P> where P: Copy + Default{
        Vector3 { x, y, z, w: Default::default() }
    }
}

impl Tuple<f64> for Point3<f64> {
    fn new(x: f64, y: f64, z: f64) -> Self {
        Point3 { x, y, z, w:1f64 }
    }
}

impl Tuple<i64> for Point3<i64> {
    fn new(x: i64, y: i64, z: i64) -> Self {
        Point3 { x, y, z, w:1i64 }
    }
}

// -- Subtrait implementations
impl<P> Vector<P> for Vector3<P> {
    fn dot(lhs: Vector3<P>, rhs: Vector3<P>) -> P 
    where
        P: Copy + Add<Output = P> + Mul<Output = P>,
        {
       lhs.x * rhs.x + lhs.w * rhs.w
    }

}
```

`Vector3<P>` and `Point3<P>` are implementing the `new(x:...) -> Self` function from the `Tuple<P>` trait and not from one of its subtraits.

Because the type **must** implement the supertrait functions of those subtraits that it implements, it's critical to define under which scope a capability will be defined in order to balance logical grouping and efficiency:
- Supertrait
- Subtrait
- Type implementation 


![Supertrait, Subtrait and Type](supertrait-subtrait-tuple-impl.png){: w="672" h="804"}
_Type implements supertrait functions, there is no inheritance in Rust_

For example, defining the `ones()` function -which returns a Vector or Point with '1' value in all its coordinates- in the `Tuple<P>` supertrait scope **forces** the implementation of that function in both `Point<P>` and `Vector<P>` and all of their non-generic implementations like `impl Tuple<i64> for Point3<i64>`:

```rust
// -- Trait declarations
trait Tuple<P> {
    fn new(x: P, y: P, z: P) -> Self
    where
        P: Copy + Default;

    fn ones() ->Self
        where P: Copy + Default;
}
```

The compiler will be happy to let us know where an implementation is missing:

```console
Rust/playground on  master [!] > v0.1.0 | v1.63.0
 λ cargo test it_works -- --nocapture
   Compiling playground v0.1.0 (/home/rsdlt/Documents/Rust/playground)
error[E0046]: not all trait items implemented, missing: `ones`
  --> src/lib.rs:46:1
   |
29 | /     fn ones() ->Self
30 | |         where P: Copy + Default;
   | |________________________________- `ones` from trait
...
46 |   impl<P> Tuple<P> for Vector3<P> {
   |   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ missing `ones` in implementation

error[E0046]: not all trait items implemented, missing: `ones`
  --> src/lib.rs:52:1
   |
29 | /     fn ones() ->Self
30 | |         where P: Copy + Default;
   | |________________________________- `ones` from trait
...
52 |   impl Tuple<f64> for Point3<f64> {
   |   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ missing `ones` in implementation

error[E0046]: not all trait items implemented, missing: `ones`
  --> src/lib.rs:58:1
   |
29 | /     fn ones() ->Self
30 | |         where P: Copy + Default;
   | |________________________________- `ones` from trait
...
58 |   impl Tuple<i64> for Point3<i64> {
   |   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ missing `ones` in implementation

For more information about this error, try `rustc --explain E0046`.
error: could not compile `playground` due to 3 previous errors
```

It could appear that adding the supertrait and subtrait capabilities is generating more headaches than benefits… However, the benefits of structuring the common behavior this way are in my humble view, the following:

1. It forces thinking twice and hard under which scope it makes logical sense to add a new capability.
2. Once defined, the compiler will make sure that the capability is implemented everywhere it needs to be implemented.
3. Having a type defined within the bounds of the supertrait for cases that could be of benefit like `... where T: Tuple + Copy`.

## How could I have done better?

Going back to [Ruxel Part 1] I am basically using two `generic traits` called `CoordInit<T, U>` and `VecOps<T>` which provide coordinate initialization and vector operations' capabilities, respectively. 

Because they are generic traits, what followed was the implementation of each of those traits over the `Vector3<f64>` and `Point3<f64>` types:

```rust
impl VecOps<Vector3<f64>> for Vector3<f64> {
    fn magnitude(&self) -> f64 {
        (self.x.powf(2.0) + self.y.powf(2.0) + self.z.powf(2.0)).sqrt()
    }

    // Rest of Vector3<f64> operation methods and functions
```

```rust
impl CoordInit<Vector3<f64>, f64> for Vector3<f64> {
    fn back() -> Self {
        Vector3 {
            x: 0.0,
            y: 0.0,
            z: -1.0,
            w: 0.0,
        }
    }

    // Rest of Vector3<f64> initialization functions
```

```rust
impl CoordInit<Vector3<f64>, f64> for Point3<f64> {
    fn back() -> Self {
        Vector3 {
            x: 0.0,
            y: 0.0,
            z: -1.0,
            w: 0.0,
        }
    }

    // Rest of Point3<f64> initialization functions
```

Now, how would this approach support the addition of an `i64` primitive type?

Not in a very _ergonomic_ or _idiomatic_ or _extendable_ way.

Essentially, the following implementation blocks would need to be created and all the existing functions and methods defined for the `f64` primitive be repeated (almost carbon copy) for each:
- `impl VecOps<Vector3<i64>> for Vector<i64>`.
- `impl CoordInit<Vector3<i64>, <i64>> for Vector3<i64>`.
- `impl CoordInit<Vector3<i64>, <i64>> for Point3<i64>`.
-  `impl` operator overloading functions for `Add`, `AddAssign`, `Sub`, `SubAssign`, `Mul`, `Div` and `Neg` for `i64`.

So that's:

|                                    | new primitive  |
|------------------------------------|-------------|
| Associated functions               | 36          |
| Methods                            | 15          |
| Operator overload func.            | 14          |
| Copy attributes                    | 0           |
| Default attributes                 | 0           |
| Display, Debug and PartialEq func. | 0          |

For a grand total of `55` methods & functions. And this is not counting the additional effort to properly test.

The approach I took was convenient enough to implement all the functionality quickly, but the solution could be better implemented by properly leveraging Rust's `generics`, `traits` and `trait bounds`.

Considering one of my primary [Goals] is to deliver _idiomatic_ and _ergonomic_ code, a refactoring over the implementation of the `Vector3` and `Point3` types is due.

Fortunately, it's going to be a minor refactor because the project is in its initial stage.

---


**_Links, references and disclaimers:_**

Header Photo by [Brecht Corbeel](https://unsplash.com/@brechtcorbeel) on [Unsplash](https://unsplash.com/)


[Rust API Guidelines]:https://rust-lang.github.io/api-guidelines/about.html
[GitHub repository]:https://github.com/rsdlt/ruxel
[Rust]:https://www.rust-lang.org
[Series Prelude]:https://rsdlt.github.io/posts/ruxel-ray-tracer-project-first-update-rust-programming-development/
[Goals]:https://rsdlt.github.io/posts/ruxel-ray-tracer-project-first-update-rust-programming-development/#goals-for-ruxel-version-010
[Ruxel Part 1]:https://rsdlt.github.io/posts/ruxel-part-1-rust-ray-tracer-renderer-3d-development/
[Alacritty]:https://alacritty.org/
[Tmux]:https://github.com/tmux/tmux
[Neovim]:https://neovim.io/
[Fish]:https://fishshell.com/
[Basic Operator Overloading with Traits]:/posts/welcome-blog-rust-technology-development-programming-language/
[Ruxel]:https://github.com/rsdlt/ruxel
