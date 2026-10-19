/** Development-only entry, substituted by Vite's HTML transform. */
async function removeDevelopmentWorker() {
  if (!("serviceWorker" in navigator)) return false;
  const base = new URL(import.meta.env.BASE_URL, location.origin);
  const isAppWorker = (worker?: ServiceWorker | null) => {
    if (!worker) return false;
    const script = new URL(worker.scriptURL);
    return (
      script.origin === location.origin &&
      ["dev-sw.js", "serviceWorker.js"].some(
        (name) => script.pathname === `${base.pathname}${name}`,
      )
    );
  };
  const controlled = isAppWorker(navigator.serviceWorker.controller);
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter(
        (registration) =>
          isAppWorker(registration.active) ||
          isAppWorker(registration.waiting) ||
          isAppWorker(registration.installing),
      )
      .map((registration) => registration.unregister()),
  );
  if ("caches" in window) {
    // Only this app's Workbox cache; account data and saved layouts use IndexedDB.
    await Promise.all(
      (await caches.keys())
        .filter(
          (name) => name.startsWith("workbox-") && name.includes(base.href),
        )
        .map((name) => caches.delete(name)),
    );
  }
  return controlled;
}

const reloadKey = "bofonasu:dev-worker-reload";
let wasControlled = false;
try {
  wasControlled = await removeDevelopmentWorker();
} catch (error) {
  console.warn("Não foi possível remover o worker de desenvolvimento:", error);
}
if (wasControlled && !sessionStorage.getItem(reloadKey)) {
  sessionStorage.setItem(reloadKey, "1");
  location.reload();
} else {
  sessionStorage.removeItem(reloadKey);
  await import("./index");
}

export {};
