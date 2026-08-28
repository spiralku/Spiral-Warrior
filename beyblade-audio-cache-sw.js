const AUDIO_CACHE_NAME = 'beyblade-audio-v1';

const AUDIO_ASSETS = [
  './bgm_home.mp3',
  './bgm_tower.mp3',
  './bgm_championship.mp3',
  './arena_1.mp3',
  './arena_2.mp3',
  './arena_3.mp3',
  './arena_4.mp3',
  './arena_5.mp3',
  './arena_6.mp3',
  './arena_7.mp3',
  './menu_sfx_enemychosen.mp3',
  './sfx_launcher.mp3',
  './sfx_collide.mp3',
  './sfx_impact.mp3',
  './sfx_preemptive_attack.mp3',
  './sfx_rush.mp3',
  './sfx_launch.mp3',
  './sfx_projectile_hit.mp3',
  './menu_sfx_click.mp3',
  './menu_sfx_click_gear.mp3',
  './menu_sfx_upgrade.mp3',
  './bc_behemoth_1.mp3',
  './bc_behemoth_2.mp3',
  './bc_kaguyahime_1.mp3',
  './bc_athena_1.mp3',
  './bc_atlas_1.mp3',
  './bc_atum_1.mp3',
  './bc_atum_2.mp3',
  './bc_beelzebub_1.mp3',
  './bc_beelzebub_2.mp3',
  './bc_chronos_1.mp3',
  './bc_mermaid_1.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    // Cache files independently so one missing optional MP3 does not break the worker install.
    await Promise.all(AUDIO_ASSETS.map(async asset => {
      try {
        await cache.add(new Request(asset, { cache: 'reload' }));
      } catch (error) {
        console.warn('[Beyblade audio cache] Could not cache', asset, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('beyblade-audio-') && key !== AUDIO_CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const isAudioRequest = request.method === 'GET' &&
    (request.destination === 'audio' || /\.mp3$/i.test(url.pathname));

  if (!isAudioRequest) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') {
        const cache = await caches.open(AUDIO_CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return new Response('', { status: 503, statusText: 'Audio unavailable offline' });
    }
  })());
});
