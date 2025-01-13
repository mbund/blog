import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    const response = await fetch("https://cloud.umami.is/script.js");
    const script = await response.text();

    return new Response(script, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return new Response("Error loading analytics script", {
      status: 500,
    });
  }
};
