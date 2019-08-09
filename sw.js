self.addEventListener('install', function(e) {
	e.waitUntil(
		caches.open('video-store').then(function(cache) {
			return cache.addAll([
				'/projects/bins/',
				'/projects/bins/index.html',
				'/projects/bins/stuquery.js',
				'/projects/bins/bins.css',
				'/projects/bins/bins.js',
				'/projects/bins/data/list.json',
				'/projects/bins/data/leeds/index.csv'
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

