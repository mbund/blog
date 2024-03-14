import type { Site, SocialObjects } from "./types";

export const SITE: Site = {
  website: "https://mbund.dev/",
  author: "Mark Bundschuh",
  desc: "Computer Science and Engineering Student at the Ohio State University. I like to write about my projects and things I've learned.",
  title: "Mark's Blog",
  ogImage: "og.png",
  lightAndDarkMode: true,
  postPerPage: 3,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
};

export const LOCALE = {
  lang: "en", // html lang code. Set this empty and default will be "en"
  langTag: ["en-EN"], // BCP 47 Language Tags. Set this empty [] to use the environment default
} as const;

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
    href: "https://linkedin.com/in/mark-bundschuh",
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
