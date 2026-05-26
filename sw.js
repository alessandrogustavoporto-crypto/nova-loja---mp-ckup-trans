// ============================================================
// SERVICE WORKER — OTMake10 PWA
// Versão do cache: incrementar aqui força atualização em todos os clientes
// ============================================================
const CACHE_VERSION = 'otmake10-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Arquivos essenciais para cache imediato (shell da aplicação)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/supabase-config.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/carrinho.html',
    '/login.html',
    '/minha-conta.html',
    '/checkout.html',
    '/offline.html',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ---- INSTALL: pré-cache dos assets estáticos ----
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('[SW] Cache estático sendo populado...');
            // Usa addAll com fallback individual para não bloquear em erros de rede
            return Promise.allSettled(
                STATIC_ASSETS.map(url => cache.add(url).catch(err => {
                    console.warn(`[SW] Falha ao cachear ${url}:`, err.message);
                }))
            );
        }).then(() => self.skipWaiting())
    );
});

// ---- ACTIVATE: limpa caches antigos ----
self.addEventListener('activate', (event) => {
    console.log('[SW] Ativando Service Worker...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map(key => {
                        console.log('[SW] Removendo cache antigo:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ---- FETCH: estratégia Network-First para API, Cache-First para assets ----
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignora requisições não-GET e chamadas ao Supabase (sempre online)
    if (request.method !== 'GET') return;
    if (url.hostname.includes('supabase.co')) return;
    if (url.hostname.includes('supabase.io')) return;

    // Para navegação de páginas: Network-First com fallback offline
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Atualiza cache com a versão mais recente da página
                    const clone = response.clone();
                    caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
                    return response;
                })
                .catch(() => {
                    // Sem rede: tenta servir do cache, senão mostra tela offline
                    return caches.match(request)
                        .then(cached => cached || caches.match('/offline.html'));
                })
        );
        return;
    }

    // Para assets (CSS, JS, imagens, fontes): Cache-First
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;

            // Não está em cache: busca na rede e adiciona ao cache dinâmico
            return fetch(request).then(response => {
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response;
                }
                const clone = response.clone();
                caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
                return response;
            });
        })
    );
});
