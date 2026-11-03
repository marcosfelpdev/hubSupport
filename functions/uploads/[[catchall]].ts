// Proxy do Cloudflare Pages para uploads no Render / R2
export async function onRequest(context: { request: Request }) {
  const url = new URL(context.request.url);
  const targetUrl = `https://hubsupport-api.onrender.com${url.pathname}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.set("host", "hubsupport-api.onrender.com");

  return fetch(targetUrl, {
    method: context.request.method,
    headers,
    redirect: "follow",
  });
}
