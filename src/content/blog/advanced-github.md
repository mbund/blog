---
author: Mark Bundschuh
pubDatetime: 2024-12-16
title: Advanced GitHub
postSlug: advanced-github
featured: false
draft: false
tags:
  - infrastructure
  - tools
description: A somewhat comprehensive guide to neat features and tricks on GitHub that you might not know about.
---

## Table of contents

## Introduction

GitHub is more than just a Git hosting platform. It offers a wide range of features and tools that can help you streamline your development workflow. Some are common like Actions for built in CI, but there is way more beyond even that. I wanted a single comprehensive place to store all the tips and tricks I've learned. Let's learn how to become a GitHub power user.

For reference, my GitHub username is `mbund`, and I will be using myself as an example GitHub user.

## Public SSH Keys

If you've authenticated Git with SSH keys (under [github.com/settings/keys](https://github.com/settings/keys)), they are actually publicly available at `github.com/<username>.keys`. For example, my public keys are available at [github.com/mbund.keys](https://github.com/mbund.keys). Initially, this might sound like a security risk, but they are just public keys so it is safe to share them (though it is good to be aware of this). In my opinion, it is actually really convenient to have them available like this.

Say you're setting up a server and you want to add your public key to the `authorized_keys` file. You can just run the following command:

```bash
curl https://github.com/mbund.keys >> ~/.ssh/authorized_keys
```

The format that the endpoint hosts is one key per line, exactly like `authorized_keys`. In fact, this is what the Ubuntu Server installer is doing when you select `Github` from `Import SSH identity`.

<img alt="Ubuntu server installation on Profile setup screen showing the Import SSH Identity prompt" src="/assets/advanced-github/ubuntu-server-install.png">

(well really it is using the GitHub api [api.github.com/users/mbund/keys](https://api.github.com/users/mbund/keys) and parsing the JSON response, but the effect is the same)

## Profile Pictures

GitHub profile pictures are available at `github.com/<username>.png`. For example, my profile picture is available at [github.com/mbund.png](https://github.com/mbund.png). It will redirect to the highest resolution version of the image that GitHub has.

```html
<img src="https://github.com/mbund.png">
```

<img alt="mbund's profile image on GitHub" src="https://github.com/mbund.png" width="150px">

## Patches

When you click on a commit in a repository, you get a "commit url" that look like this: https://github.com/mbund/homelab/commit/e5dc4e462cc8738efd2747336ab559b4ed1e0291. You can turn it into an email patch by appending `.patch` to the end of the url: https://github.com/mbund/homelab/commit/e5dc4e462cc8738efd2747336ab559b4ed1e0291.patch

This kind of "leaks" the email address of the user who made the commit, but this is just how Git works. Every commit must come with an email address, so even if your email is hidden on GitHub, it might still be in the commit metadata. GitHub does provide you with an email of the form `ID+USERNAME@users.noreply.github.com` which you can use to commit with. I'd recommend [reading the docs](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-email-preferences/setting-your-commit-email-address) on this.

```diff
From e5dc4e462cc8738efd2747336ab559b4ed1e0291 Mon Sep 17 00:00:00 2001
From: Mark Bundschuh <mark@mbund.dev>
Date: Sat, 15 Jun 2024 21:43:01 -0400
Subject: [PATCH] update tailscale

---
 system/ingress-nginx-private/templates/tailscale.yaml     | 2 +-
 .../templates/haproxy-deployment.yaml                     | 2 +-
 system/ingress-nginx-public/templates/tailscale.yaml      | 2 +-
 system/mailserver/deployment.yaml                         | 2 +-
 system/pihole/values.yaml                                 | 2 +-
 terraform/modules/cloudflare/main.tf                      | 8 ++++----
 6 files changed, 9 insertions(+), 9 deletions(-)

diff --git a/system/ingress-nginx-private/templates/tailscale.yaml b/system/ingress-nginx-private/templates/tailscale.yaml
index a03fbef..66db303 100644
--- a/system/ingress-nginx-private/templates/tailscale.yaml
+++ b/system/ingress-nginx-private/templates/tailscale.yaml
@@ -33,7 +33,7 @@ spec:
       containers:
         - name: tailscale
           imagePullPolicy: Always
-          image: ghcr.io/tailscale/tailscale:v1.60.0
+          image: ghcr.io/tailscale/tailscale:v1.68.1
           command: ["/bin/sh"]
           args:
             - -c
diff --git a/system/ingress-nginx-public/templates/haproxy-deployment.yaml b/system/ingress-nginx-public/templates/haproxy-deployment.yaml
index c10f7de..3ff5998 100644
```

## Permalink and Line Numbers

In the code view, you can click in the gutter to select a line, then shift click another line to select a range of lines. Notice the url bar update as I perform those actions below. You can then share this url with others to link directly to that line or range of lines. But, if you are on the head of a branch, these links will break if there are changes in the future which shift the lines around. So, it is better to link to a particular commit, making it a [permalink](https://en.wikipedia.org/wiki/Permalink).

Getting the permalink with the UI can be frustrating, clicking around trying to find the latest commit hash. But, you can actually just press `y` on your keyboard and the url will update with the permalink to the current commit.

<video src="/assets/advanced-github/permalink.webm" autoplay muted loop>clicking in line gutter and pressing y to get a permalink</video>

You can actually make a selection and press `SHIFT+J` to get the column numbers in the selection as well.

You can discover more keyboard shortcuts by pressing `?` on most pages, or by reading [the docs](https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts), which is how I found these.

## Integrated VSCode

Since Microsoft owns both GitHub and VSCode, it shouldn't be surprising that there is strong integration between the two. You can open a repository in VSCode directly from the browser by pressing `.` on your keyboard. This will replace your tab with a VSCode instance that is connected to the repository.

Alternatively, you can replace `github.com` with `github.dev` and navigate there yourself, or press `>` to open VSCode in a new tab.

<video src="/assets/advanced-github/vscode.webm" autoplay muted loop>pressing . to open repository in VSCode in the browser</video>

Notice how it respects the line numbers too!

This lets you edit multiple files at once and make a commit directly from the browser. Though, it has limitations in that you can't run any commands, and many extensions do not work. But, it is still a very powerful feature.

Somewhat relatedly, you can go to [vscode.dev](https://vscode.dev) without signing in to anything, which is really powerful when you are on a computer you can't install anything on. You can even get the Live Share and then remote into another computer to code with someone else, without installing anything.

## Linguist and `.gitattributes`

You know that bar on the right side of the repository that shows the languages used in the repository?

<img alt="language distribution bar showing Rust, HTML, TypeScript, SQL, Fluent, Javascript, and Other" src="/assets/advanced-github/linguist-bar.png" width="300px">

That is powered by [Linguist](https://github.com/github-linguist/linguist), an open-source library that GitHub maintains. It is actually customizable with a `.gitattributes` file in the repository.

For example, by default, `.sql` files are not detected and shown in the bar as SQL. But, you can add a `.gitattributes` file with the following content to make them show up as SQL:

```gitattributes
*.sql linguist-detectable=true
```

Though, on GitHub this makes it show up as `PLpgSQL` for some reason. But, you can override it to show up as "plain" SQL with:

```gitattributes
*.sql linguist-detectable=true linguist-language=sql
```

If you want the full list of languages that Linguist supports, you can find it [here](https://github.com/github-linguist/linguist/blob/main/lib/linguist/languages.yml). It is updated pretty frequently.

Let's say there is some file which you don't want to show up as diffable, like a binary file or a lock file. You can add the following to your `.gitattributes` file:

```gitattributes
Cargo.lock -diff
```

Let's say that you vendored a package within your repository, and you want to ignore it from the language statistics altogether since it is a library (also ignoring diffs). You can add the following to your `.gitattributes` file:

```gitattributes
/my/vendored/lib/ linguist-vendored=true -diff
```

You can do some pretty funny things with this, for example I made an [exemplary](https://github.com/mbund/exemplary) repository that runs a GitHub Action every day to update the language statistics to show a random set every day. It is a fun way to show how to manipulate the language bar.

<a href="https://github.com/mbund/exemplary"><img alt="exemplary GitHub repository showing a random distribution of language in the language bar" src="/assets/advanced-github/exemplary.png"></a>

## GitHub API

Large parts of GitHub are consumable with a JSON api even without an access token. For example, you can get a user's profile information by visiting `api.github.com/users/<username>`. For example, my profile information is available at [api.github.com/users/mbund](https://api.github.com/users/mbund). It can be fun to explore the API and see what you can do with it, and you can use it for test data in your projects.

## GitHub CLI

GitHub has an incredible powerful CLI tool called [`gh`](https://github.com/cli/cli). Here are some great commands:

- `gh auth login`: set up git credentials
- `gh repo create`: create a new repository
- `gh pr checkout`: checkout a pull request locally
- `gh pr merge`: merge a pull request
- `gh run view --log`: view the logs of a GitHub Action run

I can't stress how many features it has. I'd really suggest checking it out if you haven't already.

## README Customization

Here are some README tricks you may have seen out in the wild, and how to do them.

### Profile README

If you make a repository the same name as your username, and there is a `README.md` in the root of it, it will show up on your profile page.

You might have seen some people with fancy profile READMEs. Here are some common ones you might have seen:

- https://github.com/anuraghazra/github-readme-stats

<img src="https://github-readme-stats.vercel.app/api?username=anuraghazra&show_icons=true&theme=dark">

- https://github.com/lowlighter/metrics

<img src="https://raw.githubusercontent.com/lowlighter/metrics/refs/heads/examples/metrics.classic.svg">

- https://github.com/antonkomarev/github-profile-views-counter

<img src="https://user-images.githubusercontent.com/1849174/88077155-9ccc2400-cb83-11ea-8d9c-d18a8b1dc297.png">

- https://github.com/Platane/snk

<img src="https://raw.githubusercontent.com/platane/snk/output/github-contribution-grid-snake-dark.svg">

### Badges

Badges are usually from [shields.io](https://shields.io) which let you display <img class="not-prose inline-block align-text-top" alt="any text you like" src="https://img.shields.io/badge/any%20text-you%20like-blue"> including, but not limitied to:

- licenses `https://img.shields.io/badge/license-MIT-blue.svg` <img alt="MIT" class="not-prose" src="https://img.shields.io/badge/license-MIT-blue.svg">
- technologies `https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white` <img alt="TypeScript" class="not-prose" src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white">
- stars `https://img.shields.io/github/stars/mbund/blog` <a alt="number of stars" href="https://github.com/mbund/blog"><img class="not-prose" src="https://img.shields.io/github/stars/mbund/blog"></a>
- last commit `https://img.shields.io/github/last-commit/mbund/blog` <a alt="last commit" href="https://github.com/mbund/blog"><img class="not-prose" src="https://img.shields.io/github/last-commit/mbund/blog"></a>

and [way more](https://shields.io/badges).

There are lots more sources of badges too. If you append `/badge.svg` to a GitHub Action workflow path, you get the badge of it. For example,

```
https://github.com/tokio-rs/tokio/actions/workflows/ci.yml/badge.svg
```

produces <img alt="CI badge" class="not-prose inline-block align-text-top" src="https://github.com/tokio-rs/tokio/actions/workflows/ci.yml/badge.svg"> which is the status of that workflow.

Most ecosystems also have ways to get badges. For example, in the Rust ecosystem, you can get a badge from [docs.rs](https://docs.rs) by appending `/badge.svg` to the docs.rs crate path. For example,

```
https://docs.rs/tokio/badge.svg
```

produces <img alt="docs build status badge" class="not-prose inline-block align-text-top" src="https://docs.rs/tokio/badge.svg"> which says if the documentation was able to build successfully.

In a recent [post of mine](http://localhost:4321/posts/healthscript) I created my own badge service for health checks <img alt="current health of example.com" class="not-prose inline-block align-text-top" src="https://healthscript.mbund.dev/https://example.com">

And here's a pro markdown tip for images, since those url lines can get long:

```markdown
[![Build Status][actions-badge]][actions-url]
[actions-badge]: https://github.com/tokio-rs/tokio/actions/workflows/ci.yml/badge.svg
[actions-url]: https://github.com/tokio-rs/tokio/actions/workflows/ci.yml
```

### VHS

You can use [VHS](https://github.com/charmbracelet/vhs) to programmatically record terminal sessions and embed them in your README. It is a really cool way to show off your CLI projects.

For example, I created a `.tape` file for [canvas-cli](https://github.com/mbund/canvas-cli) (a tool to interact with [Canvas LMS](https://instructure.com/canvas) from the command line)

```tape
Output docs/submit.gif

Require canvas-cli

Set Shell fish
Set FontSize 32
Set Width 1500
Set Height 800
Set LoopOffset 50%
Set Framerate 24

Type "canvas-cli submit upload-test.pdf" Sleep 500ms  Enter
Sleep 6s

# select course
Left # fix rendering issue
Sleep 1s
Down@200ms 5
Sleep 1s
Up@200ms 5
Sleep 1s
Enter
Sleep 1s

# select assignment
Type@200ms "homework 17" Sleep 500ms  Enter

Sleep 8s
```

Which generates the following gif:

<img alt="submitting an assignment with Canvas Cli" class="not-prose" src="https://raw.githubusercontent.com/mbund/canvas-cli/refs/heads/main/docs/submit.gif">

If I ever update the UI of the CLI, I can just run the `.tape` file again and it will update the gif without me having to rerecord it. The tapes can also be generated in CI for full automation.

(by the way, you should check out [Charm](https://charm.sh), the creators of VHS and many other cool projects on the CLI)

### Light/Dark Mode

You can specify that images should only show up in light or dark mode on GitHub by adding `#gh-dark-mode-only` or `#gh-light-mode-only` to the end of the image url, for example you would do this:

```html
![GitHub-Mark-Light](https://user-images.githubusercontent.com/3369400/139447912-e0f43f33-6d9f-45f8-be46-2df5bbc91289.png#gh-dark-mode-only)
![GitHub-Mark-Dark](https://user-images.githubusercontent.com/3369400/139448065-39a229ba-4b06-434b-bc67-616e2ed80c8f.png#gh-light-mode-only)
```

<img alt="GitHub logo on light and dark backgrounds in an open issue" class="not-prose" src="https://i0.wp.com/user-images.githubusercontent.com/3369400/140949452-9bb34718-9d31-45cd-9311-fd42511cf4c5.png">

### Allowed HTML

Basic stuff like `<p>`, `<strong>`, `<img>` etc. are allowed as expected. And here are your options for alignment (since there is no CSS):

```html
<div align="center">
    <p>center</p>
</div>
<div align="left">
    <p>left</p>
</div>
<div align="right">
    <p>right</p>
</div>
```

<div align="center">
    <p>center</p>
</div>
<div align="left">
    <p>left</p>
</div>
<div align="right">
    <p>right</p>
</div>

### SVGs

While you can't embed arbitrary HTML in GitHub's READMEs, you can embed SVGs. This can be used to create some of the effects you might have thought were only possible with HTML and CSS.

<img alt="animated Mark's Homelab text with many technology logos" class="not-prose" src="https://raw.githubusercontent.com/mbund/homelab/refs/heads/main/docs/title.svg">

### Live Dashboards

If you want live data, like an `<iframe>` embed that shows some chart, you are out of luck because GitHub doesn't allow arbitrary HTML.

Or are you?

When you include a remote image in your README, it is cached by GitHub for a certain amount of time and becomes a `camo.githubusercontent.com` url. This is primarily so that visiting your repo doesn't leak people's IP addresses (because of the `GET` request to the remote server), and also so that the remote server is not hammered by requests. But, the cache does update decently frequently, about every 30 seconds or so.

In my [homelab](http://localhost:4321/posts/homelab/#epic-readmemd) (where I talk about this same thing), I export Grafana charts publicly. I then host a service that, upon request, spawns a Chromium instance to take a screenshot of the chart and returns it. This way, I can embed live charts in my READMEs.

<a href="https://grafana.mbund.org/d/b250375b-77ce-456f-9c27-6c38221dd21a/misc?orgId=1&viewPanel=3"><img alt="server uptime" src="https://grafana-fetch-cache.mbund.org/server-uptime" width="400px"></a>

Hopefully my uptime is pretty good!

## GitHub Actions

### Dynamic Actions

Sometimes you want to run a lot of actions in parallel, but maybe you don't know the exact number of actions before hand. For example, say you're in a monorepo and there are many different projects. You can make a [matrix](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/running-variations-of-jobs-in-a-workflow) to run the same job for each project, but you would need to keep a hard coded list of paths to switch on in the workflow. Instead, there is a technique to dynamically create actions based on the contents of the repository which I call "Dynamic Actions"

The basic idea is that you first run a job which finds everything you need, then turns it into a JSON list, then outputs it to the workflow. Then, you can use `fromJson` to get the list of paths and run a job for each one.

To show a concrete example, let's talk about hosting a Capture the Flag (CTF) cybersecurity competition where there is a `challenges` directory. Then, within it, there are directories for each challenge with a `Dockerfile` in it. We want to build and push each of these images to a container registry.

First, we need to find all the directories with a `Dockerfile` in them (under the `challenges` directory). We can do this with a shell script:

```bash
# find all directories with a Dockerfile
find challenges -type d -exec test -e "{}/Dockerfile" \; -printf '%p\n' \
| jq -R -s -c # convert lines to a JSON list
```

Now, to set this as a variable, we can use standard GitHub Actions syntax:

```bash
# this is how you set an output in a GitHub Action:
echo "challs=hi" >> $GITHUB_OUTPUT

# and with our previous incantation:
echo "challs=$(find challenges -type d -exec test -e "{}/Dockerfile" \; -printf '%p\n' | jq -R -s -c 'split("\n")[:-1]')" >> $GITHUB_OUTPUT
```

Now comes the real magic. Here is the full workflow:

```yaml
jobs:
  list:
    runs-on: ubuntu-latest
    outputs:
      challenges: ${{ steps.set-challenges.outputs.challenges }}
    steps:
      - uses: actions/checkout@v4

      - id: set-challenges
        run: |
          echo "challenges=$(find challenges -type d -exec test -e "{}/Dockerfile" \; -printf '%p\n' | jq -R -s -c 'split("\n")[:-1]')" >> $GITHUB_OUTPUT

  build:
    needs: list
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        challenge: ${{ fromJson(needs.list.outputs.challenges) }}
    steps:
      - uses: actions/checkout@v4

      - name: Magic
        env:
            CHALLENGE: ${{ matrix.challenge }}
        run: echo $CHALLENGE
```

The `build` job has `needs: list` so the `list` job will run first. So the list job runs and outputs the list of the challenges to the `set-challenges` step. Then, the `list` job finishes and sets its `challenges` output to the list of challenges from the `set-challenges` step. Then, the build job gets the list of challenges from the previous `list` job (see `needs.list.outputs.challenges`), parses it as JSON during the [template expression evaluation](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/evaluate-expressions-in-workflows-and-actions) with the `fromJson` to create the matrix of challenges. Then, it queues a job for each challenge in the matrix.

In this example, the `build` job just prints the path of the challenge, but it can easily now `cd` into the challenge directory to build the Docker image and push it to a container registry.

It's a bit long, but here is what the workflow run looks like from the Actions tab, in its fully parallel glory:

<img alt="list action followed by 30 dynamically created actions" src="/assets/advanced-github/bctf-actions.png">

However, after 60 days of inactivity on repo, these are disabled (see [here](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow)).

But I accidentally discovered a way to keep them running indefinitely when creating my [exemplary meme repo](https://github.com/mbund/exemplary). It has an action which amends the latest commit and force pushes every day, which seems to reset the inactivity timer. This is a definitely bug with GitHub, but it is a useful trick to know.

### Pages

Traditionally, GitHub Pages simply deployed the `gh-pages` branch of a repository. But, there is a newer way to deploy a page directly from an action:

```yaml
name: Deploy Docs

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    name: Build Docs
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
    
      # build your docs...

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs/dist

  deploy:
    name: Deploy
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

However, there is still a good reason for the old `gh-pages` branch method: this [PR static site preview action](https://github.com/rossjrw/pr-preview-action).

Basically, it manages directories in the `gh-pages` branch such that `https://[owner].github.io/[repo]/pr-preview/pr-[number]/` will be a built version of the PR. It then leaves a comment on the PR with a link to the preview.

<img alt="github-actions bot user leaving a comment on a pull request with the link to view the site" src="https://raw.githubusercontent.com/rossjrw/pr-preview-action/refs/heads/main/.github/sample-preview-link.png">

This would be pretty unergonomic to do with the new Action method, so hopefully the `gh-pages` is never fully deprecated.

### Caching

GitHub Actions can be pretty slow if it has to rebuild all dependencies all the time. Fortunately, there is a first party cache action that you can use with no configuration, for free.

```yaml
name: Rust
on:
  push:
    branches:
      - main

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Cache
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/bin/
            ~/.cargo/registry/index/
            ~/.cargo/registry/cache/
            ~/.cargo/git/db/
            target/
          key: linux-x86_64-cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: Build
        run: |
          cargo build --all-features
```

This action will build rust, and cache based on the `Cargo.lock` file as the key. This way, if the `Cargo.lock` file changes, the cache will be invalidated and rebuilt. Otherwise, most of the artifacts will already be there, so the build will be significantly faster.

However, there are typically more optimized actions which build on top of the GitHub Action Cache more effectively than this simple solution. I would recommend these:

- Rust: [Swatinem/rust-cache](https://github.com/Swatinem/rust-cache)
- Nix: [DeterminateSystems/magic-nix-cache](https://github.com/DeterminateSystems/magic-nix-cache)

### Artifacts

Actions can create files which can be uploaded as Artifacts and can be downloaded from the Actions tab. This is useful for build artifacts, or anything else you might want to keep around.

For example, after I build a firmware image, I can upload it as an artifact:

```yaml
    - name: Create artifact
      uses: actions/upload-artifact@v4
      with:
        name: ap.img
        path: ap.img
```

<img alt="firmware build artifacts ap.img and comp.img with download and delete buttons" src="/assets/advanced-github/artifacts.png">

### Releases

You can automatically create a Release from a GitHub Action. For example, on push, you can build a static binary of your project and release it:

```yaml
name: Build and Release
on:
  push:
    branches:
      - main
    paths:
      - src/**
      - Cargo.toml
      - Cargo.lock
      - .github/workflows/build.yaml
  workflow_dispatch:

jobs:
  build:
    name: Build and Release
    permissions:
        contents: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Dependencies
        run: |
          sudo apt-get install -y musl-tools
          rustup target add x86_64-unknown-linux-musl

      - name: Build
        run: |
          cargo build --release --target=x86_64-unknown-linux-musl
          cp target/x86_64-unknown-linux-musl/release/canvas-cli canvas-cli-x86_64-unknown-linux-musl

      - name: Get tag name
        id: tag-name
        run: |
          echo "tagname=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      - name: Release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release create ${{ steps.tag-name.outputs.tagname }} -t "canvas-cli" -n "Binary release (${{ steps.tag-name.outputs.tagname }})"
          gh release upload ${{ steps.tag-name.outputs.tagname }} canvas-cli-x86_64-unknown-linux-musl
```

Many projects use a third party workflow (usually [softprops/action-gh-release](https://github.com/softprops/action-gh-release)), but actually I prefer to use the first party `gh` CLI directly (which comes preinstalled on all runners).

### More Disk Space

At the time of writing, public GitHub runners are using [Azure DS2_v2 VMs](https://docs.microsoft.com/en-us/azure/virtual-machines/dv2-dsv2-series#dsv2-series), which come with 84GB storage device, but only ~30GB is usable by you. Sometimes, with particular large actions this means you can run out of storage space. Usually this requires an upgrade to the workers. But it turns out that the runners come with a ton of preinstalled libs, most of which you will never use (Android, .NET, Haskell, etc.). So, the community has made some actions which first remove all of the unnecessary stuff. I would recommend [easimon/maximize-build-space](https://github.com/easimon/maximize-build-space) which can take you to ~60GB of free space.

### ghcr.io: GitHub Container Registry

If you're publicly publishing a docker image to Docker Hub or another registry, you might want to consider using GitHub Container Registry instead. GitHub Actions is able to push to it without needing to authenticate with a token. Here is a full example workflow which builds and pushes an image to ghcr.io:

```yaml
name: Build
on:
  push:
  workflow_dispatch:

jobs:
  push-ghcr:
    name: Build and push image
    runs-on: ubuntu-22.04
    permissions:
      contents: read
      packages: write
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Generate variables
        id: vars
        run: |
          echo "date=$(date +%Y-%m-%d)" >> $GITHUB_OUTPUT

      - name: Login to ghcr
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ github.token }}

      - name: Build image
        run: |
          docker build \
            --tag ghcr.io/${{ github.repository_owner }}/${{ github.event.repository.name }}:${{ steps.vars.outputs.date }} \
            --tag ghcr.io/${{ github.repository_owner }}/${{ github.event.repository.name }}:latest \
            .

      - name: Push to ghcr
        run: |
          docker push ghcr.io/${{ github.repository_owner }}/${{ github.event.repository.name }}:${{ steps.vars.outputs.date }}
          docker push ghcr.io/${{ github.repository_owner }}/${{ github.event.repository.name }}:latest
```

The above workflow tags the container with the current date, and also with `latest`. For example this is what my project, [argentblua](https://github.com/mbund/argentblua) does every day (`argentblua` is my [Fedora Silverblue](https://fedoraproject.org/atomic-desktops/silverblue) based operating system which is defined as a `Dockerfile`). The container shows up as a Package in the sidebar of the repository:

<img alt="packages list containing only the argentblua package" src="/assets/advanced-github/packages.png">

And clicking on it brings you to the recent tags and downloads:

<img alt="all tagged versions of the argentblua package" src="/assets/advanced-github/packages-list.png">

Now on push, the container is built and pushed to ghcr.io, and the latest tag is updated. And, we never had to juggle any access tokens!

## Giscus

Suppose you have a personal blog that is a static site, but you want to have a comments section. You can use [Giscus](https://giscus.app) which creates a GitHub Discussion for each post on your site, and is able to embed the comments section in your site, all without a database!

Hint: if you scroll down to the bottom of this page, you will see a Giscus comments section.

## Conclusion

I'll be continuously updating this post with more tips and tricks as I discover them. If you have any suggestions, feel free to leave them in the comments and I'll add them to the post. I hope you learned something new to enhance your GitHub workflow!
