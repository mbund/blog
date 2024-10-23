import { slugifyStr } from "@utils/slugify";
import Datetime from "./Datetime";
import type { CollectionEntry } from "astro:content";
import { useState, useEffect } from "react";

export interface Props {
  href: string;
  frontmatter: CollectionEntry<"blog">["data"];
  secHeading?: boolean;
}

let cachedData: PlausibleAPIResponse | null = null;
let isFetching = false;
const analyticsFetch = new Promise<PlausibleAPIResponse>(resolve => {
  if (!isFetching) {
    isFetching = true;
    fetch("https://plausible.mbund.org/api/stats/mbund.dev/pages?period=30d")
      .then(res => res.json())
      .then((data: PlausibleAPIResponse) => {
        cachedData = data;
        resolve(data);
      });
  }
});

function useIsHot(href: string) {
  const [hot, setHot] = useState(false);

  useEffect(() => {
    if (cachedData) {
      processData(cachedData);
    } else {
      analyticsFetch.then(processData);
    }
  }, [href]);

  function processData(data: PlausibleAPIResponse) {
    const hottestPost = data.results
      .filter(result => result.name.startsWith("/posts/"))
      .sort((a, b) => b.visitors - a.visitors)[0];

    if (hottestPost.name === href) {
      setHot(true);
    }
  }

  return hot;
}

export default function Card({ href, frontmatter, secHeading = true }: Props) {
  const { title, pubDatetime, modDatetime, description, readingTime } =
    frontmatter;

  const headerProps = {
    style: { viewTransitionName: slugifyStr(title) },
    className: "text-lg font-medium decoration-dashed hover:underline",
  };

  const hot = useIsHot(href || "");

  return (
    <li className="my-6">
      <div className="flex justify-between">
        <a
          href={href}
          className="inline-block text-lg font-medium text-skin-accent decoration-dashed underline-offset-4 focus-visible:no-underline focus-visible:underline-offset-0"
        >
          {secHeading ? (
            <h2 {...headerProps}>{title}</h2>
          ) : (
            <h3 {...headerProps}>{title}</h3>
          )}
        </a>
        {hot && <>🔥 Hot Post!</>}
      </div>
      <Datetime
        pubDatetime={pubDatetime}
        modDatetime={modDatetime}
        readingTime={readingTime}
      />
      <p>{description}</p>
    </li>
  );
}

type PlausibleAPIResponse = {
  results: {
    name: string;
    visitors: number;
  }[];
  skip_imported_reason: string;
};
