/**
 * ==========================================
 * FILE: sw.js
 * MODULE: PWA Service Worker
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Enterprise-grade service worker for 11 Avatar CRM.
 * Handles offline caching, push notifications, and background sync.
 * 
 * FEATURES:
 * - Cache all static assets
 * - Offline support
 * - Push notifications
 * - Background sync
 * - Update management
 * - Performance optimization
 * 
 * USAGE:
 * Registered in manifest.json and index.html
 * ==========================================
 */

// ==========================================
// VERSION & CONFIGURATION
// ==========================================

const CACHE_VERSION = 'v1.0.0';
const CACHE_PREFIX = '11avatar';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
    // Core HTML
    '/',
    '/index.html',
    '/dashboard.html',
    '/login.html',
    '/register.html',
    '/404.html',
    
    // CSS
    '/src/css/style.css',
    '/src/css/dashboard.css',
    '/src/css/components.css',
    '/src/css/responsive.css',
    '/src/css/themes/light.css',
    '/src/css/themes/dark.css',
    
    // JavaScript
    '/src/js/app.js',
    '/src/js/config.js',
    '/src/js/router.js',
    '/src/js/state.js',
    '/src/js/api.js',
    '/src/js/auth.js',
    '/src/js/components/Sidebar.js',
    '/src/js/components/Header.js',
    '/src/js/components/Modal.js',
    '/src/js/components/Table.js',
    '/src/js/components/Cards.js',
    '/src/js/components/Charts.js',
    '/src/js/utils/helpers.js',
    '/src/js/utils/validators.js',
    '/src/js/utils/formatters.js',
    
    // Icons
    '/assets/icons/icon-72x72.png',
    '/assets/icons/icon-96x96.png',
    '/assets/icons/icon-128x128.png',
    '/assets/icons/icon-144x144.png',
    '/assets/icons/icon-152x152.png',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-384x384.png',
    '/assets/icons/icon-512x512.png',
    '/assets/icons/favicon.ico',
    
    // Fonts
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Poppins:wght@400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
    
    // Manifest
    '/manifest.json',
    '/sw.js'
];

// API endpoints to cache (for offline mode)
const API_CACHE = [
    '/api/leads',
    '/api/customers',
    '/api/deals',
    '/api/tasks',
    '/api/invoices',
    '/api/whatsapp/messages'
];

// ==========================================
// INSTALL EVENT
// ==========================================

self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    
    // Skip waiting to activate immediately
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Caching app shell');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[ServiceWorker] Cache completed');
            })
            .catch((error) => {
                console.error('[ServiceWorker] Cache failed:', error);
            })
    );
});

// ==========================================
// ACTIVATE EVENT
// ==========================================

self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log('[ServiceWorker] Claiming clients');
            return self.clients.claim();
        })
    );
});

// ==========================================
// FETCH EVENT - CACHING STRATEGY
// ==========================================

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }
    
    // Handle API requests with network-first strategy
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleApiRequest(request));
        return;
    }
    
    // Handle static assets with cache-first strategy
    if (isStaticAsset(url)) {
        event.respondWith(handleStaticAsset(request));
        return;
    }
    
    // Handle HTML with network-first strategy
    if (isHtmlRequest(request)) {
        event.respondWith(handleHtmlRequest(request));
        return;
    }
    
    // Default: network-first with cache fallback
    event.respondWith(handleDefaultRequest(request));
});

// ==========================================
// REQUEST HANDLERS
// ==========================================

/**
 * Handle API requests - Network first, cache fallback
 */
async function handleApiRequest(request) {
    try {
        // Try network first
        const response = await fetch(request);
        
        // Cache successful responses
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        // Network failed - try cache
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        
        // Return error response
        return new Response(
            JSON.stringify({
                error: 'Offline - Please check your connection',
                offline: true
            }),
            {
                status: 503,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }
}

/**
 * Handle static assets - Cache first, network fallback
 */
async function handleStaticAsset(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        // Return fallback for images
        if (request.url.match(/\.(png|jpg|jpeg|svg|gif|ico)$/)) {
            return new Response('Image not available offline', {
                status: 404,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
        }
        throw error;
    }
}

/**
 * Handle HTML requests - Network first, cache fallback
 */
async function handleHtmlRequest(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        
        // Return offline page
        return caches.match('/offline.html');
    }
}

/**
 * Handle default requests
 */
async function handleDefaultRequest(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Check if request is for static asset
 */
function isStaticAsset(url) {
    const staticExtensions = [
        '.css', '.js', '.json', '.png', '.jpg', '.jpeg',
        '.svg', '.gif', '.ico', '.webp', '.woff', '.woff2',
        '.ttf', '.eot', '.mp4', '.webm', '.pdf'
    ];
    
    return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

/**
 * Check if request is for HTML
 */
function isHtmlRequest(request) {
    const url = new URL(request.url);
    const accept = request.headers.get('Accept') || '';
    
    return accept.includes('text/html') || 
           url.pathname === '/' || 
           !url.pathname.includes('.');
}

// ==========================================
// PUSH NOTIFICATIONS
// ==========================================

self.addEventListener('push', (event) => {
    console.log('[ServiceWorker] Push Received');
    
    let data = {
        title: '11 Avatar CRM',
        body: 'You have a new notification',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            url: '/dashboard.html'
        }
    };
    
    if (event.data) {
        try {
            data = Object.assign(data, event.data.json());
        } catch (error) {
            console.error('[ServiceWorker] Push data parse error:', error);
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            vibrate: data.vibrate,
            data: data.data,
            actions: [
                {
                    action: 'open',
                    title: 'Open'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss'
                }
            ]
        })
    );
});

// ==========================================
// NOTIFICATION CLICK
// ==========================================

self.addEventListener('notificationclick', (event) => {
    console.log('[ServiceWorker] Notification Click');
    
    event.notification.close();
    
    if (event.action === 'dismiss') {
        return;
    }
    
    const url = event.notification.data?.url || '/dashboard.html';
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        })
        .then((clientList) => {
            // Check if there's already a window/tab open with the target URL
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window/tab
            return clients.openWindow(url);
        })
    );
});

// ==========================================
// BACKGROUND SYNC
// ==========================================

// Register for background sync
self.addEventListener('sync', (event) => {
    console.log('[ServiceWorker] Sync:', event.tag);
    
    if (event.tag === 'sync-leads') {
        event.waitUntil(syncLeads());
    } else if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    } else if (event.tag === 'sync-invoices') {
        event.waitUntil(syncInvoices());
    }
});

/**
 * Sync leads data
 */
async function syncLeads() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        
        // Find pending sync requests
        const pending = requests.filter(req => 
            req.url.includes('/api/leads') && 
            req.method === 'POST'
        );
        
        for (const request of pending) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.delete(request);
                }
            } catch (error) {
                console.error('[ServiceWorker] Sync leads error:', error);
            }
        }
    } catch (error) {
        console.error('[ServiceWorker] Sync leads error:', error);
    }
}

/**
 * Sync messages data
 */
async function syncMessages() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        
        const pending = requests.filter(req => 
            req.url.includes('/api/whatsapp/messages') && 
            req.method === 'POST'
        );
        
        for (const request of pending) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.delete(request);
                }
            } catch (error) {
                console.error('[ServiceWorker] Sync messages error:', error);
            }
        }
    } catch (error) {
        console.error('[ServiceWorker] Sync messages error:', error);
    }
}

/**
 * Sync invoices data
 */
async function syncInvoices() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        
        const pending = requests.filter(req => 
            req.url.includes('/api/invoices') && 
            req.method === 'POST'
        );
        
        for (const request of pending) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.delete(request);
                }
            } catch (error) {
                console.error('[ServiceWorker] Sync invoices error:', error);
            }
        }
    } catch (error) {
        console.error('[ServiceWorker] Sync invoices error:', error);
    }
}

// ==========================================
// UPDATE MANAGEMENT
// ==========================================

// Check for updates periodically
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Log service worker events
console.log('[ServiceWorker] 11 Avatar CRM Service Worker Loaded');
console.log('[ServiceWorker] Version:', CACHE_VERSION);
console.log('[ServiceWorker] Cache Name:', CACHE_NAME);

// ==========================================
// OFFLINE SUPPORT
// ==========================================

// Create offline page if not exists
// This will be served when user is offline
// In production, create a dedicated offline.html

// ==========================================
// ERROR HANDLING
// ==========================================

self.addEventListener('error', (event) => {
    console.error('[ServiceWorker] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[ServiceWorker] Unhandled rejection:', event.reason);
});
