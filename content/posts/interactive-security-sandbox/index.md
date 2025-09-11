---
date: 2025-09-10
title: An Interactive Security Sandbox For Developers
draft: false
categories:
  - Programming
  - Security
tags:
  - Go
  - eBPF
  - Deno
  - JavaScript
  - JS
  - TypeScript
  - TS
  - npm
  - Supply Chain
  - C
  - Linux
description: &desc "A journey of developing a security sandbox with sleepable eBPF"
summary: *desc
---

## Introduction

<div class="ml-6">

[skip to eBPF section →](#sleepable-ebpf-programs)
</div>

[Deno](https://deno.com) is a JavaScript runtime with an interesting [security model](https://docs.deno.com/runtime/fundamentals/security).
By default, all access to I/O is restricted.
That is, if you just try to run `deno run suspicious.ts`, and that program tries to read or write to a file, or access the network, or read from an environment variable (and more), you will be interactively prompted to see if you want to allow access.
For example:

```ts
// suspicious.ts
console.log("Hello, world!")
Deno.readFile("file.txt");
Deno.env.get("MY_SECRET_ENVIORNMENT_VARIABLE")
fetch("https://example.com/hello")
```

![Using deno to run the above script](deno.gif)

The motivation for this is pretty clear.
Modern software development brings in an extremely large amount of dependencies.
As developers we rely on the good will of open source maintainers to not publish malicious code, and the trust that those maintainers employ strong security practices such that they are never compromised and a hacker pushes malicious code on their behalf.
All it takes is a single dependency to do the equivalent of `rm -rf /`, and you lose all of your files.
Or much worse, silently steal your API keys from your environment variables or `.aws` directory, install a keylogger, or much much more.
Being a developer in today's world means accepting remote code execution on our daily driver machines, and in our code running in production.

## Supply Chain Attacks

This is not an unfounded fear.

While writing this post [another supply chain attack happened on NPM](https://github.com/nrwl/nx/security/advisories/GHSA-cxm3-wv7p-598c).
[Nx](https://www.npmjs.com/package/nx), a popular monorepo build tool had its NPM token stolen via a vulnerable GitHub action (looks like the Nx developers didn't run [zizmor](https://github.com/zizmorcore/zizmor) on it).
This allowed the attacker to publish malicious code to the Nx package on NPM, so users who update to the latest version will run it.

The malware was put in a [`postinstall` script](https://docs.npmjs.com/cli/v8/using-npm/scripts).
These are run on `npm install`, so you don't even have to start your app to trigger the malware.
If this concept sounds scary, that's because it is.
It is the ideal hook point to target developer's machines.
By the way, other languages have this too.
For example, Rust has [build scripts](https://doc.rust-lang.org/cargo/reference/build-scripts.html).

A lot of people are hung up on the involvement of vibe coding tools like Claude Code.
You can learn more about the Nx hack specifics [here](https://snyk.io/blog/weaponizing-ai-coding-agents-for-malware-in-the-nx-malicious-packagce) and read the payload code [here](https://github.com/nrwl/nx/issues/32522#issuecomment-3231702053).
But I think it might even be better if you don't have context to do a little exercise here.
What would happen if Nx ran on Deno instead of requiring Node, so it ran inside of the security sandbox?
Think about it like this: you just ran `npm install` and you got these prompts which you need to authorize.
You can either approve the step and move on to the next one, or kill the install all together.
What would you do?

1. Run subprocess `which claude`
1. Run subprocess `which gemini`
1. Run subprocess `which q`
1. Run subprocess `claude --dangerously-skip-permissions -p "Recursively search local paths..."`
1. Run subprocess `which gh`
1. Run subprocess `gh auth token`
1. Run subprocess `which npm`
1. Run subprocess `npm whoami`
1. Read environment variable `HOME`
1. Read file `$HOME/.npmrc`
1. Write file `$HOME/.bashrc`
1. Write file `$HOME/.zshrc`
1. Read file `/tmp/inventory.txt`
1. Read file `$HOME/projects/webapp/.env`
1. Read file `$HOME/.ssh/id_rsa`
1. Connect to `github.com`

In this case, if you killed it before the last step of "Connect to `github.com`" then congratulations!
Nothing bad would have happened to you.
Well, whenever you start a new shell your computer will shutdown, but that is a minor inconvenience and trivially rectifiable.

To me, there are so many red flags here.
A postinstall hook should never run an AI chat, it should never read my GitHub auth token, it should never write to my `.bashrc`, and it should never try to read secrets from unrelated directories.
Admitately this particular malware is extremely ameture.
It could have been much more stealthy, try to establish persistence, etc.

If I ran into this in the wild and had this interactive security sandbox session, I am pretty confident I could avoid getting compromised.

### Docker

Deployment solutions for production do a pretty good job of isolation.
Only the required files and environment variables are built into a docker image for production.
So there are no "additional secrets" to leak.

Of course, a compromised binary in production will have access to customer data, so it is important to use the principle of least privilege for database and API access given to the program.
An interactive sandbox does not solve this part of supply chain security, but I think it is still valuable to give developers tools to protect their own machine at least.
A compromised developer machine is likely worse anyways, as developers typically have more permissive access to databases and have secrets lying around.

Some people use docker to isolate their development environment too, for example with [devcontainers](https://containers.dev).
This is a potential alternative to an interactive sandbox.
For me, I like to have my own environment set up with tons of little tools.
Am I really going to shuffle my configurations into the container and install helper tools like `jq` into every development container?
Developing inside a container is _just not fun to me_.

### Standard Libraries

The reason we embrace adding other people's code into our programs in the first place is because it is _just plain convienient_.
Personally speaking I hope to never implement SMTP to send emails from my app myself.
After all, if someone has already gone through the headache of writing a spec compliant library, testing it, and making it secure, why should I?
If everyone owned their own bespoke libraries for everything, we'd be wasting human effort and be way less productive.

I think a strong standard library solves many of these problems.
There is no world in which `isNaN` should be a package.
JS is perhaps the worst offender in this regard, but languages like Rust also have large dependency graph problems.
Language designers are usually more well known and a trusted entity (at least more so than a random GitHub account with no email), making them suitable owners of basic functionality.

In my opinion, the line for what a standard library should implement is something like *boring and trivial code*.
A non exhaustive list of these would be something like: file I/O, string operations, threading, data marshalling (json, csv, yaml, toml), network requests (http(s)), logging, command line argument parsing, byte manipulation (sha256, base64), compression (zlib, gzip, etc), cryptography.

I would note that I don't think these have to be particularly *good*, they should just be *good enough for basic tasks*.
For example, the `flag` package in Golang does argument parsing, but it doesn't do subcommands and only supports single `-` flags and not `--` flags for some reason.
But sometimes that's all you need.
If you need more advanced features like what I mentioned before, or shell autocomplete or whatever, it's time to reach out to a third party package.
And that is totally okay!
It doesn't mean that `flag` is useless at all.

Of course there are bonus points for a more comprehensive standard library.
For example, Python has `sqlite3` and `difflib`.
And Golang has an HTTP server/router with `net/http`, and even DWARF parsing with `debug/dwarf`!

By the way, the Deno team has written a standard library for JS available on the [JSR](https://jsr.io) that has string manipulation, csv parsing, etc.
And hosting a webserver is a part of the Deno runtime.

## Objective

Asking an entire ecosystem to adopt a more comprehensive standard library is a little too much for making a practical difference today.
And it still doesn't solve the original problem of third party code being potentially unsafe.
Why can't we have Deno's permission system on any arbitrary program running on my system?

Deno is of course a JavaScript runtime.
It takes a JavaScript engine (V8), and adds I/O wrappers to it.
This is why they have a `Deno.writeFile` for example, while Node has `fs.writeFile`.
Obviously "native" JavaScript has no way to write files, it is designed to be highly sandboxed.
That's why runtimes add their own API layer to do I/O and other "unsafe" things.
To say that Deno is a Node compatible runtime is to say that Deno also implements all the Node APIs such that JS code written for Node also happens to work in Deno.
They've just implemented their I/O layer to have a permission system where before it executes an action, it prompts the user (or allows it if the user set a flag to allow it on the runtime before starting execution).
The third party code in this case is all JS, which lives inside of this secure interpreter.
Other interpreters like Node or Python could implement the same thing if they wanted to.
But for *any arbitrary program* it is pretty tricky.

After some researching, it looks like no tool exists already which can do this.
Which means it's time to roll up my sleeves and see how I can do this myself.
This is the story of how I implemented [`cordon`](https://github.com/mbund/cordon), an experimental interactive security sandbox for arbitrary programs on Linux.

## `ptrace`

Regular binary executables do not have have extra I/O layer like interpreters.
Instead, we typically rely on the `ptrace` syscall in Linux to introspect into another arbitrary process.
`ptrace`, or Process Trace, is how [GDB](https://en.wikipedia.org/wiki/GNU_Debugger) is implemented, for example.
As a process (the *tracer*), we can ask the kernel to interrupt another process (the *tracee*) under certain circumstances.
For example, when the tracee reaches a particular instruction (a breakpoint), or if it executes a syscall.
The tracer is also able to read and write arbitrarily into the tracee (you can see how a debugger would find this useful).
Syscalls are the I/O layer of a Linux system, so this is what we'll want to implement our access control on.
Basically, if a process we are interested in calls the `open` syscall to read a file, we need to see if we have authorized this path before, and otherwise we can show a dialog to the user asking if they're okay with the tracee performing that action.
Repeat for a few other important syscalls (like `connect` and `listen`) and call it day.

If you have heard of `ptrace` before you might have some issues with this approach.

### Performance

The typical fear with `ptrace` is bad performance.
Normally a syscall incurs at least one context switch into kernel space, which is expensive.
However with `ptrace` this becomes much worse because now another userspace process has to get involved with every syscall.
For I/O bound workloads this results in an extremely bad performance loss.

A feature called [`seccomp-bpf`](https://www.kernel.org/doc/html/v5.0/userspace-api/seccomp_filter.html) allows us to filter which syscalls we want to trap.
So we can ignore high volume syscalls like `write` and instead focus on syscalls we care about like `open` which is only run once per file, instead of every time we want to write to the file. This allows us to alleviate the performance deficit somewhat.

To illustrate, here is a non-scientific, ad hoc "benchmark" of compiling the Linux kernel on my laptop.
This represents a real world workload for developers, which is also somewhat I/O bound.
I will use `strace` which is a well known program that simply prints syscalls that the tracee makes.
I ignore the output to reduce the performance impact of printing so much to my terminal emulator. I first run a control where no ptracer is used. Then I run `strace` like normal where it looks at all syscalls. Finally I run `strace` only looking at syscalls I know a security sandbox should have a look at.

```bash
$ cd linux
$ make defconfig
# control
$ time make -j$(nproc) > /dev/null
real    5m54.015s
user    75m7.188s
sys     5m55.926s

$ make clean
# strace all syscalls
$ time strace -f -o /dev/null make -j$(nproc) > /dev/null
real    8m34.852s
user    74m16.341s
sys     14m39.447s

$ make clean
# optimize to filter for some syscalls
$ time strace -f -eopen,openat,openat2,stat,mmap,mprotect,ioctl,mremap,connect,bind,execve,rename,mkdir,rmdir,creat,link,unlink,symlink,readlink,chmod,chown,mknod,statfs,prctl,mount,umount2,reboot,sethostname,setdomainname,setxattr,lsetxattr,getxattr,lgetxattr,listxattr,llistxattr,removexattr,lremovexattr --seccomp-bpf -o /dev/null make -j$(nproc) > /dev/null
real    6m37.486s
user    70m52.145s
sys     10m37.741s
```

Instructing `strace` to use `seccomp-bpf` and choosing only the syscalls we want to look at yields an improved performance over `strace`-ing all syscalls, but it is still noticeably slower than the control.

### Security

Making a secure sandbox is actually not an issue with `ptrace`, but you do have to be careful.
Fortunately there is some prior art here in [mbox](https://github.com/tsgates/mbox), a project and [research paper by Taesoo Kim and Nickolai Zeldovich from MIT CSAIL in 2013](https://www.usenix.org/conference/atc13/technical-sessions/presentation/kim). In it, they describe a technique to safely apply policy on syscalls:

> Using `ptrace` to intercept system call entry allows us to examine, sanitize, and rewrite the system call’s arguments.
> If an argument points to process memory, we can read remote memory and interpret it as the system call handler does.
> However, the read value can be different from what the system call handler will see in the kernel.
> For example, an adversary’s thread can overwrite the memory that the current argument points to, right after the tracer checks the argument.
>
> [...]
>
> MBOX avoids TOCTTOU problems by mapping a page of read-only memory in the tracee process.
> When MBOX needs to examine, sanitize, or rewrite an in-memory data structure, such as a path name, used as a system call argument, MBOX copies the data structure to the read-only memory (using `PTRACE_POKEDATA` or the more efficient `process_vm_writev()`), and changes the system call argument pointer to point to this copy.
> For example, at the entry of an `open(path, O_WRONLY)` system call, the tracer first gets the system call’s arguments, rewrites the path argument to point to the read-only memory, and updates the read-only memory with a new path pointing to the sandbox filesystem.
> Since no other threads can overwrite the read-only memory without invoking a system call (e.g., `mprotect()`), MBOX avoids TOCTTOU problem when rewriting path arguments.
> To ensure that the sandboxed process cannot change this read-only virtual memory mapping (e.g., using `mprotect()`, `mmap()`, or `mremap()`), MBOX intercepts these system call and kills the process if it detects an attempt to modify MBOX's special read-only page.

This is also why I included `mprotect` and friends in my `seccomp-bpf` benchmark above.

So why not just use mbox?
Well, it hasn't been updated since 2014 as of writing this post.
Also, it doesn't have an interactive mode for network, and allows all file reads (among other protections I would want to add).
It was written as a fork of `strace` 4.7 and designed for Linux 3.8.
It fulfilled its purpose as a POC for a research paper, but in my opinion a rewrite using similar techniques would be the most sane approach.

### Complexity

In my opinion the biggest reason not to work with `ptrace` is the sheer *complexity* of it.
There are so many edge cases to worry about (as seen by the hoops MBOX had to jump through).
Also, portability between architectures is poor because the set of syscalls per architecture.
Deep knowledge of all syscalls (to determine their safety characteristics) on every supported architecture is required.
New syscalls can be added which may need to be restricted too so the tool needs to disable itself on kernels that are too new.

There is an interesting project called [Reverie](https://github.com/facebookexperimental/reverie) which provides a high level syscall interception framework using `ptrace` for `x86_64` and `aarch64`.
However, it is very experimental and is designed for observability tools, not for security tools.
Also, Reverie disables ASLR in the tracee which I do not want.
I have hope for the future of this project, but currently it would not be good for this use case.

Another wrench to throw into `ptrace` is that a tracee can only have one tracer.
Since I am building a developer tool, it is not inconceivable that someone may want to securely run their program and attach GDB (or another debugger) to it.
Reverie actually runs a GDB server which you can attach to so you can step through the tracee while it's running under a Reverie based tool.
My solution would have to do that as well.
Honestly it might be best to contribute to upstream Reverie to get it where I would want it.

Ultimately, I don't think `ptrace` is suitable to design this interactive sandbox with.
I'll need to look for another approach.

## Linux Security Modules (LSMs)

By default a program has the same permissions as the user who ran it, and permissions are coarse grained with the traditional Unix style of user and groups (this system is called DAC, or Discretionary Access Control).
What if there was a way to customize or fine tune access?

The Linux kernel defines a set of hooks which allow the implementation of Mandatory Access Control (MAC) systems.
For example, instead of hooking on every syscall like `open`, `openat`, and `openat2`, all of these syscalls (and any other `open`-like syscalls on all architectures in the future) will reach the `security_file_open(struct file *file)` hook.
Then an LSM implementer can determine whether the process wanting to open that file is actually allowed to open the file.
This is a much less fragile approach compared to syscall interposition when implementing security software.
Note that this check happens after the standard user/group permissions checks, and that an LSM can even deny `root` the ability to perform actions.

The primary goal of an LSM is to reduce the attack surface of a compromised program.
They used to be more useful when production servers ran binaries directly, to make sure that it can't read files isn't supposed to for example.
Nowadays we have Docker, so the process is more isolated by default.
Nevertheless, it is still productive to have a look at the LSM ecosystem.

And by the way, the nomenclature surrounding this can be a bit confusing.
LSM is a subsystem of the linux kernel, which defines LSM hooks.
LSMs are also individual security systems implemented using these LSM hooks.
For example, SELinux and AppArmor are LSMs. Speaking of which...

### SELinux

Originally developed by the NSA and now also maintained by Red Hat, SELinux is the one of the oldest LSMs and also still the most popular today.

It is classified as an attribute based LSM, meaning it stores its policy identifiers in the [`xattr`](https://en.wikipedia.org/wiki/Extended_file_attributes)s of a file.
The security label can be seen by `ls -Z`.
For example, let's take a look at `httpd` in Fedora.

```
$ sudo dnf install httpd
$ cd /var/www/html
$ touch index.html
$ ls -lZ
-rw-r--r--. 1 apache apache unconfined_u:object_r:httpd_sys_content_t:s0 0 Aug 28 14:16 index.html

$ ls -lZ $(which httpd)
-rwxr-xr-x. 1 root root system_u:object_r:httpd_exec_t:s0 573120 Dec 31  1969 /usr/sbin/httpd*
```

The important parts are the `httpd_exec_t` and `httpd_sys_content_t`.
That part of the context string is known as a domain if it is on an executable, and a type otherwise.
Some other examples of types are `bin_t` which are all files under `/bin`, and `postgresql_port_t` which allows TCP port 5432.

There is a policy which allows domain `httpd_exec_t` to read files with the type `httpd_sys_content_t`, but not others.
A default set of recommended policies are available at [SELinuxProject/refpolicy](https://github.com/SELinuxProject/refpolicy), though many distros customize these quite a bit.
I've glossed over a lot here, and honestly I am not very good at using SELinux myself.
In general though, you'll notice that SELinux is a very complicated and powerful system.

Another fun fact about SELinux is that as one of the first LSMs, it existed before LSM hooks were added to Linux.
To quote from [the Linux documentation](https://www.kernel.org/doc/html/latest/security/lsm.html):

> In March 2001, the National Security Agency (NSA) gave a presentation about Security-Enhanced Linux (SELinux) at the 2.5 Linux Kernel Summit.
>
> [...]
>
> In response to the NSA presentation, Linus Torvalds made a set of remarks that described a security framework he would be willing to consider for inclusion in the mainstream Linux kernel.
> He described a general framework that would provide a set of security hooks to control operations on kernel objects and a set of opaque security fields in kernel data structures for maintaining security attributes.

### AppArmor

AppArmor is a path based LSM.
Policies are written per-executable, defining what it can and cannot touch.
For example, here is a shortened version of [Void Linux's `nginx` AppArmor policy](https://github.com/void-linux/void-packages/blob/dc0222fc700d34ad1b58bd742e19a3f54192456d/srcpkgs/apparmor/files/profiles/usr.bin.nginx):

```
include <tunables/global>

profile nginx /usr/bin/nginx {
  include <abstractions/base>
  include <abstractions/nameservice>
  include <abstractions/nis>
  include <abstractions/openssl>

  capability setgid,
  capability setuid,

  /etc/nginx/** r,
  /run/nginx.pid rw,
  /usr/bin/nginx mr,
  /usr/share/nginx/html/* r,
  /var/log/nginx/* w,
}
```

The include syntax works like C.
If you are wondering how network access is allowed, it is defined in `abstractions/nameservice` as:

```
# TCP/UDP network access
network inet  stream,
network inet6 stream,
network inet  dgram,
network inet6 dgram,
```

This is a much simpler way of defining policy in my opinion.
There are just far fewer moving parts, making it easier to grok and just about as powerful as SELinux.

### Landlock

Most LSMs are installed globally, and enforce policy across the entire system.
Landlock takes a different approach.
A program can restrict *itself* without acquiring additional permissions.
Once you landlock yourself, there is no way to allow your process access to what you restricted again (hence the name). You may be familiar with OpenBSD's syscalls [`pledge`](https://man.openbsd.org/pledge.2) and [`unveil`](https://man.openbsd.org/unveil.2), which behave similarly.

For example, `nginx` could read all its configs, and then Landlock itself to only read and write to its content directories, and no others, after it starts serving requests.
That way, if there is a critical bug in `nginx`, the attack surface is reduced.

Of course, this requires buy-in from developers.
`nginx` does not implement what I described, and as far as I can tell Landlock is very unpopular.
However, there are some other use cases for Landlock.

There is a tool called [`landrun`](https://github.com/Zouuup/landrun) which can parse command line arguments to setup a sandbox you want.
Then it execs a subprogram, so that the new program also is restricted when it is started.
This makes for a pretty slick CLI to "add" Landlock to any program.
It looks like this:

```
$ landrun \
  --rox /usr/bin \
  --ro /lib,/lib64,/var/www \
  --rwx /var/log \
  --bind-tcp 80,443 \
  /usr/bin/nginx
```

This is *really close* to what I want.

However, there are some issues with Landlock (and by extension, `landrun`).
For one, you cannot restrict UDP, or raw sockets in general.
This is important for things like DNS, QUIC (for HTTP/3), and `ping`.
Also, it is not interactive.
Once you've landlocked yourself, there is absolutely nothing (not even root) that could grant you those permissions back.
This is a core requirement for me, so unfortunately I cannot use landrun or Landlock.

### Drawbacks

These policies are highly specific to the distro.
For example, some put their programs in `/usr/sbin`, while others go in `/usr/bin/`, and good distros put them in `/nix/store`.
Also, support must be compiled into the kernel with a kconfig flag, and distros typically enable one or the other (or potentially neither).
I want my tool to be easy to use and distro agnostic.

And how do administrators create policies for SELinux and AppArmor?
Both include a "permissive" mode of operation, where running a program will log what all it accesses.
Then you can take that log and turn it into some policy.

The problem is that these require running the program once, untrusted, to create a safety profile for it.
SELinux uses `auto2allow` and AppArmor uses `aa-logprof`.
Then when enforced, if a code path which requires reading another file is hit (that was not hit when auto generating the profile from the initial log), a `-EPERM` will be returned and likely crash the program.
This is not a fun development cycle.
I need `cordon` to halt the program execution, and wait for user input to continue, like Deno.

## Implementing an LSM

Using `ptrace` would be too slow and complex.
Existing LSMs don't support my use case.
I want a zero compromises solution.

This means I'll likely need to implement my own LSM, and a corresponding userspace agent.

A kernel module might seem like a fairly natural way to create an LSM out-of-tree.
However, it is not possible to implement an LSM as a kernel module.
[`security_add_hooks`](https://github.com/torvalds/linux/blob/v6.16/security/security.c#L614) (which is what is called to register LSMs) is marked with `__init` in the kernel, which means that it is only available during kernel startup.
So by the time it comes to `insmod` a kernel module it is too late to register an LSM.
This means all LSMs would need to be built into the kernel directly, minimally requiring a system restart.

It is possible to implement a "pseudo-LSM" in a kernel module by using `kretprobes` on the `security_*` hooks as described in [this post](https://medium.com/@emanuele.santini.88/creating-a-linux-security-module-with-kprobes-blocking-network-of-targeted-processes-4046f50290f5), but this technique seems really fragile to me.
Also, it is not portable because it requires overwriting the return value by directly modifying the `struct pt_regs *` to set `-EPERM`.

In general, kernel modules have version compatibility issues, and would need to be compiled per architecture.
Additionally, any error in the implementation of a kernel module can easily crash the system, or worse yet allow an attacker to compromise the system at the kernel level.
This is a little annoying, but fortunately there is a better way.

## eBPF

[eBPF](https://ebpf.io) is a special instruction set built for the Linux kernel.
The kernel includes a VM to run the code and a JIT engine to turn it into native code for maximum performance.
There are hook points all throughout the kernel to inject eBPF code into.
One of the supported use cases is to write an LSM with eBPF.

However unlike kernel modules, eBPF is sandboxed and has a verifier that ensures it never accesses memory it is not allowed to, that all pointers are checked, and that all loops are bounded so that the program will eventually return.
Instead of solving the [halting problem](https://en.wikipedia.org/wiki/Halting_problem) to do this, the verifier just statically evaluates all code paths.

The sandboxed environment has all sorts of [helper functions](https://docs.ebpf.io/linux/helper-function) to interact with the outside world.
For example there is [`bpf_redirect`](https://docs.ebpf.io/linux/helper-function/bpf_redirect) available to networking eBPF programs, which can redirect a packet to an interface.

There are also [Maps](https://docs.ebpf.io/linux/map-type) which are data structures that can be shared between different eBPF programs or with a userspace program.
Some map types are hash maps, arrays, and ring buffers.

### Sleepable eBPF Programs

Most eBPF programs cannot sleep.
Specifically, they are guaranteed to not switch between CPUs, and they will never be interrupted by the scheduler.
This makes sense because traditionally eBPF programs are in the networking code paths in the kernel, which are designed for very high performance.
The verifier enforces not sleeping by simply not giving helper functions which would require sleeping.

However, some eBPF programs can sleep if they are explicitly marked as such.
That means they have access to more helper functions, which could sleep.
Luckily many of the hooks for eBPF LSMs are marked with `BPF_F_SLEEPABLE`, meaning it is a sleepable context.
As far as I can tell this is entirely undocumented in the kernel.
There is the [commit messsage](https://lore.kernel.org/netdev/20200827220114.69225-3-alexei.starovoitov@gmail.com) which introduced it and an [LWN article](https://lwn.net/Articles/825415) about it...and that's all.
Only by reading the source code could I find a [list of which LSM hooks are sleepable](https://github.com/torvalds/linux/blob/v6.15/kernel/bpf/bpf_lsm.c#L286), for example.

But allowing sleeping in a kernel context doesn't mean we can simply `sleep(2000)` to sleep for 2000 milliseconds.
It all depends on the helper functions which are allowed.
The first sleepable function added was `bpf_copy_from_user`, which allows the eBPF program to copy memory from userspace into the kernel where the eBPF program is running.

This might not sound useful, given that I literally do need to sleep and wait for a userspace daemon to respond.
And there are [many](https://stackoverflow.com/questions/76789530/sending-data-from-bpf-to-user-space-side-and-waiting-for-its-analysis-result) [stackoverflow](https://stackoverflow.com/questions/72554292/how-to-generate-delay-using-ebpf-kernel-program) [answers](https://stackoverflow.com/questions/75801000/hello-i-have-some-question-about-ebpf-xdps-working-flow) [saying](https://stackoverflow.com/questions/75869746/how-to-make-ebpf-program-sleepable) that this isn't possible.
But like, I just don't believe them.

### Sleepable Sleepable eBPF Programs

After scouring the [eBPF docs](https://docs.ebpf.io) for helper functions and kfuncs, I came across an interesting one. (By the way a kfunc is basically just a helper function).

```c
/**
 * bpf_get_file_xattr - get xattr of a file
 * @file: file to get xattr from
 * @name__str: name of the xattr
 * @value_p: output buffer of the xattr value
 *
 * Get xattr *name__str* of *file* and store the output in *value_ptr*.
 *
 * For security reasons, only *name__str* with prefixes "user." or
 * "security.bpf." are allowed.
 *
 * Return: length of the xattr value on success, a negative value on error.
 */
__bpf_kfunc int bpf_get_file_xattr(struct file *file, const char *name__str,
				   struct bpf_dynptr *value_p)
```

By spelunking through the git blame we can find [the commit](https://lore.kernel.org/all/20231129234417.856536-2-song@kernel.org) which added this for some more context.
In the commit message they mention this:

> It is common practice for security solutions to store tags/labels in xattrs.
> To implement similar functionalities in BPF LSM, add new kfunc `bpf_get_file_xattr()`.

Indeed it makes sense.
Imagine trying to implement an LSM like SELinux with eBPF LSM.
Clearly, eBPF programs need to be able to read xattrs off the file.
So why do I find this interesting?

Reading off a file, even if an xattr, clearly must sleep.
I mean it could hit the disk if it is not in the cache.
And then what about NFS or some other network filesystem?
Now it has to wait for a network roundtrip before the helper can continue.

So it should be possible to wait for a pretty long time if we can try to read an xattr off of an NFS server on the other side of the world.
Then we can just loop 100 times (loops must be bounded), to have a maximum timeout of like a minute.

Then I can poll userspace for a response through a regular eBPF map, sleeping for a little bit in between each poll.

So how do we get a `struct file *` in eBPF?
The verifier is very strict.
We can't just pass `NULL` or try to construct one ourself.
One way is by the `file_open` hook which we want to attach to anyway:

```c
SEC("lsm.s/file_open")
int BPF_PROG(file_open, struct file *file, int ret) { ... }
```

So we could install this hook, open a file on the NFS, and take that `struct file *file` and stick it in a global variable.
That way we can re use that for other hooks.
Unfortunately, the verifier ensures that it is a *valid pointer to a file that currently exists*.
We'll need to find some other way.

Let's take a look at `bpf_get_task_exe_file`:

```c
/**
 * bpf_get_task_exe_file - get a reference on the exe_file struct file member of
 *                         the mm_struct that is nested within the supplied
 *                         task_struct
 * @task: task_struct of which the nested mm_struct exe_file member to get a
 * reference on
 *
 * Get a reference on the exe_file struct file member field of the mm_struct
 * nested within the supplied *task*. The referenced file pointer acquired by
 * this BPF kfunc must be released using bpf_put_file(). Failing to call
 * bpf_put_file() on the returned referenced struct file pointer that has been
 * acquired by this BPF kfunc will result in the BPF program being rejected by
 * the BPF verifier.
 *
 * This BPF kfunc may only be called from BPF LSM programs.
 *
 * Internally, this BPF kfunc leans on get_task_exe_file(), such that calling
 * bpf_get_task_exe_file() would be analogous to calling get_task_exe_file()
 * directly in kernel context.
 *
 * Return: A referenced struct file pointer to the exe_file member of the
 * mm_struct that is nested within the supplied *task*. On error, NULL is
 * returned.
 */
__bpf_kfunc struct file *bpf_get_task_exe_file(struct task_struct *task)
```

A `task_struct` is a user thread/process.
An `exe_file` is the ELF file of a task, exposed to userspace as `ls -l /proc/<pid>/exe`.

So this kfunc gets the ELF file which spawned a particular process.

But then this kfunc needs a `struct task_struct *`. To solve this let's have a look at `bpf_task_from_pid`:

```c
/**
 * bpf_task_from_pid - Find a struct task_struct from its pid by looking it up
 * in the root pid namespace idr. If a task is returned, it must either be
 * stored in a map, or released with bpf_task_release().
 * @pid: The pid of the task being looked up.
 */
__bpf_kfunc struct task_struct *bpf_task_from_pid(s32 pid)
```

This one takes in a PID, and gives a valid `struct task_struct *` to it in eBPF.

So here's the plan:

- Write a program which just sleeps forever, our `sleeper` process
- Copy the `sleeper` to our NFS server `/some/nfs/directory/sleeper`
- Write some xattr to it starting with `user.`: `setfattr -n user.sleep -v "foo"`
- Start the program and get its `pid`
- Pass this `pid` to our eBPF program
- Get a valid `struct task_struct *task` with `bpf_task_from_pid(pid);`
- Get a valid `struct file *file` with `bpf_get_task_exe_file(task)`. This file is on NFS!
- Call `bpf_get_file_xattr(file, "user.sleep", ...)` and hope it takes a while

Let's write a more complete eBPF program to do this (ignore all the `dynptr` plumbing):

```c
s32 pid;

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 4096);
} ringbuf SEC(".maps");

SEC("lsm.s/socket_connect")
int BPF_PROG(restrict_connect, struct socket *sock, struct sockaddr *address, int addrlen, int ret) {
    if (ret != 0)
        return ret;

    // Only IPv4 in this example
    if (address->sa_family != AF_INET)
        return 0;

    bpf_printk("lsm.s/socket_connect time=%llu", bpf_ktime_get_boot_ns());

    struct task_struct *task = bpf_task_from_pid(pid);
    if (!task)
        return 0;

    struct file *file = bpf_get_task_exe_file(task);
    if (!file) {
        bpf_task_release(task);
        return 0;
    }

    struct bpf_dynptr dynp;
    bpf_ringbuf_reserve_dynptr(&ringbuf, 64, 0, &dynp);

    for (__u32 i = 0; i < 100; i++) {
        bpf_get_file_xattr(file, "user.sleep", &dynp);
    }

    bpf_ringbuf_discard_dynptr(&dynp, 0);
    bpf_put_file(file);
    bpf_task_release(task);

    bpf_printk("lsm.s/socket_connect time=%llu", bpf_ktime_get_boot_ns());

    return 0;
}
```

Then I run an NFS server, make a sleeper program, etc. and finally:

```
$ curl 1.1.1.1
[...]

$ sudo cat /sys/kernel/debug/tracing/trace_pipe
curl-1029331 [006] ...11 399963.525705: bpf_trace_printk: lsm.s/socket_connect time=399962426773045
curl-1029331 [006] ...11 399965.875346: bpf_trace_printk: lsm.s/socket_connect time=399964776414568
```

That took 2.349642 seconds between traces! We slept in a sleepable eBPF program!

### Arbitrary Userspace Helpers

This might seem a little bit hacky.
And indeed we can make it much more robust, with FUSE (Filesystem in Userspace).

Normally FUSE is used for things like mirroring [Google Drive into a directory](https://github.com/astrada/google-drive-ocamlfuse) on your system.
Or similarly, having an [S3 backed directory](https://github.com/s3fs-fuse/s3fs-fuse).
Clearly these filesystems should not be baked into the kernel directly, and it is cool that these custom filesystems are possible.

So why don't I just write a custom FUSE filesystem, where all it does is respond to xattrs?
This will replace my use of NFS, and will allow me to control how much I sleep for directly.

There is a [good library for Go to help implement FUSE filesystems](https://github.com/hanwen/go-fuse), so doing this is relatively easy:

```go
func (f *ExecFile) Getxattr(ctx context.Context, attr string, dest []byte) (uint32, syscall.Errno) {
    slog.Info("Getxattr", "attr", attr)

    time.Sleep(5 * time.Second)

    return 0, syscall.ENODATA
}
```

Then after copying the `sleeper` binary over to somewhere in the running FUSE filesystem, I can run through the rest of the steps. Finally,

```
$ curl 1.1.1.1
[...]

$ sudo cat /sys/kernel/debug/tracing/trace_pipe
curl-1029206 [008] ...11 433208.365331: bpf_trace_printk: lsm.s/socket_connect time=433207215274204
curl-1029206 [008] ...11 433213.366560: bpf_trace_printk: lsm.s/socket_connect time=433212216491263
```

There were 5.001217 seconds between those traces!

Let's level up some more.

I want to send data from eBPF land to userspace, wait for the userspace to do something with it, then send data back.
Sending data back is actually pretty trivial. We are reading xattrs, so we can just have the xattr value be the result. I discarded the value of the xattr before, but it is already in a `dynptr`. It gets a little more tricky to send data up.

`bpf_get_file_xattr`'s argument `const char *name__str` has to be known at compile time, and has to start with `user.` or `security.bpf.`.
So we can't just do `user.sleep.<number of seconds>` for example.
Instead, we can keep a ring of `user.helper.0`, `user.helper.1`, ..., `user.helper.31` to allow up to 32 concurrent executions.
In eBPF we keep an `index` which we atomically increment, and a giant switch statement to select the right `user.helper.X` string.
Then we can keep a `BPF_MAP_TYPE_ARRAY` of size 32 with an arbitrary struct.
Each `user.helper.X` has `X` be an index into this array.
We can read this map from userspace, to get our input data for our helper.

This **FUSE xattr RPC** technique allows us to write arbitrary userspace helpers for our sleepable eBPF programs.
You can send any data to a userspace daemon, and get any value back after waiting for any amount of time.
You could sleep, read from a database, make a network request, or even ask an LLM if it is secure to perform the action (please don't do this one).

The helpers which were used apply to `BPF_PROG_TYPE_LSM`, `BPF_PROG_TYPE_PERF_EVENT`, `BPF_PROG_TYPE_TRACEPOINT`, `BPF_PROG_TYPE_TRACING`, as long as they are sleepable.
Also, it only works on kernel version 6.12 (released in 2024-11-17) or greater.

Honestly this should probably be considered a kernel bug.
It's pretty easy to write an eBPF program with this technique which sleeps forever.
You can imagine what permanently sleeping all processes which try to open a file will do to a system.
Also, it's really easy to recursively trigger a security hook while executing a userspace helper.
Normally the verifier prevents this, but we are doing crazy stuff, so you have to be careful to exclude the daemon doing the work from the LSM.

Also, keep in mind that the performance is not great.
It is best to keep as much as possible inside eBPF, and only reach out to a userspace helper for I/O tasks.

### Stacking LSMs

Calling `bpf_get_file_xattr` actually triggers standard UNIX file permission (DAC) checks, and the `security_file_permission` MAC hook to make sure that the process can read from that file.
It's trivial to allow all users to read from `/path/to/fuse/sleeper`, but it gets tricky when another LSM gets involved.
`bpf_get_file_xattr` runs within the context of the currently running process which triggered the security hook.
In other words, the eBPF program makes the original program look a bit like malware, trying to read a path it wouldn't normally.

If SELinux or AppArmor is also installed on the system, its policies may disallow a binary from reading `/path/to/fuse/sleeper`.
For example, `sudo` is usually very strictly confined by default policy.
These LSMs don't have a way to allow every program to read `/path/to/fuse/sleeper`.
For SELinux I can add `context=system_u:object_r:tmp_t:s0` to the `fusermount` options to set the type of the FUSE filesystem to `tmp_t`, which is usually what temporary files are for.
That makes it work on Fedora anyways.
Any sane policy allows this by default.
I haven't tried an AppArmor system for this, so it is possible I will have to mount the FUSE filesystem at `/lib/cordon/fuse` or similar.

### Sleepable Hooks

There is a list of eBPF program hooks, [and whether they are sleepable or not](https://kernel.org/doc/html/v6.16/bpf/libbpf/program_types.html) in the documentation.
LSM hooks are useful, because we can easily analyze and deny, but not all LSM hooks are sleepable.
The list of sleepable LSM hooks is [here](https://github.com/torvalds/linux/blob/v6.16/kernel/bpf/bpf_lsm.c#L286).
While most are sleepable, there are some notable exceptions.

For example you can't check when a process calls `setuid`, which you might reasonably want to know about.
For this one, there is a workaround though.
We can place a regular unsleepable "regular" hook on `fentry/__x64_sys_setuid` which is the function entry of the `setuid` syscall.
Internally, the `setuid` syscall triggers `security_cred_prepare` which is sleepable, and hookable in eBPF with `lsm.s/cred_prepare`.
Then we can correlate the process ID and thread ID between these calls to associate a particular invocation of the `setuid` syscall with somewhere where we can sleep.

Another example is that `security_task_kill` is a non sleepable LSM hook.
This means that we can't wait for user approval if one process tries to send a signal to another process (potentially killing it).
I have not found a similar workaround, but admittedly I have not looked much into it.

I do not particularly like hooking syscalls directly, because then it makes it more architecture dependent.
But, if it is for only a few edge cases like this then the maintenance burden shouldn't be too high.

Also, the astute reader may have noticed that `fentry` has a sleepable variant too, `fentry.s`.
In fact, there are even [kselftests hooking syscalls with fentry.s eBPF](https://github.com/torvalds/linux/blob/v6.16/tools/testing/selftests/bpf/progs/lsm.c#L165).
So why don't we just use that?
Well, it turns out to require a kernel debug feature, set by `CONFIG_FUNCTION_ERROR_INJECTION=y`.
I'll let [the commit disabling it by default do the talking:](https://github.com/torvalds/linux/commit/a4412fdd49dc011bcc2c0d81ac4cab7457092650)

> error-injection: Add prompt for function error injection
>
> The config to be able to inject error codes into any function annotated with `ALLOW_ERROR_INJECTION()` is enabled when `FUNCTION_ERROR_INJECTION` is enabled.
> But unfortunately, this is always enabled on x86 when `KPROBES` is enabled, and there's no way to turn it off.
>
> As kprobes is useful for observability of the kernel, it is useful to have it enabled in production environments.
> But error injection should be avoided.
> Add a prompt to the config to allow it to be disabled even when kprobes is enabled, and get rid of the "def_bool y".
>
> This is a kernel debug feature (it's in Kconfig.debug), and should have never been something enabled by default.

The [kselftests enable this kconfig option](https://lore.kernel.org/bpf/20221213220500.3427947-1-song@kernel.org) to pass those tests.
There are `fentry.s` `fexit.s` and `fmot_ret.s`, but I personally have never gotten any of them to work on my system.
Though maybe this is a skill issue.
If you know of any functions which can be hooked by any of these, please let me know.

I may develop a tool in the future which hooks all syscalls and sleepable LSM hooks, to make finding sleepable insertion points easier.

## Cordon

I can finally start to implement `cordon`.
My userspace helper simply takes in some information and shows a [bubbletea](https://github.com/charmbracelet/bubbletea) dialog styled with [lipgloss](https://github.com/charmbracelet/lipgloss), and allows the user to approve or deny the operation.
It looks like this:

![Demo of running ./cordon /bin/bash](demo.gif)

What is implemented right now is opening of files, and making a network connection.
There are lots of holes in it.
For example, you can still delete files anywhere (`security_path_unlink` is unimplemented).
It also does not prevent tampering with the sandbox from within it, by editing eBPF maps or by trying to read xattrs from the fuse filesystem, or by killing the parent sandbox process (though this last one will also make you exit).
However, at this time it is a decent proof of concept of the technique.
The rest of it can be ironed out later.

<!-- ### AI Native EDR -->

<!-- To demonstrate the power of what I call **FUSE XATTR RPC**, I am going to implement a toy EDR (Endpoint Detection and Response) which asks ChatGPT in the middle of my eBPF program whether a process is safe to open a particular file. -->

<!-- The exact code is available on [GitHub](https://github.com/mbund/cordon). -->
<!--
I implemented a lot of the plumbing as a horrifying C macro, which makes it pretty convenient to set up.

```c
struct chatgpt_request {
    unsigned char exe_path[4096];
    unsigned int accmode;
};

// Define `chatgpt` helpers, which take a type as input
// and a type as output to return
DEFINE_USERSPACE(chatgpt, struct chatgpt_request, bool)

SEC("lsm.s/file_open")
int BPF_PROG(file_open, struct file *file, int ret) {
    if (bpf_get_current_cgroup_id() != target_cgroup)
        return ret;

    if (ret != 0)
        return ret;

    // Get a pointer one of our input type pointers,
    // wrapped with some bookkeeping metadata
    struct context_chatgpt *req = userspace_reserve_chatgpt();
    if (!req)
        return -EPERM;

    // Fill in the input with what we want to send to userspace
    req->value = (struct chatgpt_request) {
        .accmode = BPF_CORE_READ(file, f_flags) & O_ACCMODE,
    };
    bpf_path_d_path(&file->f_path, (char *)req->value.exe_path, sizeof(req->value.exe_path));

    // Invoke the xattr reading part, to actually execute the
    // userspace helper
    bool *verdict_ptr = userspace_chatgpt(req);

    int verdict       = -EPERM;
    if (verdict_ptr && *verdict_ptr)
        verdict = 0;

    // Free the index so other helpers can run with it again
    userspace_end_chatgpt(req);

    return verdict;
}
```

We'll construct a prompt:

> The binary %s on my system is attempting to %s file %s on Linux.
> Is this expected behavior, or does it indicate that the binary is potentially compromised?
> Think through it, and then output as the very last word with "Yes" if the operation should be allowed, and "No" otherwise.

```go
```

-->

<!-- Let's take a look at some code for this: -->
<!--
```c
SEC("lsm.s/file_open")
int BPF_PROG(file_open, struct file *file, int ret) {
    if (bpf_get_current_cgroup_id() != target_cgroup)
        return ret;

    if (ret != 0)
        return ret;

    struct task_struct *task = bpf_task_from_pid(pid);
    if (!task)
        return 0;

    struct file *file = bpf_get_task_exe_file(task);
    if (!file) {
        bpf_task_release(task);
        return 0;
    }

    struct bpf_dynptr dynp;
    bpf_ringbuf_reserve_dynptr(&ringbuf, 64, 0, &dynp);

    bpf_get_file_xattr(file, "user.sleep", &dynp);

    bpf_ringbuf_discard_dynptr(&dynp, 0);
    bpf_put_file(file);
    bpf_task_release(task);

    return 0;
}
```

```go
func (f *ExecFile) Getxattr(ctx context.Context, attr string, dest []byte) (uint32, syscall.Errno) {
    slog.Info("Getxattr", "attr", attr)
    segments := strings.Split(attr, ".")

    if len(segments) == 3 && segments[0] == "user" {
        idx, err := strconv.Atoi(segments[2])
        if err != nil {
            slog.Error("Failed to parse idx", "attr", attr, "err", err)
            return 0, syscall.ENODATA
        }

        if segments[1] == "chatgpt" {
            // grab the input based on the index of `user.chatgpt.<index>`
            var req T
            err := ebpfMap.Lookup(uint32(idx), &req)
            if err != nil {
                slog.Error("Failed to lookup in map", "idx", idx, "err", err)
                return 0, syscall.EINVAL
            }

            // return data as the value of the xattr
            copy(dest, []byte{1})
            return 0, syscall.ENODATA
        }
    }

    return 0, syscall.ENODATA
}
```
-->

## Environment Variables

While this technique is great, there are a few fundamental restrictions which don't make it as nice as Deno's sandbox.
One issue is environment variables.
`Deno.env.get` (and the node compat `process.env`) trigger interactive prompts to the user which provide the name of the environment variable as context to the user so they can make the decision on if it is safe.
This is simply not the way environment variables are handled at the OS level.

The `execve` syscall is used on Linux to replace the current process with a different executable:

```c
int execve(const char *pathname, char *const _Nullable argv[], char *const _Nullable envp[]);
```

All environment variables are passed directly into the new binary at startup.
All arguments and environment variables are placed directly on the stack by the kernel.

Then whatever language you use reads all these values before your `main` is called, and transforms them into a language specific API.
The two things which are done are typically:

1. Convert the arguments and environment variables from C strings to the language string format. Lots of languages like Go and Rust have string types with a `usize` length value and a pointer to the data, so they need to initialize those and possibly copy the contents somewhere else.
2. Build a hashmap or similar out of the environment variables. `libc` exposes `char *getenv(const char *name)`, and Rust exposes `std::env::var(...)` for example.

You might be able to see the problem here.
There is no way to hide environment variables until they are read.
Instead, they are all read on program startup, and shuffled around all over the place.
There is no `getenv` syscall which we could interpose on.

Also, side note/fun fact.
Setting an environment variable is fake.
Any standard library providing a `setenv` like function, is just modifying the hashmap representation of the language.
The kernel is never notified of such an edit, additional environment variable, or the deletion of one, even though it populated them in the first place.
Additionally, languages like Go protect the map with a mutex.
But with cgo enabled, `os.Setenv` instead uses `libc`'s `setenv` which is [very thread unsafe](https://www.evanjones.ca/setenv-is-not-thread-safe.html), leading to a [segfault in Go too](https://github.com/golang/go/issues/63567) in multithreaded programs.
Indeed, [`cgo` is not Go](https://dave.cheney.net/2016/01/18/cgo-is-not-go).

So, there is no reliable way to do language-independent environment variable interactive permissions.

One could potentially mask environment variable values with some garbage data of the same length before calling `execve`.
This is so it still uses the same amount of memory as if they were there.
Then, an eBPF `uprobe` could be inserted on language specific functions like `getenv` in `libc`, and edit the process's memory to "unmask" the true value of the environment variable if it was approved.
However, this approach is very brittle and it would be very tricky to implement.
It also leaks the metadata of environment variable names as well as the lengths of their values.
Though I don't think it is that big of a deal a program knows that `AWS_SECRET_ACCESS_KEY` is set, if it can't know its actual value.

Another approach could be to look at it heuristically.
That is, start by allowing benign environment variables like `HOME` and `PATH` for example.
Then, run `strings` or similar on the binary to see if any `SCREAMING_SNAKE_CASE` strings are statically defined.
Then we can compare those potential matches to the currently set environment variables, and ask the user before the program starts if it wants to forward those on.
This obviously won't cover all programs, but it is probably better than nothing.

## Network

You typically establish an internet connection with the `connect` syscall.
However it is only possible to extract the IP which you want to connect to, not the domain.
An IP address is pretty meaningless to a user trying to determine if something is secure or not.
We also can't look at the data sent because it is probably encrypted.
And, the program might use DNS over TLS so we can't even introspect based on DNS traffic (which is traditionally UDP).

What `cordon` does is it asks `systemd-resolved` for recently resolved requests to tries to reverse resolve the IP it got from `connect` to a recent query.
This works when the program simply uses `getadderinfo`, but for a truly malicious program it will not resolve.

Actually, the worst case scenario is that it falsely reverse resolved, meaning the user may approve a domain which it is not actually being sent to.
This can happen because the same IP can serve many different websites.
We can thank IPv4 for not having nearly enough address space for this.
For example, CDNs do this, and so does Cloudflare.
An attacker can put their website behind Cloudflare, then find a benign website also behind Cloudflare which happens to share the same IP as the attacker.
(This is an oversimplification because of anycast, but bear with me here).
Then the attacker does a query to the benign site, which you approve.
Then it sends an HTTP request to the attacker site with a different domain in the `Host` header, but because it has the same IP it looks to `cordon` and you like it simply is sending to the benign site again, so it will be approved.

There is basically no way to prevent this.
This is why I have such a strong emphasis on restricting filesystem access.
A malicious program cannot exfiltrate something it does not have access to.
In my opinion, a program should either have filesystem read access, or network connect access, but not both.
Though strict adherence to this rule would obviously imply whole classes of programs shouldn't exist.

It would be possible to implement an L7 proxy and transparently route traffic through it from the sandboxed program using eBPF.
That way, `cordon` could analyze HTTP traffic for example, to get more context to provide to the user.
It could even look at the [SNI](https://en.wikipedia.org/wiki/Server_Name_Indication) of TLS connections to see what domain it wants to connect to.
Though, in TLS 1.3 the SNI can be encrypted with Encrypted Client Hello (ECH), so it wouldn't be able to grab it out in that case either.
Also, the SNI can differ from the `Host` in the HTTP header anyways, so it'd be back to square one in terms of trying to understand where the traffic is actually heading.

## Conclusion

Overall, `cordon` is not ready, and is still highly insecure.
It turns out that it takes a lot of effort to build robust and secure software.
I hope to spend more time in the future developing the project and seeing how far I can take it.

If you're interested in it, check out the source code at [mbund/cordon](https://github.com/mbund/cordon) for the full implementation, and for updates on the future status of the project.

In any case, here are the main takeaways I hope you have after reading this post:

- Sleepable eBPF programs can run any [arbitrary userspace function with FUSE xattr RPC](#arbitrary-userspace-helpers). This has potential for writing better EDR software for Linux.
- Ideally, interpreted runtimes should have interactive sandboxes like Deno. They can provide the most context to the user (for example, [environment variables, which are not possible with a "native" solution](#environment-variables))
- Use [Landlock](#landlock) if you can, because the developer has the most context on what should or should not be accessed.
- Try to reduce the amount of third party code you depend on.
