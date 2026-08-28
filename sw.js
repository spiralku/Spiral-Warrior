const AUDIO_CACHE = 'spiral-warrior-audio-v1';

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

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(AUDIO_CACHE)
            .then(cache => cache.addAll(AUDIO_FILES))
    );

    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== AUDIO_CACHE)
                    .map(key => caches.delete(key))
            )
        )
    );

    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const request = event.request;

    // Only handle audio files.
    const url = new URL(request.url);

    if (!url.pathname.endsWith('.mp3')) {
        return;
    }

    event.respondWith(handleAudioRequest(request));
});

async function handleAudioRequest(request) {
    const cache = await caches.open(AUDIO_CACHE);

    // Always look up the original URL without a Range header.
    const cacheKey = new Request(request.url);
    let cachedResponse = await cache.match(cacheKey);

    // If it isn't cached yet, download and cache the complete MP3.
    if (!cachedResponse) {
        const networkResponse = await fetch(cacheKey);

        if (!networkResponse.ok) {
            return networkResponse;
        }

        await cache.put(cacheKey, networkResponse.clone());
        cachedResponse = networkResponse;
    }

    // Normal request — just return the cached MP3.
    const range = request.headers.get('Range');

    if (!range) {
        return cachedResponse;
    }

    // Read the complete cached MP3.
    const buffer = await cachedResponse.arrayBuffer();
    const totalLength = buffer.byteLength;

    // Parse "bytes=start-end".
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
            headers: {
                'Content-Range': `bytes */${totalLength}`
            }
        });
    }

    const slicedBuffer = buffer.slice(start, end + 1);

    const contentType =
        cachedResponse.headers.get('Content-Type') || 'audio/mpeg';

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