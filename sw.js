self.addEventListener('install', function(e) {
	console.log('install ServiceWorker');
	e.waitUntil(
		caches.open('video-store').then(function(cache) {
			return cache.addAll([
				'/bins/',
				'/bins/index.html',
				'/bins/resources/banner.jpg',
				'/bins/resources/stuquery.js',
				'/bins/resources/bins.css',
				'/bins/resources/bins.js',
				'/bins/data/list.json',
				'/bins/data/leeds/index.csv'
			]);
		})
	);
});

/* Evaluates the fetch request and checks to see if it is in the cache.
   The response is passed back to the webpage via event.respondWith() */
self.addEventListener('fetch', function(e) {
	console.log('fetch '+e.request.url);
	e.respondWith(
		caches.match(e.request).then(function(response) {
			return response || fetch(e.request);
		})
	);
});

