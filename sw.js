self.addEventListener('install', function(e) {
	console.log('install ServiceWorker');
	//if("Notification" in window){
	//	console.log('has Notification');
	//}
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

self.addEventListener('fetch', function(e) {
	console.log('fetch '+e.request.url);
	e.respondWith(
		caches.match(e.request).then(function(response) {
			return response || fetch(e.request);
		})
	);
});

