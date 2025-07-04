---
date: 2025-06-21
title: Rust's memory model is wrong
draft: false
categories:
  - Programming
  - Opinion
tags:
  - Rust
  - Go
  - Async Rust
  - Zig
  - Performance
  - Memory Management
  - Garbage Collection
  - GC
  - Tokio
description: &desc "I talk about my thoughts after a few years of experience using Rust"
summary: *desc
---

Rust famously avoids using a garbage collector with its borrow checker. But the borrow checker is not magic. Rust programmers must follow borrowing rules, understand move semantics, and hint the compiler with lifetimes. These abstractions make it so that you never think about `malloc` and `free`, don't have null pointer dereferences and memory safety issues in general, all without sacrificing performance by having a garbage collector running every now and then.

## Async Rust is a different language

The problem comes with async Rust. Tokio requires futures be `'static`, which basically means the future must be disconnected from the current stack frame. This makes sense because the async function can continue to run after the one who calls it has returned. This completely destroys lifetimes, because `'static` is the highest lifetime. You suddenly need to lift all your variables into the heap somewhere, usually in an `Arc`.

`Arc<T>` is short for Atomically Reference Counted and it's basically a `shared_ptr` from C++ but more thread safe. At runtime, the number of references currently being held to the data is tracked. When it is created, space is allocated on the heap for `T`, and the reference count is set to 1. When someone calls `.clone()`, the reference count is incremented atomically and the underlying data is not cloned. When the value is dropped the reference count is decremented, and if it reaches 0 it is deallocated.

Note that, in an `Arc<T>`, `T` is immutable. If you want multiple threads to share mutable state, you must use an `Arc<Mutex<T>>` or `Arc<RwLock<T>>` or similar. This helps to enforce thread safety, because mutable access must be guarded behind a synchronization primitive.

Let's take a look at some examples. The following will fail to compile:

```rs
#[tokio::main]
async fn main() {
    let a = 2;
    tokio::task::spawn(foo(&a));
}


async fn foo(a: &u32) {
    println!("a: {}", a);
}
```

```
error[E0597]: `a` does not live long enough
  --> src/main.rs:16:28
   |
15 |     let a = 2;
   |         - binding `a` declared here
16 |     tokio::task::spawn(foo(&a));
   |     -----------------------^^--
   |     |                      |
   |     |                      borrowed value does not live long enough
   |     argument requires that `a` is borrowed for `'static`
17 | }
   | - `a` dropped here while still borrowed

For more information about this error, try `rustc --explain E0597`.
```

This makes sense! `main` might return before `foo` returns, so the reference to the stack variable `a` might be pointing to garbage when `foo` is running. Let's fix this by moving it onto the heap:

```rs
#[tokio::main]
async fn main() {
    let a = std::sync::Arc::new(2);
    tokio::task::spawn(foo(a));
}


async fn foo(a: std::sync::Arc<u32>) {
    println!("a: {}", a);
}
```

```
a: 2
```

Now it works! Though we should probably use the `JoinHandle` to wait for the task to exit because right now it races to exit the process out of `main`. The Rust compiler cannot catch all bugs.

## Garbage Collectors

But hold on a second now. For almost all async code, we need to individually allocate our objects on the heap, and track the number of references to them. This is a just a reference counting garbage collector implemented in the standard library, instead of on the language level! Most garbage collectors don't use such a simple strategy because it is _very_ easy to create a memory leak with a circular reference. The onus is on the programmer to manage `Weak` references correctly, which is not trivial. This is why I think that Rust's memory model for async code is wrong. Garbage collectors are not evil, and not having them does not mean that your code is immediately blazingly fast. Instead, I think there is value in sophisticated GCs that have been optimized and tuned by experts.

I think a lot of people are afraid of GCs because it usually involves using an interpreted language like Python, Java, or JS which have other performance concerns, and happen to have a GC. I've come around to Go recently, because it runs native instructions, you can have references to values on the stack, and it has modern and reliable GC.

Go has had some bad PR with regard to its GC. In particular, [Discord's article on why they switched from Go to Rust](https://discord.com/blog/why-discord-is-switching-from-go-to-rust) caused quite a stir on HN. They published the following chart on their rewrite where you can see dramatic spikes, attributed to the GC. Go is purple, Rust is blue.

![Memory usage graph showing Go's spikiness overlayed with a stable line for Rust](https://cdn.prod.website-files.com/5f9072399b2640f14d6a2bf4/611ed6f4b2a3766fbb9964c1_1*-q1B4t622mnxoV8kvT9RwA.png)

I don't doubt the experience they had. But what I will say is that it is possible to write bad code in any language. When you do a rewrite into any language or even in the same language, you have so much more knowledge of the problem you are solving that it is bound to be better in many ways. Just because Go or JS have GCs, does not mean you should not be diligent with the way you use memory.

## Memory Management in Other Languages

Let's take a look at how a few other languages handle memory management.

### Go

In Go, there are `make()`, `append()` and `&` which allocate memory. With `&`, the compiler determines whether the value must be lifted to the heap (called escaping) or if it can stay on the stack, depending on how it is used. This is done automatically at compile time, and you can observe the behavior by compiling with `go build -m` or as annotations directly in your editor. (With VSCode, it is the command `Go: Toggle compiler optimization details`). Consider the following code:

```go
package main

type bar struct {
    a int
    b bool
    c string
}

func foo(myBar *bar) {
    myBar.a += 1
}

func main() {
    b := bar{
        a: 4,
        b: true,
        c: "super cool",
    }
    foo(&b)
}
```

```
<source>:9:10: myBar does not escape
```

In this case, Go found that it does not need to lift `b` because its lifetime never exceeds the scope of `main`. However, if we do something which would require a reference to `b` beyond the lifetime of `main`:

```go
package main

type bar struct {
    a int
    b bool
    c string
}

func foo(myBar *bar) {
    myBar.a += 1

    go func() { // <-- runs after function exits
        myBar.a += 1
    }()
}

func main() {
    b := bar{
        a: 4,
        b: true,
        c: "super cool",
    }
    foo(&b)
}
```

The compiler correctly realizes it must lift `b` to the heap!

```go
<source>:9:10: leaking param: myBar
<source>:12:8: func literal escapes to heap
<source>:18:5: moved to heap: b
```

And note that this does not incur a copy of the data of `b` from the stack to the heap sometime while it's running. From the beginning, creating `bar{}` allocates the data on the heap instead. This is kind of like if Rust automatically wrapped your variables in an `Arc` only if it needs to be, automatically (and without fear of a memory leak, thanks to the garbage collector). And this is distinct from other commonly known garbage collected languages like Python and JS where all objects are always heap allocated. Advanced runtimes like [V8](<https://en.wikipedia.org/wiki/V8_(JavaScript_engine)>) attempt similar optimizations to Go in their [JIT](https://en.wikipedia.org/wiki/Just-in-time_compilation), but this behavior is not guaranteed and cannot be relied on.

### Zig

In Zig, any function which needs to allocate memory that is not on the stack must be passed an `std.mem.Allocator` <a id="footnote-1-source" href="#footnote-1">¹</a>. Sometimes the container holds on to the allocator like the `std.array_list.ArrayList` but there is usually an alternative like `std.array_list.ArrayListUnmanaged` which requires that you pass the same allocator every time. This encourages less allocations, and it becomes more clear where the memory is located. You can reserve some space on the stack, make an allocator out of it, and pass that to the `ArrayList` so it doesn't use the heap. You can also derive allocators off of allocators. For example, this lets you clean everything up in one fell swoop with an arena, or have runtime checks to prevent double-free and use-after-free bugs, and detect leaks.

This opens up the doors to many kinds of interesting ideas. Consider writing a web framework. Our handlers will probably need an allocator to do something real, so we should supply one in the server context. We can derive an arena allocator per request and at the end of the response, deallocate everything they did so that our handlers can't have memory leaks. We can also reuse these allocators between requests to increase performance. This is described in more detail in [this excellent blog post](https://openmymind.net/Leveraging-Zigs-Allocators).

Zig's standard JSON type also uses an arena. It bundles together all the values (strings, numbers, etc) and metadata associated with a JSON object into one blob, making it more performant. This is explained in [another article](https://www.openmymind.net/Zigs-json-parseFromSlice) by the same author as above. Seriously [give all their posts a read, it's worth it](https://openmymind.net).

Explicitly passing an allocator also encodes semantic meaning, and not passing one also has meaning. The `sort` function in the standard library doesn't take an allocator, so you know it operates entirely in place. This style also allows you to be more conscious about the performance impact of calling particular functions.

In pretty much every other language, you have to guess where your memory ends up. In Rust, you have to learn that `Box`, `Arc`, `Rc`, `String`, `Vec`, and `HashSet` are some of the ways that new memory is allocated, and sometimes it is not very obvious.

Another advantage of unsafe memory management provided in languages like Zig is that let you arrange memory optimally and take advantage of the CPU cache. Languages that encourage [RAII](https://en.wikipedia.org/wiki/Resource_acquisition_is_initialization) patterns (like Rust) produce lots of individual allocations which fragment memory. You can use [SoA](https://en.wikipedia.org/wiki/AoS_and_SoA) patterns in Rust, but the ecosystem and the community is built around individual objects.

## Conclusion

I think that innovation in memory models can still happen. Languages like Zig aim to increase safety while keeping the ability to reach perfect performance. Languages like Rust aim to increase performance while keeping their safety. The borrow checker is a great experiment that has gone remarkably far, but it is has its limitations and is not the final evolution of memory management.

None of this is to say that I don't like Rust. I maintain various personal projects in Rust, and I intend to continue choosing it for future projects. To prove I'm still a part of the Rust Evangelism Strike Force here is a non exhaustive list of things I like about it:

- Ecosystem of crates
- Documentation comments
- Macros
- Type system
- Street cred/flexing potential

Also I don't think that Go and Zig are perfect either. For example in Go I don't like zero initialization of structs, I think default values should exist. I also think that optionals should be built in instead of using an extra pointer indirection and `nil` (see `json.Unmarshal` on an `*int`). In Zig, I don't like how there is no async, and I think that making a language server that can properly evaluate `comptime` expressions is going to be really hard and will likely never resolve `anytype`s correctly.

All this being said, I don't write code using data oriented design and trying to optimize for the CPU cache. I prefer to trade some performance for developer velocity. But I'm also not writing a database or a game engine, I'm usually writing a webserver or interacting with some API over HTTP.

Async Rust is in a weird place for me. It feels like I have to use the escape hatches and work against the borrow checker more often than I work with it. I think there are fundamental problems with the memory model, and sometimes I wish I just had a garbage collector.

---

<div id="footnote-1"></div>

¹ This is not technically true, a function could use `std.heap.page_allocator` or `std.heap.c_allocator`, but this is considered very bad practice and is not usually used in library code. <a href="#footnote-1-source">⎗</a>
