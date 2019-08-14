const cacheName = "v1.1.1";

self.addEventListener('install', function(e) {
	console.log('install ServiceWorker');
	e.waitUntil(
		caches.open(cacheName).then(function(cache) {
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
			if(response) console.log('Using cached version of '+e.request.url);
			else console.log('Get resource '+e.request.url);
			return response || fetch(e.request).then((response) => {
				// Store result in the cache https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
				return caches.open(cacheName).then((cache) => {
					cache.put(event.request, response.clone());
					return response;
				});  
			});
		}).catch(function(error){
			return new Response('');
		})
	);
});

self.addEventListener('activate', (event) => {
	let cacheWhitelist = [cacheName] // the name of the new cache

	event.waitUntil(
		caches.keys().then (cacheNames => {
			return Promise.all(
				cacheNames.map( cacheName => {
					/* Deleting all the caches except the ones that are in cacheWhitelist array */
					if (cacheWhitelist.indexOf(cacheName) === -1) {
						return caches.delete(cacheName)
					}
				})
			)
		})
	)
})

self.addEventListener('message', function (event) {
	console.log('message to Service Worker',event)
	if(event.data.action === 'skipWaiting') self.skipWaiting();
});
