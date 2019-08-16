const cacheName = "v7";
let reminders;
let checker;
const interval = 10000;
let inadvance;
let address;

function checkReminders(){
	console.log('checkReminders',reminders);
	let now = new Date();
	for(key in reminders){
		if(reminders[key]){
			wait = reminders[key].data.date - now;
			// If message is within the current day
			if(typeof inadvance!=="number") advance = 0;
			if(wait < inadvance){
				let title = "Put your "+reminders[key].data.bin.toLowerCase()+' bin out';
				let options = {}
				if(reminders[key].data.nicedate) options.body = reminders[key].data.nicedate;
				if(reminders[key].data.date) options.timestamp = reminders[key].data.date.getTime();
				if(reminders[key].data.icon) options.icon = reminders[key].data.icon;
				if(reminders[key].data.badge) options.badge = reminders[key].data.badge;
				self.registration.showNotification(title, options);
				delete reminders[key];
			}else{
				console.log('waiting '+((wait)/86400000).toFixed(2)+' days to post '+key);
			}
		}
	}

	return true;
}

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
	console.log('install');
	reminders = {};
	inadvance = 86400000/2;
});


self.addEventListener('activate', function(e){
	console.log('activate');
	let cacheWhitelist = [cacheName] // the name of the new cache

	e.waitUntil(
		caches.keys().then (cacheNames => {
			return Promise.all(
				cacheNames.map( cacheName => {
					/* Deleting all the caches except the ones that are in cacheWhitelist array */
					if(cacheWhitelist.indexOf(cacheName) === -1){
						return caches.delete(cacheName)
					}
				})
			)
		})
	);
	checker = setInterval(checkReminders,interval);
});


/* Evaluates the fetch request and checks to see if it is in the cache.
   The response is passed back to the webpage via event.respondWith() */
self.addEventListener('fetch', function(e){
	console.log('fetch '+e.request.url);
	e.respondWith(
		caches.match(e.request).then(function(response) {
			if(response) console.log('Using cached version of '+e.request.url);
			else console.log('Get resource '+e.request.url);
			return response || fetch(e.request)
		})
	);
});

self.addEventListener('message', function(e){
	console.log('Received message in Service Worker',e.data);
	let data = (typeof e.data==="string") ? JSON.parse(e.data) : e.data;
	function getKey(d){
		return (d.date ? d.date.toISOString().substr(0,10) : 'default');
	}
	if(data.command === 'reminders'){
		let _worker = self;
		let i,d,key;
		// Remove existing reminders
		delete reminders;
		for(i = 0; i < data.events.length; i++){
			d = data.events[i];
			if(d.date) d.date = new Date(d.date);
			key = getKey(d);
			reminders[key] = {'data':d};
		}
		clearInterval(checker);
		checkReminders();
		checker = setInterval(checkReminders,interval);
		console.log('reminders',reminders);
	}/*else if(data.command === 'setAddress'){
		console.log('setAddress received by Worker',data,e.source);
		address = data.address;
		e.source.postMessage({'command':data.command,'address':address});
	}else if(data.command === 'getAddress'){
		console.log('getAddress received by Worker',address);
		e.source.postMessage({'command':data.command,'address':address});
	}*/
});

