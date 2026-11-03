// Proxy do Cloudflare Pages para a API Node.js no Render
export async function onRequest(context: { request: Request }) {
  const url = new URL(context.request.url);
  const targetUrl = `https://hubsupport-api.onrender.com${url.pathname}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.set("host", "hubsupport-api.onrender.com");

  const method = context.request.method;
  const hasBody = !["GET", "HEAD"].includes(method);

  const init: RequestInit = {
    method,
    headers,
    redirect: "follow",
  };

  if (hasBody) {
    init.body = context.request.body;
    // @ts-ignore
    init.duplex = "half";
  }

  return fetch(targetUrl, init);
}
