---
author: Mark Bundschuh
pubDatetime: 2024-07-06
title: The missing DSL for health checks
postSlug: healthscript
featured: false
draft: false
tags:
  - ctf
  - infrastructure
description: Health checks let devs and users know the status of a service. Let's see what it looks like to make it as easy as possible to write one.
---

## Table of contents

## Who needs health checks?

Companies like [Cloudflare](https://cloudflare.com) have entire pages dedicated to the status of each individual service on [cloudflarestatus.com](https://cloudflarestatus.com). But they're an infrastructure company, so this is par for the course. What's interesting is they have a dedicated domain for status, `cloudflarestatus.com`, not `cloudflare.com`. This is obviously a good idea when you think about it: what if `cloudflare.com` is so far gone that a `/status` page can't be up? If a service is monitoring itself, it is useless because the monitor will be down at the same time, so it will only ever report that the service is working. Fortunately, Cloudflare did it correctly so when customers are troubleshooting their own broken websites, it's easy to sanity check that it really is their own fault and not Cloudflare's. They do as little maintenance and work on `cloudflarestatus.com` as possible so hopefully it is the last service that goes down in an outage.

But health checks are really not all that complicated. For your personal project it should be easy for anyone just passing by to know if all services are operational, even if there hasn't been an update in a while. Do you know if that docker container you spun up for your side project in the cloud a year and a half ago which runs `ffmpeg` to process uploaded videos still works, right now? If it is down, your users should know that you know it is down, and not email you about it because you're probably in the middle of fixing it.

## A case study

So in most cases it's easy right? Just send a good ol' HTTP `GET` request, and see if it times out or doesn't return a `200`. For no particular reason, lets take a look at the Google Maps Geocode API (which by the way converts between latitude/longitude coordinates and street addresses). What happens if we give the API an invalid key?

So I make a GET request to this endpoint:

```
https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=invalidapikey
```

And I get a JSON response:

```json
{
  "error_message": "The provided API key is invalid. ",
  "results": [],
  "status": "REQUEST_DENIED"
}
```

...with an HTTP status of `200`. 🤔❓❗

This is not uncommon. Somehow after years of being JSON-brained the industry has forgotten about HTTP status codes. Many services have a `/healthz` endpoint which return a status of `200` with `{ "status": "error" }`. So to check the health of some HTTP services, I need something to parse JSON...awesome.

## HTTP is not the whole world

Surprising only web developers, other kinds of internet services exist which do not serve HTTP. For example, CTFs with pwn challenges which are just running a server that you `nc` into. Here is a sample challenge from the [OSU Cybersecurity Club's Bootcamp CTF](https://bootcamp.osucyber.club):

```
$ nc pwn.osucyber.club 13371
You hear that, Mr. Anderson?
```

(It then takes in user input. It is a simple buffer overflow challenge to modify some other variables on the stack, but the actual service is not totally relevant to this post)

It would be very nice to check the health of a raw TCP server like this.

## Embedability is key

Let's focus in a little more on CTFs. Authors write their own challenges, and a health check is probably the last thing they think about. Let's look at a sample manifest for a CTF challenge

```yaml
name: speedrun1
description: |
  Connect using `nc pwn.osucyber.club 13371`

  Click below to download the source .c file and executable.
points: 44
category: pwn
flag: osuctf{8uff3r_0v3rfl0w5_4r3_345y}
files:
  - chall_1.c
  - Makefile
  - chall_1
```

The manifest might correspond to a challenge like this on the website (depicted here is [CTFd](https://ctfd.io))

<img src="/assets/healthscript/ctfd.png" alt="A normal CTFd challenge">

Challenge authors are responsible for writing these manifests. I don't want to be responsible for writing everyone's health checks, so I'm looking for a solution that is easy to embed into my manifest format or similar. It is important, especially for people who are new to CTFs to have the health of the challenge known so they don't DM the author saying the challenge is down when it really is just them who is having trouble connecting.

I want one standard way, in plain text, powerful enough to parse JSON for HTTP health checks, and also able to connect to raw TCP and check the output bytes.

## Situation: there are 14 competing standards

As a developer it is my natural instinct to jump right in start writing code. But I think it might be worth it to take a look at what's out there first so I'm not reinventing the wheel.

### Hurl

> [Hurl](https://hurl.dev) is a command line tool that runs **HTTP requests** defined in a simple **plain text format**.
>
> Hurl makes it easy to work with **HTML** content, **REST / SOAP / GraphQL** APIs, or any other **XML / JSON** based APIs.

This seems pretty great! Here's an example of some [Hurl](https://hurl.dev)

```http
POST https://example.org/api/tests
{
    "id": "4568",
    "evaluate": true
}
HTTP 200
[Asserts]
header "X-Frame-Options" == "SAMEORIGIN"
jsonpath "$.status" == "RUNNING"    # Check the status code
jsonpath "$.tests" count == 25      # Check the number of items
jsonpath "$.id" matches /\d{4}/     # Check the format of the id
```

The syntax is very understandable, and in most cases it will be a single line like `GET https://example.com` so it will look good in the yaml manifest and be easy to write. But you might have realized from the description and this example, that Hurl does not support TCP or other protocols.

### Uptime Kuma

In my [homelab](/posts/homelab), I run an instance of [Uptime Kuma](https://github.com/louislam/uptime-kuma) which does a checks against services every 60 seconds. They have tons of monitor types including HTTP, TCP, Ping, gRPC, and DNS, just to name a few. It is effectively a self-hostable version of [Uptime Robot](https://uptimerobot.com).

<img src="/assets/healthscript/uptime-kuma.png" alt="Adding a new monitor in Uptime Kuma showing many monitor types including HTTP, TCP, Ping, gRPC, and DNS">

This variety of health checks is what I am looking for. However, Uptime Kuma is a whole webserver unto itself. I want a plaintext format similar to Hurl but with this level of variation in kinds of health checks.

It looks like we need to develop one universal standard that covers everyone's use cases after all.

## Introducing Healthscript

Let's start by making the most typical cases the easiest to encode.

The following will do an HTTP `GET` request to `example.com`, and expect a `200` status code in the response, with a default timeout of 10 seconds.

```
https://example.com
```

Connect to `example.com` on port `12345` over TCP, and expect any byte from the server, with a default timeout of 10 seconds.

```
tcp://example.com:12345
```

Do an ICMP ping request to `example.com`, and expect a successful response, with a default timeout of 10 seconds.

```
ping://example.com
```

Lookup `example.com` in DNS, and expect any record to exist.

```
dns://example.com
```

In general we are encoding the protocol in the scheme of the uri, kind of like a `postgres://` database connection url. Now let's sprinkle in some meta information into our requests.

The following will send an HTTP `POST` request with a JSON body of `{ "a": 3 }` to `https://example.com`, and expect an HTTP status code of `500` and a JSON body to match the [jq](https://stedolan.github.io/jq) expression `.some.value == 3`, timing out after `3` seconds.

```
[POST] <{ "a": 3 }> https://example.com [500] [3s] <(.some.value == 3)>
```

Connect to `pwn.osucyber.club` on port `13371`, and be considered successful as soon as the accumulated bytes received so far concatenated together match the [UTF-8](https://en.wikipedia.org/wiki/UTF-8) string `You hear that, Mr. Anderson`, with a default timeout of 10 seconds.

```
tcp://pwn.osucyber.club:13371 <"You hear that, Mr. Anderson">
```

These examples go to show how flexible Healthscript can be. The general philosophy behind the language design are as follows:

- Tags before the uri are included as part of the request, and tags after the uri are expectations about the response
- "Meta" tags like HTTP verbs, HTTP headers, status codes, and timeouts are in square brackets `[]`
- Body tags are in angle brackets `<>`
- Urls with custom schemes should be used to denote the protocol in the url

[Healthscript](https://github.com/rhombusgg/healthscript) is implemented as a [Rust library](https://crates.io/crates/healthscript), and usable on your machine today using [healthscript-cli](https://crates.io/crates/healthscript-cli). The CLI is designed to help guide you in writing Healthscript with error recovery and suggestions (thanks to parser combinators). A more complete specification is available on [GitHub](https://github.com/rhombusgg/healthscript).

<img src="/assets/healthscript/cli-errors.png" alt="Example of using the CLI and errors generated">

## Incremental adoption with badges

So now that there are 15 standards, how or why should people adopt this one? I don't expect [GitHub](https://github.com) to add a custom property for uptime, or [CTFd](https://ctfd.io) to include a `healthscript` field when you're making a challenge. Even if I add a `healthscript` property in my challenge manifest, how I display it to players? You might <a href="https://shields.io"><img class="not-prose inline-block align-text-top" src="https://img.shields.io/badge/have seen-the answer before-blue)" alt="have seen the answer before"></a>

I'm hosting a little service service on `healthscript.mbund.dev` that takes any healthscript as a path parameter and will dynamically generate an SVG badge based on if the service is healthy or not.

```
![healthcheck for example.com](https://healthscript.mbund.dev/https://example.com)
```

<div class="flex flex-col gap-2">
<img class="not-prose w-fit" src="https://healthscript.mbund.dev/https://example.com" alt="example.com health check">
<img class="not-prose w-fit" src="https://healthscript.mbund.dev/https://http.codes/500 [200]" alt="http.codes/500 health check which is unhealthy">
<div>

Now, you can embed it anywhere you can embed an SVG, exactly like how [shields.io](https://shields.io) generates badges for your GitHub repo. What's also cool is that this solves the `cloudflarestatus.com` problem, whereby using an external service (hosted by me), you don't need to rely on your infrastructure to be up to know if your infrastructure is up (or buy yet another domain name).

And now a badge for <img class="not-prose inline-block align-text-top" src="https://healthscript.mbund.dev/https://cloudflarestatus.com" alt="cloudflarestatus.com health check">

<img src="/assets/healthscript/meme.jpeg" alt="assassination chain meme where cloudflare.com is being shot by cloudflarestatus.com which is being shot by a healthscript badge which is being shot by three question marks">

Here's an example of using the badge in CTFd, where all I do is add more markdown to the `description` in the challenge manifest.

```
![health check](https://healthscript.mbund.dev/tcp://pwn.osucyber.club:13371 <"You hear that, Mr. Anderson">)
```

<img src="/assets/healthscript/ctfd-healthcheck.png" alt="CTFd challenge with a TCP Healthscript badge in the description">

Now CTFd supports health checks with Healthscript! Of course, this works in [rCTF](https://rctf.redpwn.net), GitHub repo descriptions, or any other Markdown/HTML!

<img src="/assets/healthscript/github-readme.png" alt="GitHub readme with Healthscript badge">

I hope to run the badge service for free as long as possible. The badge service is an extremely simple Axum http server with no state, so it's easy to host on whatever is the hosting provider de jour. Today it runs comfortably within the free tier of [Fly.io](https://fly.io), which has been really great so far.

## Conclusion

If you find Healthscript interesting, check it out in more detail on [GitHub](https://github.com/rhombusgg/healthscript) and maybe star it while you're there. And make sure to let me know your thoughts in the comments below!
