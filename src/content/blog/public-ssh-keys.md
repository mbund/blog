---
author: Mark Bundschuh
pubDatetime: 2025-01-27
title: I have your public SSH key, log in to my server now
postSlug: public-ssh-keys
featured: false
draft: false
tags:
  - go
description: "I made a really large authorized_keys file, see if you can log in to my server: ssh keys.mbund.dev"
---

## Table of contents

## Introduction

tldr: run `ssh keys.mbund.dev`

In a recent [post of mine](/posts/advanced-github) I discussed some hidden features of GitHub, including one interesting one which I will repeat here:

> If you've added SSH keys (under [github.com/settings/keys](https://github.com/settings/keys)), they are actually publicly available at `github.com/<username>.keys`. For example, my public keys are available at [github.com/mbund.keys](https://github.com/mbund.keys). Initially, this might sound like a security risk, but they are just public keys so it is perfectly safe to share them (though it is good to be aware of this). In my opinion, it is actually really convenient to have them available like this.
> 
> Say you're setting up a server and you want to add your public key to the `authorized_keys` file. You can just run the following command:
> 
> ```bash
> curl https://github.com/mbund.keys >> ~/.ssh/authorized_keys
> ```
> 
> It is formatted as one key per line, exactly like `authorized_keys`.

This got me thinking...

I can add not only my own SSH keys to my servers, but my friends too. Actually, I can add anyone whose GitHub account I know, and who has uploaded their SSH keys to GitHub!

Would it be possible to make an `authorized_keys` file so large, that my server is effectively open to the whole world? How big would the `authorized_keys` file get if I added every public key on GitHub?

So, I got to work.

## How many GitHub users are there?

There is no endpoint on GitHub to just return all the public SSH keys they have. But we know that given a username, we can get their public SSH keys. So, how do we get a list of all GitHub users?

GitHub has a public endpoint which has the [latest events](https://api.github.com/events). It is a feed of every time anyone pushes to a repo, watches or stars a repo, opens a PR, follows a user, basically everything! Each event contains the username of the user who did the action, so all we have to do is watch this feed to collect new usernames over time to be able to process them.

However, it turns out that there is a project called the [GH Archive](https://www.gharchive.org) which has been aggregating these events since 2011. Their dataset is available in Google BigQuery and is updated every hour. With this, we can write a query to get a list of all GitHub users.

```sql
SELECT login, MAX(created_at)
FROM (
  SELECT actor.login, created_at
  FROM `githubarchive.day.2*`
  ORDER BY created_at DESC
)
GROUP BY login
ORDER BY MAX(created_at) DESC
```

A couple notes about the above query:

- `created_at` refers to the time the event of created, not the time the user was created.
- `actor` is the user, and `login` is the "login" username of the user.
- `githubarchive.day.2*` refers to each day's dataset where the year starts with `2` (so, every day of every year in the dataset).

Now let's run the query.

![Google BigQuery Studio executing the query and showing the first few results](/assets/public-ssh-keys/bigquery.png)

After running the query, I now have a list of all users on GitHub, or at least all those who have done at least one action on GitHub. As of 2024-12-18, there are about 77,000,000 users.

Now, let's say I wanted to check the SSH keys of all these users within 1 month. How many requests per second do I have to make to GitHub?

1 months means 30 days, so 30 days * 24 hours * 60 minutes * 60 seconds is 2,592,000 seconds, so 77,389,699 / 2,592,000 is...

29.9 requests per second. I don't think GitHub is going to be too happy with that kind of speed.

If I slow down enough to go through all these users, it will take *many* months. And in the meantime, more GitHub users will be signing up which will be unaccounted for. Also, users can upload keys later, which I might miss too. So, I changed my approach.

## A new strategy

Instead of straight enumerating through my gigabyte-large CSV of GitHub users which I queried once, I can go through the users who have been active in the last hour. To avoid spamming GitHub more (and if I miss some time), I still pull from the GH Archive, but using their REST endpoint to do an hour at a time.

When I pull all the events for the hour I process them like so:

- Deduplicate usernames found within the last hour
- Remove bot accounts (identified by `[bot]` suffix)
- Lookup in my own db all the users I have seen so far to filter out users who's keys have been scanned within the last month
- Iterate through the remaining users, making the requests to GitHub for their keys, and storing them into my db

Doing this reduces the request load to GitHub significantly, and is able to scan the last hour of GitHub activity in just under an hour, meaning that the scanner is not running behind. I also think that users who are more active on GitHub are more likely to read this blog post, so getting fresh information selects for users who are more likely to connect to my server.

## How do you connect?

Now that I have a database of all SSH keys, I need to let people log in. I could export the database periodically into an `authorized_keys` format and run a standard OpenSSH server. However, there are two problems.

The database of keys is (at the time of writing) 2 GB. I'm currently staying within the free tier of [Turso](https://turso.tech) for my database, and I would definitely burn through my row read allowance immediately if I did a full table scan every hour.

Also, hosting just like an Ubuntu server and letting people log in sounds...scary. I can make a user specifically for them, but even then I'm worried about people figuring out how to write files and leave...interesting things on the server. Or worse, getting privilege escalation and take over the server.

I now have to admit that the main point of this post is a lie. I have not created an `authorized_keys` file. Instead, to solve these problems, and to have a cool user interface for those who log in, I made a [Wish](https://github.com/charmbracelet/wish) app. Wish is part of the [Charm](https://charm.sh) ecosystem, which is a set of Golang libraries specializing in all things terminal and terminal UI. Wish takes advantage of the fact that SSH is just a protocol, like HTTP. Though we usually associate it with a secure remote user shell, the server can just return a string buffer of a terminal UI that responds to inputs. For example, you can browse a git server by running `ssh git.charm.sh`, or order coffee on the terminal by running `ssh terminal.shop`.

By creating an SSH app of my own, I don't need to worry about people getting privilege escalation. I can also write my own function to authenticate users by running a database query, which is indexed and runs instantly, rather than relying on an `authorized_keys` file which is specific to OpenSSH.

```go
wish.WithPublicKeyAuth(func(ctx ssh.Context, key ssh.PublicKey) bool {
    pubkey := PublicKeyToAuthString(key)

    var username string
    row := db.QueryRow("SELECT username FROM keys WHERE ssh_key = ?", pubkey)
    err := row.Scan(&username)
    if err != nil {
        log.Info("Failed login attempt", "pubkey", pubkey)
        return false
    }

    ctx.SetValue("username", username)
    ctx.SetValue("pubkey", pubkey)

    return true
}),
```

This middleware looks up the user by the public SSH key they present. If they're found, we inject their GitHub username and public key for future use while rendering. Then, I can write a little UI for it to show when you connect:

![The Wish app which shows statistics](/assets/public-ssh-keys/ssh.png)

I'd encourage you to try to connect too! Run `ssh keys.mbund.dev` now! Make sure to wave to the next person!

You can also read this same blog post in SSH too. And because I have no where else to put this, try to resize the window, and even switch the colorscheme of your terminal between light and dark (reconnection required). Responsive terminal/ssh apps are really cool!

## Statistics

As you might have seen from the screenshot above, the scanner collects statistics as it goes. Since you're reading this on the web version of this blog post, here are the live statistics:

A total of <span class="text-skin-accent" id="numUsers">n</span> users were found, with an additional <span class="text-skin-accent" id="numBots">n</span> bots.

There are <span class="text-skin-accent" id="numSshKeyUsers">n</span> users with at least one SSH key, making up <span class="text-skin-accent" id="percentUsers">n%</span> of GitHub users scanned. Users with at least one SSH key have, on average, <span class="text-skin-accent" id="avgKeysPerUser">n</span> keys.

Of <span class="text-skin-accent" id="numKeys">n</span> total SSH keys found, here is the distribution of key types:


- <span class="text-skin-accent"><span id="rsaKeyPercent">n</span>% (<span id="numRsaKeys">n</span>)</span> rsa keys
- <span class="text-skin-accent"><span id="ed25519KeyPercent">n</span>% (<span id="numEd25519Keys">n</span>)</span> ed25519 keys
- <span class="text-skin-accent"><span id="otherKeyPercent">n</span>% (<span id="numOtherKeys">n</span>)</span> other keys

<script>
  fetch("https://keys.mbund.dev/statistics.json").then(response => response.json().then(statistics => {
    document.getElementById("numBots").textContent = statistics.num_bots.toLocaleString();
    document.getElementById("numUsers").textContent = statistics.num_users.toLocaleString();
    document.getElementById("numSshKeyUsers").textContent = statistics.num_ssh_key_users.toLocaleString();
    document.getElementById("numKeys").textContent = statistics.num_keys.toLocaleString();

    document.getElementById("percentUsers").textContent = (statistics.num_ssh_key_users / statistics.num_users * 100).toFixed(2) + "%";
    document.getElementById("avgKeysPerUser").textContent = (statistics.num_keys / statistics.num_ssh_key_users).toFixed(2);

    document.getElementById("numRsaKeys").textContent = statistics.num_rsa_keys.toLocaleString();
    document.getElementById("rsaKeyPercent").textContent = (statistics.num_rsa_keys / statistics.num_keys * 100).toFixed(2);
    document.getElementById("numEd25519Keys").textContent = statistics.num_ed25519_keys.toLocaleString();
    document.getElementById("ed25519KeyPercent").textContent = (statistics.num_ed25519_keys / statistics.num_keys * 100).toFixed(2);
    const otherKeys = statistics.num_keys - (statistics.num_rsa_keys + statistics.num_ed25519_keys);
    document.getElementById("numOtherKeys").textContent = otherKeys.toLocaleString();
    document.getElementById("otherKeyPercent").textContent = (otherKeys / statistics.num_keys * 100).toFixed(2);
  }))
</script>

## Who has the most keys?

For privacy reasons I won't say _who_ has the most keys. But at the time of writing, the scanner has found someone with `2992` keys! Their `authorized_keys` file 8.3MB on its own! I really wonder why they need so many. And by the way, they are all RSA.

Also, their account was created 447 days ago, so on average they added 1 key every 4 hours since their account creation!

Here's what the query to find this looked like:

```sql
SELECT COUNT(*) as num_keys, username
FROM keys
GROUP BY username
ORDER BY num_keys DESC
LIMIT 100
```

## Opting out

If you're reading this and feel uncomfortable with me having your public SSH key, there are two ways to opt out. Opting out means that your keys are deleted from the database, and they will be prevented from being added back in the future. If you can log in with `ssh keys.mbund.dev`, press `o` to opt out. If your key hasn't been scanned yet and you can't log in, you can go to [keys.mbund.dev](https://keys.mbund.dev) on your browser, OAuth with GitHub to ensure that you are who you say you are, and switch the toggle off. When you OAuth, the only information you present is your username (no email or anything else, and also I can't do anything on your behalf). I do not store any extra information about the users decided to opt out, other than the fact that they did, so I won't even know what method you used.

In any case, you should remove your SSH keys from GitHub if you do not want them publicly available, and maybe also roll new ones if you are concerned for any reason. Though, again, they are public SSH keys so there is no security risk.

## Detecting bad actors

A large database like this one could potentially help identify bad actors who try to SSH in to servers. Before simply rejecting unknown keys, you could first look it up to see if they are known. This technique would deanonymize users behind VPNs too, since the key is presented through the connection. Overall, it would only work against amateur actors who have misconfigured their setup, but it would be very cheap to set up as a server admin so it still might be worth it.

## Back-associating more keys

SSH sessions have fingerprints, very similar to browsers. For example, you get the client's version, like `SSH-2.0-OpenSSH_9.8` which is similar to a `User-Agent` in the web world. You also get the username of the person connecting. And obviously, you get the remote connection's IP address. Once a connection is established, you can also get the width and height of the terminal they are connecting with, their `TERM` environment variable, color information, and more.

`ssh` will try your keys one at a time until hopefully one works. A new connection is formed for each key. So, on every connection attempt, you could cache connecting sessions by their client version, username, and IP for a few seconds, and gather all public keys tried that are likely the same person. If one of them matches a known key in your large database, you know that the other keys also belong to the same person, and can update the database to be even larger.

## Authentication

GitHub actually stops two users from uploading the same key. If you try, you get the following error:

![GitHub error: "Key is already in use"](/assets/public-ssh-keys/unique.png)

This means that if you host an SSH server and someone successfully logs in with a key on their GitHub, you can be sure it is them. There is no extra log in step. This is how my SSH app is able to tell you your GitHub username when you log in, since there is only one option! This makes a lot of sense too. This is how you can do a `git clone` over SSH, even to a private repo.

This also lets you query whether a particular key is found in GitHub very easily, though it doesn't tell you the username of who has the key.

## Renamed accounts

However the scanner does find multiple usernames with the same keys. This means someone renamed their GitHub account, and the scanner found the username before and after.

I won't share any usernames for privacy reasons, but the query is pretty simple:

```sql
SELECT k1.ssh_key, k1.username AS username1, k2.username AS username2 FROM keys AS k1 
JOIN keys AS k2 ON k1.ssh_key = k2.ssh_key 
WHERE k1.username < k2.username AND k1.ssh_key != '';
```

## Where is the source code? Can I have the database?

I won't be publishing the source code for this project. I don't want it to be trivial to spam GitHub's server using my tool. I've outlined more than enough information to reproduce it yourself if you have a good reason to. I also won't be publicly releasing the database. I will leave that to GitHub if they decide to, since theirs would be more complete, and less taxing on their servers. This project was for research purposes only. However, if you have an idea for a query that I should run, leave a comment below!

## Conclusion

This was a super fun project! If you have any other ideas for a large SSH key database be sure to leave them in the comments. And try to connect to `ssh keys.mbund.dev` if you have not already!

## Update

Well, it turns out that someone else did the same thing, but more efficiently 2 years ago: [whoami](https://words.filippo.io/dispatches/whoami-updated)

I still had fun making a beautiful TUI with the charm stack, and I got the chance to hone my Go skills. So, it was not for nothing. Hope you still enjoyed the post!
