/* global self, caches, Request, URL, fetch, Response */
/* Offline-only cache. Bump this version when the offline bundle changes. */
const CACHE_NAME = "tuktak-offline-v1";
const OFFLINE = "/offline/index.html";
const RESOURCES = [OFFLINE, "/offline/hind-siliguri-bengali-400.woff2"];
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(
        RESOURCES.map(
          (url) => new Request(url, { credentials: "omit", cache: "reload" }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("tuktak-offline-") && key !== CACHE_NAME)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method === "GET" &&
    url.origin === self.location.origin &&
    !url.search &&
    RESOURCES.includes(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(url.pathname)) ?? fetch(request);
      })(),
    );
    return;
  }
  // No API, private/auth utility, RSC, mutation, asset or cross-origin interception.
  const publicPage =
    ["/", "/discover", "/privacy", "/terms", "/community"].includes(
      url.pathname,
    ) || /^\/(post|u|tag)\/[^/]+\/?$/.test(url.pathname);
  if (
    request.method !== "GET" ||
    request.mode !== "navigate" ||
    url.origin !== self.location.origin ||
    !publicPage
  )
    return;
  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        // Never store the live response or manufacture current social data.
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(OFFLINE)) ?? Response.error();
      }
    })(),
  );
});
