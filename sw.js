self.addEventListener('install', function(e) {
	e.waitUntil(
		caches.open('video-store').then(function(cache) {
			return cache.addAll([
				'/bins/',
				'/bins/index.html',
				'/bins/stuquery.js',
				'/bins/bins.css',
				'/bins/bins.js',
				'/bins/data/list.json',
				'/bins/data/leeds/index.csv'
			]);
		})
	);
});

self.addEventListener('fetch', function(e) {
	console.log(e.request.url);
	e.respondWith(
		caches.match(e.request).then(function(response) {
			return response || fetch(e.request);
		})
	);
});

