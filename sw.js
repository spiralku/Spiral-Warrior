const AUDIO_CACHE = 'spiral-warrior-audio-v1';
const IMAGE_CACHE = 'spiral-warrior-images-v2';

const AUDIO_FILES = [
    './bgm_home.mp3',
    './bgm_tower.mp3',
    './bgm_championship.mp3',
    './arena_1.mp3',
    './arena_2.mp3',
    './arena_3.mp3',
    './arena_4.mp3',
    './arena_5.mp3',
    './arena_6.mp3',
    './arena_7.mp3'
];

// Optional assets are cached individually during install. A missing PNG will not
// prevent the Service Worker from installing, and future PNG requests are cached
// automatically by handleImageRequest().
const IMAGE_FILES = [
    './actual_arena.png',
    './stadium_arena.png',
    ...Array.from({ length: 12 }, (_, index) => `./actual_arena_${index + 1}.png`),
    ...Array.from({ length: 12 }, (_, index) => `./stadium_arena_${index + 1}.png`),
    './bc_behemoth.png',
    './bc_kaguyahime.png',
    './bc_athena.png',
    './bc_atlas.png',
    './bc_hattori_hanzo.png',
    './bc_atum.png',
    './bc_beelzebub.png',
    './bc_chronos.png',
    './bc_death_knight.png',
    './bc_mermaid.png',
    './bc_camus.png',
    './bc_hodur.png',
    './bc_mercury.png',
    './bc_venus.png',
    './bc_plague_knight.png',
    './bc_himiko.png',
    './bc_valkyrie.png',
    './bc_baldr.png',
    './bc_bubble.png',
    './bc_thor.png',
    './bc_justice.png',
    './bc_survivor.png',
    './bc_phoenix.png',
    './bc_lucifer.png',
    './bc_puppeteer.png',
    './bc_laurel_wreath.png',
    './bc_thetis.png',
    './bc_pallas.png',
    './bc_nilthotep.png',
    './bc_dr_greek.png',
    './bc_shura.png',
    './bc_qing.png',
    './bc_alice.png'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const audioCache = await caches.open(AUDIO_CACHE);
        await audioCache.addAll(AUDIO_FILES);

        const imageCache = await caches.open(IMAGE_CACHE);
        await Promise.all(
            IMAGE_FILES.map(async file => {
                try {
                    await imageCache.add(file);
                } catch (error) {
                    // Optional SW artwork is allowed to be absent.
                    console.warn('Optional image asset unavailable:', file);
                }
            })
        );
    })());

    self.skipWaiting();
});

self.addEventListener('activate', event => {
    const validCaches = new Set([AUDIO_CACHE, IMAGE_CACHE]);

    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => !validCaches.has(key))
                    .map(key => caches.delete(key))
            )
        )
    );

    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    if (url.pathname.endsWith('.mp3')) {
        event.respondWith(handleAudioRequest(request));
        return;
    }

    if (url.pathname.endsWith('.png')) {
        event.respondWith(handleImageRequest(request));
    }
});

async function handleImageRequest(request) {
    const cache = await caches.open(IMAGE_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            await cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        return new Response('', {
            status: 503,
            statusText: 'Image unavailable'
        });
    }
}

async function handleAudioRequest(request) {
    const cache = await caches.open(AUDIO_CACHE);

    // Always look up the original URL without a Range header.
    const cacheKey = new Request(request.url);
    let cachedResponse = await cache.match(cacheKey);

    // If it is not cached yet, download and cache the complete MP3.
    if (!cachedResponse) {
        const networkResponse = await fetch(cacheKey);

        if (!networkResponse.ok) {
            return networkResponse;
        }

        await cache.put(cacheKey, networkResponse.clone());
        cachedResponse = networkResponse;
    }

    const range = request.headers.get('Range');
    if (!range) {
        return cachedResponse;
    }

    const buffer = await cachedResponse.arrayBuffer();
    const totalLength = buffer.byteLength;
    const match = range.match(/bytes=(\d+)-(\d*)/);

    if (!match) {
        return cachedResponse;
    }

    const start = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : totalLength - 1;
    const end = Math.min(requestedEnd, totalLength - 1);

    if (start >= totalLength || start > end) {
        return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${totalLength}` }
        });
    }

    const slicedBuffer = buffer.slice(start, end + 1);
    const contentType = cachedResponse.headers.get('Content-Type') || 'audio/mpeg';

    return new Response(slicedBuffer, {
        status: 206,
        statusText: 'Partial Content',
        headers: {
            'Content-Type': contentType,
            'Content-Length': String(slicedBuffer.byteLength),
            'Content-Range': `bytes ${start}-${end}/${totalLength}`,
            'Accept-Ranges': 'bytes'
        }
    });
}
