import type { Site, SocialObjects } from "./types";

export const SITE: Site = {
  website: "https://mbund.dev/",
  author: "Mark Bundschuh",
  desc: "Computer Science and Engineering Student at the Ohio State University. I like to write about my projects and things I've learned.",
  title: "Mark's Blog",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerPage: 5,
};

export const LOCALE = ["en-US"];

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/mbund",
    linkTitle: `Mark on Github`,
    active: true,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/mark-bundschuh-18a27a26a",
    linkTitle: `Mark on LinkedIn`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:mark@mbund.dev",
    linkTitle: `Send an email to Mark`,
    active: true,
  },
];
