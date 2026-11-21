/* Service worker do Cuide.
   Quando mudar qualquer arquivo do app, troque o número da versão abaixo
   (v2 -> v3 ...) pra os celulares baixarem a versão nova. */
const VERSAO = 'cuide-v3';

const ESSENCIAIS = ['./', './index.html', './manifest.webmanifest'];
const OPCIONAIS = [
  './fonts/archivo.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    await cache.addAll(ESSENCIAIS);
    // Fonte e ícones: se algum faltar, o app instala do mesmo jeito.
    await Promise.all(OPCIONAIS.map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

function guardar(cache, chave, resp) {
  if (resp && resp.ok && resp.type === 'basic') return cache.put(chave, resp.clone()).catch(() => {});
  return Promise.resolve();
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Só cuida dos arquivos do próprio site. A planilha (script.google.com) passa direto.
  if (url.origin !== self.location.origin) return;

  // Abrir o app (inclusive com ?r=muita etc.): entrega o index.html guardado e atualiza por trás.
  if (req.mode === 'navigate') {
    ev.respondWith((async () => {
      const cache = await caches.open(VERSAO);
      const guardado = await cache.match('./index.html');
      const rede = fetch('./index.html', { cache: 'no-cache' })
        .then((r) => guardar(cache, './index.html', r).then(() => r))
        .catch(() => null);
      if (guardado) { ev.waitUntil(rede); return guardado; }
      const r = await rede;
      return r || new Response('Sem internet. Abra o app uma vez com internet.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })());
    return;
  }

  // Demais arquivos: responde do cache na hora e busca a versão nova por trás.
  ev.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const guardado = await cache.match(req, { ignoreSearch: true });
    const rede = fetch(req)
      .then((r) => guardar(cache, req, r).then(() => r))
      .catch(() => null);
    if (guardado) { ev.waitUntil(rede); return guardado; }
    const r = await rede;
    return r || new Response('', { status: 504 });
  })());
});
