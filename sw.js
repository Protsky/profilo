// Service worker: mette in cache i file dell'app perché funzioni anche senza
// rete. Non tocca le risposte, che stanno in localStorage e non passano di qui.
//
// La cache è "prima la rete, poi la copia": in sviluppo si vede subito la
// modifica appena fatta, e offline si vede l'ultima versione scaricata. Il
// contrario (prima la copia) sarebbe più veloce ma nasconderebbe i cambiamenti,
// ed è il modo classico per passare mezz'ora a chiedersi perché una correzione
// non si vede.

const CACHE = "profilo-v2";

const FILE = [
  "./",
  "./index.html",
  "./test.html",
  "./profilo.html",
  "./selftest.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png",
  "./icon-512-maskable.png",
  "./js/accoglienza.js",
  "./js/batteria.js",
  "./js/somministra.js",
  "./js/profilo.js",
  "./js/punteggi.js",
  "./js/validita.js",
  "./js/sicurezza.js",
  "./js/predittivo.js",
  "./js/referto.js",
  "./js/grafici.js",
  "./js/storage.js",
  "./js/esporta.js",
  "./js/norme.js",
  "./js/selftest.js",
  "./js/strumenti/bfas.js",
  "./js/strumenti/pid5bf.js",
  "./js/strumenti/phq9.js",
  "./js/strumenti/gad7.js",
  "./js/strumenti/asrm.js",
  "./js/strumenti/mdq.js",
  "./js/strumenti/pq16.js",
  "./js/strumenti/asrs5.js",
  "./js/strumenti/aq10.js",
  "./js/strumenti/pcptsd5.js",
  "./js/strumenti/auditc.js",
  "./js/strumenti/isi.js",
  "./js/strumenti/whodas12.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // addAll fallisce tutto se un file solo manca: qui si aggiunge uno per
      // uno, così un file rinominato non impedisce all'app di andare offline.
      Promise.all(FILE.map((f) => c.add(f).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((risposta) => {
        const copia = risposta.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia)).catch(() => {});
        return risposta;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});
