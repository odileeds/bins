/**
  Created August 7th 2019 by Stuart Lowe (ODI Leeds)
  Last updated 15th July 2021
**/
(function(root){

	var ODI = root.ODI || {};

	// Version 1.1
	ODI.ready = function(fn){ if(document.readyState != 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); };
	// Version 1.2 (minified)
	function AJAX(t,e){e||(e={});var s=new XMLHttpRequest;return"responseType"in s&&e.dataType&&(s.responseType=e.dataType),s.open(e.method||"GET",t+(null===typeof e.cache||"boolean"==typeof e.cache&&!e.cache?"?"+Math.random():""),!0),s.onload=function(s){if(this.status>=200&&this.status<400){var o=this.response;"function"==typeof e.success&&e.success.call(e.this||this,o,{url:t,data:e,originalEvent:s})}else"function"==typeof e.error&&e.error.call(e.this||this,s,{url:t,data:e})},"function"==typeof e.error&&(s.onerror=function(s){e.error.call(e.this||this,s,{url:t,data:e})}),s.send(),this}
	if(!ODI.ajax) ODI.ajax = AJAX;

	function Bins(inp){

		this.inp = (inp || {});
		if(!this.inp.input) this.inp.input = 'locate';
		if(!this.inp.output) this.inp.output = 'results';
		this.el = { 'input': document.getElementById(this.inp.input), 'output': document.getElementById(this.inp.output) };
		this.name = "Leeds bin dates";
		this.title = "Bins";
		this.version = "0.1.1";
		this.premises = [];
		this.files = [];
		this.address = {};
		this.index = {'file':'data/leeds/index.csv'};
		this.logging = (location.search.indexOf('debug=true')>0);
		this.svg = { 'edit': '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" style="position:relative;top:0.125em;right:-0.5em;" viewBox="0 0 20 20"><title>edit</title><path style="color:black;" d="M16.77 8l1.94-2a1 1 0 0 0 0-1.41l-3.34-3.3a1 1 0 0 0-1.41 0L12 3.23zm-5.81-3.71L1 14.25V19h4.75l9.96-9.96-4.75-4.75z"/></svg>' };
		this.settings = {'notifications':{'ready':false,'enabled':false}};

		this.bins = {
			'B':{'text':'General waste','cls':'b2-bg','svg':'https://www.leeds.gov.uk/_catalogs/masterpage/public/images/bins_black.svg','url':'https://www.leeds.gov.uk/residents/bins-and-recycling/your-bins/black-bin'},
			'G':{'text':'Recycling','cls':'c6-bg','svg':'https://www.leeds.gov.uk/_catalogs/masterpage/public/images/bins_green.svg','url':'https://www.leeds.gov.uk/residents/bins-and-recycling/your-bins/green-recycling-bin'},
			'R':{'text':'Garden waste','cls':'c15-bg','svg':'https://www.leeds.gov.uk/_catalogs/masterpage/public/images/bins_brown.svg','url':'https://www.leeds.gov.uk/residents/bins-and-recycling/your-bins/brown-garden-waste-bin'},
			'F':{'text':'Food','cls':'c9-bg','svg':'https://www.leeds.gov.uk/_catalogs/masterpage/public/images/bins_food.svg','url':'https://www.leeds.gov.uk/residents/bins-and-recycling/your-bins/food-waste-bin'}
		}

		if(console) console.log('%c'+this.title+' v'+this.version+'%c','font-weight:bold;font-size:1.25em;','');

		/* Set up the Service Worker */
		let deferredPrompt;
		this.worker;
		var _obj = this;
		if('serviceWorker' in navigator){
			navigator.serviceWorker.register('sw.js',{'scope':'./'}).then(function(registration){
				_obj.worker = (registration.installing || registration.active);
				_obj.log('Service worker registered in scope '+registration.scope);		
			}).catch(function(error){
				_obj.log('ERROR','Service worker failed to register with error '+error);
			});
		
			// Handler for messages coming from the service worker
			navigator.serviceWorker.addEventListener('message', function handler(e){
				if(e.source !== _obj.worker) return;
				_obj.log('heard',e.data);
				/*
				if(e.data.command == "getAddress" && e.data.address){
					_obj.address = e.data.address;
					_obj.el.input.find('#place-street')[0].value = _obj.address.streetname+', '+_obj.address.locality;
					_obj.processStreet(function(){
						if(this.el.input.find('.searchresults li').length==1){
							i = parseInt(this.el.input.find('.searchresults li').attr('data-id'));
							if(this.premises[i].street == this.address.streetname && this.premises[i].locality == this.address.locality){
								this.selectStreet(i);
								this.el.input.find('#place-number')[0].value = _obj.address.number;
								this.processNumber(function(){
									if(this.el.input.find('.searchresults li').length==1){
										i = this.address.street;
										n = parseInt(this.el.input.find('.searchresults li').attr('data-n'));
										if(this.address.street==i && this.address.n==n) this.selectStreetNumber(n);
									}
								});
							}
						}
					});
				}*/
			});
		}
		
		window.addEventListener('beforeinstallprompt', function(e){
			_obj.log('beforeinstallprompt');
			// Stash the event so it can be triggered later.
			deferredPrompt = e;
			e.userChoice.then(function(outcome) { 
				console.log(outcome); // either "accepted" or "dismissed"
			}, function(){ _obj.log('ERROR','Something went wrong with user choice'); });
		});

		
		// Update network status
		updateNetworkStatus();
		window.addEventListener('online', updateNetworkStatus, false);
		window.addEventListener('offline', updateNetworkStatus, false);
		function updateNetworkStatus(){
			var h = document.querySelector('header');
			if(navigator.onLine){
				h.classList.remove('b4-bg');
				h.classList.add('c14-bg');
			}else{
				h.classList.remove('c14-bg');
				h.classList.add('b4-bg');
			}
		}

		this.init();

		return this;
	};

	Bins.prototype.message = function(msg,attr){
		if(msg) this.log('INFO',msg);

		var msgel = this.el.output.parentNode.querySelector('.message');
		
		if(!attr) attr = {'id':'default'};
		if(!msg){
			if(msgel){
				// Remove the specific message container
				if(msgel.querySelector('#'+attr.id)) removeEl(msgel.querySelector('#'+attr.id));
				// Remove the whole message container if there is nothing left
				if(msgel.innerHTML==""){
					removeEl(msgel);
					this.el.output.parentNode.style['padding-bottom'] = '';
				}
			}
		}else if(msg){
			// If there is no message container, we make that now
			if(!msgel){
				msgel = document.createElement('div');
				msgel.classList.add('message','c14-bg');
				this.el.output.insertAdjacentElement('afterend', msgel);
			}
			div = msgel.querySelector('#'+attr.id);
			// We make a specific message container
			if(!div){
				div = document.createElement('div');
				div.setAttribute('id',attr.id);
				msgel.appendChild(div);
			}
			div.innerHTML = msg;
			var n = this.el.output.parentNode.querySelectorAll('.message > div').length;
			this.el.output.parentNode.style['padding-bottom'] = (2*n + 2)+'em';
		}

		return this;
	};

	Bins.prototype.log = function(){
		// Version 1.2
		if(this.logging || arguments[0]=="ERROR" || arguments[0]=="WARNING"){
			var t,m,args,extra,i;
			args = Array.prototype.slice.call(arguments, 0);
			t = args[0];
			if(t != "ERROR" && t!= "WARNING" && t!="INFO") t = "";
			if(t){
				m = args[1];
				i = 2;
			}else{
				m = args[0];
				i = 1;
			}
			// Build basic result
			extra = ['%c'+this.title+'%c: '+m,'font-weight:bold;',''];
			// If there are extra parameters passed we add them
			if(args.length > i) extra = extra.concat(args.splice(i));
			if(console && typeof console.log==="function"){
				if(t == "ERROR") console.error.apply(null,extra);
				else if(t == "WARNING") console.warn.apply(null,extra);
				else if(t == "INFO") console.info.apply(null,extra);
				else console.log.apply(null,extra);
			}
		}
		return this;
	};

	Bins.prototype.getIndex = function(){
		if(this.index.loading || this.index.loaded) return this;
		this.index.loading = true;
		ODI.ajax(this.index.file,{
			"dataType": "text",
			"this": this,
			"cache": false,
			"success": function(d){
				this.index.loaded = true;
				delete this.index.loading;
				var rows = CSVToArray(d);
				for(var i = 0; i < rows.length; i++){
					range = (rows[i][0].split(/-/));
					if(rows[i][1]){
						this.files.push({'from':range[0],'to':range[1],'file':rows[i][1],'jobs':rows[i][1].replace(/^(.*)premises(.*)$/,function(m,p1,p2){ return p1+'jobs'+p2; })});
					}
				}
				this.message('',{'id':'index'});
				removeEl(this.el.input.querySelectorAll('.spinner'));
				this.getAddress();
			},
			"error": function(e,attr){
				this.log('ERROR','Unable to load '+attr.url);
			}
		});
		return this;
	}

	Bins.prototype.init = function(){

		// Create some HTML to fill later
		var list = document.createElement('div');
		list.classList.add('list');
		this.el.output.appendChild(list);

		addEvent('click',document.querySelectorAll('.bg'),{},function(e){
			document.getElementById('hamburger').checked = false;
		});

		var el = this.el.input.querySelector('.placesearch');
		var focus = false;

		addEvent('submit',el.querySelector('form'),{},function(e){ e.preventDefault(); });
		addEvent('click',el.querySelector('.submit'),{},function(e){
			if(!focus) on();
			else off();
		});

		function on(){
			focus = true;
			el.classList.add('typing');
			el.querySelector('#place-number').focus();
		}
		function off(){
			focus = false;
			el.classList.remove('typing');
		}

		this.getIndex();
		
		function searchResultsSelect(keyCode){
			var li = el.querySelectorAll('.searchresults li');
			var s = -1;
			for(var i = 0; i < li.length; i++){
				if(li[i].classList.contains('selected')) s = i;
			}
			if(keyCode==40) s++;
			else s--;
			if(s < 0) s = li.length-1;
			if(s >= li.length) s = 0;
			el.querySelector('.searchresults .selected').classList.remove('selected');
			li[s].classList.add('selected');
		}

		addEvent('keyup',el.querySelector('#place-street'),{me:this},function(e){
			e.preventDefault();
			me = e.data.me;
			if(e.keyCode==40 || e.keyCode==38) searchResultsSelect(e.keyCode);
			else if(e.keyCode==13) me.selectStreet(el.querySelector('.searchresults .selected').getAttribute('data-id'));
			else me.processStreet();
		});
		
		el.querySelector('.place-number').style.display = 'none';
		addEvent('keyup',el.querySelector('#place-number'),{me:this},function(e){
			e.preventDefault();
			me = e.data.me;
			if(e.keyCode==40 || e.keyCode==38) searchResultsSelect(e.keyCode);
			else if(e.keyCode==13) me.selectStreetNumber(el.querySelector('.searchresults .selected').getAttribute('data-n'));
			else me.processNumber();
		});
		
		addEvent('click',document.querySelectorAll('header nav a'),{me:this},function(e){
			e.preventDefault();
			var el = e.target;
			document.querySelector('header nav a.c14-bg').classList.remove('c14-bg');
			el.classList.add('c14-bg');

			var href = el.getAttribute('href');
			if(href.indexOf('#')==0){
				document.querySelectorAll('.screen').forEach(function(e){ e.style.display = 'none'; });
				document.getElementById(href.substr(1)).style.display = 'block';
			}
			if(href == "#locate") e.data.me.start();

			// Set the location
			location.href = "#";

			// Close menu
			document.getElementById('hamburger').checked = false;
		});
		

		return this;
	}

	Bins.prototype.clearResults = function(){
		// Zap search results
		this.el.input.querySelector('.searchresults').innerHTML = '';
		this.message('',{'id':'premises'});
		return this;
	}

	Bins.prototype.selectStreet = function(i){
		var ol,li;
		i = parseInt(i);
		this.address.street = i;
		this.clearResults();
		ol = document.createElement('ol');
		for(var n = 0; n < this.premises[i].numbers.length; n++){
			str = this.premises[i].numbers[n].n+' '+this.premises[i].street+', '+this.premises[i].locality;
			li = document.createElement('li');
			li.setAttribute('data-n',n);
			if(n==0) li.classList.add('selected');
			li.innerHTML = '<a href="#" class="padding-small name">'+str+'</a>';
			addEvent('click',li.querySelector('a'),{me:this,n:n},function(e){
				e.preventDefault();
				e.data.me.selectStreetNumber(e.data.n);
			});
			ol.appendChild(li);
		}
		this.el.input.querySelector('.searchresults').appendChild(ol);
		this.el.input.querySelectorAll('.place-street').forEach(function(e){ e.style.display = 'none'; });
		this.el.input.querySelectorAll('.place-number').forEach(function(e){ e.style.display = ''; });
		this.el.input.querySelector('#place-number').focus();
		if(this.el.input.querySelector('#place-number').value!="") this.processNumber();

		return this;
	}

	Bins.prototype.selectStreetNumber = function(n){
		if(n != "") this.address.n = (typeof n==="number") ? n : parseInt(n);
		if(typeof this.address.n==="number"){
			this.clearResults();
			this.getCollections(this.premises[this.address.street].numbers[this.address.n].id);
			this.setAddress();
		}
		return this;
	}

	Bins.prototype.processStreet = function(callback){
		if(!this.index.loaded) return this;

		str = document.getElementById('place-street').value.toUpperCase();
		if(this.files.length == 0){
			this.message('The search appears to be broken',{'id':'search'});
		}else{
			this.message('',{'id':'search'});
			var found = -1;
			var str_lo = str;
			var str_hi = str;
			
			if(str.length > 3){
				str_lo = str.substr(0,3);
				str_hi = str.substr(0,3);
			}
			while(str_lo.length < 3) str_lo += 'A';
			while(str_hi.length < 3) str_hi += 'Z';

			for(var i = 0 ; i < this.files.length; i++){
				if(str_lo >= this.files[i].from && str_hi <= this.files[i].to){
					found = i;
					i = this.files.length;
				}
			}
			if(str.length > 0){
				if(found >= 0){
					this.filefound = found;
					// Check if the data has already been loaded
					if(!this.files[found].loading && !this.files[found].loaded){
						this.files[found].loading = true;
						ODI.ajax(this.files[found].file,{
							'dataType':'text',
							'this': this,
							'i': found,
							'str': str,
							'success': function(d,a){
								attr = a.data;
								delete this.files[found].loading;
								this.files[found].loaded = true;
								this.files[attr.i].loaded = true;
								this.files[attr.i].data = d.split(/[\n\r]/);
								var cols,i,n,data;
								for(i = 0; i < this.files[attr.i].data.length; i++){
									cols = this.files[attr.i].data[i].split(/\t/);
									if(cols.length == 6){
										data = {'street':cols[0],'locality':cols[1],'postcode':cols[2],'lat':parseFloat(cols[3]),'lon':parseFloat(cols[4]),'numbers':cols[5].split(/;/)};
										for(n = 0 ; n < data.numbers.length; n++){
											ncols = data.numbers[n].split(/:/);
											data.numbers[n] = {'n':ncols[0],'id':parseInt(ncols[1], 36)};
										}
										this.premises.push(data);
									}
								}
								this.postProcessStreet(attr.str,callback);
							},
							'error': function(e,attr){
								this.message('Unable to load streets');
							}
						});
					}else{
						this.postProcessStreet(str,callback);
					}
				}
			}else{
				this.clearResults();
			}
		}
		if(!str) this.clearResults();
		return this;
	}
	Bins.prototype.postProcessStreet = function(name,callback){
		var html = "";
		var tmp = [];
		var str,tmp,i,ol,li;
		if(typeof name==="string" && name.length > 0){
			name = name.toLowerCase().replace(/[\s\-\,]/g,"");
			for(i = 0; i < this.premises.length; i++){
				str = this.premises[i].street.toLowerCase()+', '+this.premises[i].locality.toLowerCase();
				str = str.replace(/[\s\-\,]/g,"");
				if(str.indexOf(name) == 0) tmp.push(i);
			}

			this.clearResults();
			ol = document.createElement('ol');
			html = "<ol>";
			for(i = 0; i < tmp.length; i++){
				str = this.premises[tmp[i]].street+', '+this.premises[tmp[i]].locality;//+(tmp[i].name == tmp[i].region ? '' : ', '+tmp[i].region)+(tmp[i].type != "r" && tmp[i].type != "a" && tmp[i].type != "p" ? ' ('+t+')' : '');
				li = document.createElement('li');
				li.setAttribute('data-id',tmp[i]);
				if(i==0) li.classList.add('selected');
				li.innerHTML = '<a href="#" class="padding-small name">'+str+'</a>';
				addEvent('click',li.querySelector('a'),{i:tmp[i],me:this},function(e){
					e.data.me.selectStreet(e.data.i);
				});
				ol.appendChild(li);
			}
			this.el.input.querySelector('.searchresults').appendChild(ol)

		}
		if(typeof callback==="function") callback.call(this);

		return this;
	}

	Bins.prototype.processNumber = function(callback){
		var name = document.getElementById('place-number').value.toLowerCase();
		var html = "";
		var tmp = [];
		var str,tmp,i,ol,li;
		for(i = 0; i < this.premises[this.address.street].numbers.length; i++){
			str = this.premises[this.address.street].numbers[i].n.toLowerCase();
			if(str.indexOf(name) >= 0) tmp.push(i);
		}
		this.clearResults();
		ol = document.createElement('ol');
		for(i = 0; i < tmp.length; i++){
			str = this.premises[this.address.street].numbers[tmp[i]].n+' '+this.premises[this.address.street].street+', '+this.premises[this.address.street].locality;
			li = document.createElement('li');
			li.setAttribute('data-n',tmp[i]);
			if(i==0) li.classList.add('selected');
			li.innerHTML = '<a href="#" class="padding-small name">'+str+'</a>';
			addEvent('click',li.querySelector('a'),{me:this,n:tmp[i]},function(e){
				e.preventDefault();
				e.data.me.selectStreetNumber(e.data.n);				
			});
			ol.appendChild(li);
		}
		this.el.input.querySelector('.searchresults').appendChild(ol);

		if(typeof callback==="function") callback.call(this);

		return this;
	}

	Bins.prototype.start = function(){
		this.clearResults();
		// Clear messages
		removeEl(document.querySelectorAll('.message > div'));

		var r = document.getElementById('results');
		r.innerHTML = '';
		r.style.display = 'none';
		document.getElementById('locate').style.display = '';
		document.querySelectorAll('.place-number').forEach(function(e){ e.style.display = 'none'; });
		document.querySelectorAll('.place-street').forEach(function(e){ e.style.display = ''; });
		document.getElementById('place-street').focus();
		this.processStreet();
		return this;
	}

	Bins.prototype.getCollections = function(id){

		this.address.string = this.premises[this.address.street].numbers[this.address.n].n+' '+this.premises[this.address.street].street+', '+this.premises[this.address.street].locality;
		this.address.id = id;
		this.address.number = this.premises[this.address.street].numbers[this.address.n].n;
		this.address.streetname = this.premises[this.address.street].street;
		this.address.locality = this.premises[this.address.street].locality;

		document.getElementById('locate').style.display = 'none';
		var r = document.getElementById('results');
		r.style.display = 'block';
		r.innerHTML = '<h3>'+this.address.string+this.svg.edit+'</h3><div class="spinner"><div class="rect1 c14-bg"></div><div class="rect2 c14-bg"></div><div class="rect3 c14-bg"></div><div class="rect4 c14-bg"></div><div class="rect5 c14-bg"></div></div>';
		addEvent('click',document.querySelector('#results h3'),{me:this},function(e){ e.data.me.start(); });

		n = 1000;
		r = Math.floor(id/n)*1000;
		ODI.ajax(this.files[this.filefound].jobs,{
			'dataType': 'text',
			'this': this,
			'cache': false,
			'id': id,
			'success': function(d,attr){
				this.log('ID',id,attr);
				this.files[this.filefound].jobs.data = CSVToArray(d);
				var rows = CSVToArray(d);
				var result;
				var i,d,cols,ul,li;
				var found = "";
				for(i = 0; i < rows.length; i++){
					if(rows[i][0] == id) found = rows[i][1];
				}
				ul = document.createElement('ul');
				ul.classList.add('grid');

				now = new Date();
				this.events = [];	// Clear any existing events
				var dates = [];
				var added = 0;
				for(i = 0; i < found.length; i+=5){
					t = found.substr(i+4,1);
					d = "20"+parseInt(found.substr(i,4),36);
					d = d.replace(/([0-9]{4})([0-9]{2})([0-9]{2})/,function(m,p1,p2,p3){ return p1+"-"+p2+"-"+p3+"T08:00"; });
					d = new Date(d);
					dates.push(d);
					if(d >= now){
						li = document.createElement('li');
						li.innerHTML = '<a href="'+this.bins[t].url+'" class="'+this.bins[t].cls+'"><img src="'+this.bins[t].svg+'" class="bin" alt="'+this.bins[t].text+' bin" /><h2>'+this.bins[t].text+'</h2><time datetime="'+d.toISOString()+'">'+formatDate(d)+'</time></a>';
						ul.appendChild(li);
						added++;
						this.events.push({'date':d.toISOString(),'url':this.bins[t].url,'bin':this.bins[t].text,'nicedate':formatDate(d),'icon':this.bins[t].svg});
					}
				}
				this.el.output.appendChild(ul);
				if(added == 0 && dates.length > 0) this.log('WARNING','There are '+dates.length+' dates but all are in the past',dates);
				removeEl(this.el.output.querySelectorAll('.spinner'));

				//if("Notification" in window){
					//this.message('<button id="notifications" class="c14-bg">Add reminders'+(Notification.permission === "default" ? ' (you will be asked to allow notifications first)':'')+'</button>',{'id':'notify'});
					this.message('<button id="notifications" class="c14-bg">Add reminders</button>',{'id':'notify'});
					var _obj = this;
					addEvent('click',document.getElementById('notifications'),{me:this},function(e){
						e.data.me.log('notify');
						e.data.me.notify({ 'command': 'reminders', 'events': _obj.events});
						e.data.me.message('',{'id':'notify'});
					});
				//}
			},
			'error': function(e,attr){
				this.message('Unable to load collection times',{'id':'collections'});
			}
		});
		return this;
	}

	Bins.prototype.notify = function(attr){
		
		
		// Bail out if there is no Blob function
		if(typeof Blob!=="function") return this;


		var file = {'ext':'ics','mime':'text/v-calendar','v':'2.0'};
		var userAgent = navigator.userAgent || navigator.vendor || window.opera;
		// Windows Phone must come first because its UA also contains "Android"
		if(/windows phone/i.test(userAgent)) file = {'ext':'ics','mime':'text/calendar','v':'2.0'}
		// Android
		if(/android/i.test(userAgent)) file = {'ext':'vcs','mime':'text/v-calendar','v':'1.0'}
		// iOS detection from: http://stackoverflow.com/a/9039885/177710
		if(/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) file = {'ext':'ical','mime':'text/calendar','v':'2.0'}


		// Build a vCalendar file here
		// We want to also remove any existing alerts (that haven't yet happened) if they no longer will
		var cal = 'BEGIN:VCALENDAR\r\n';
		cal += 'VERSION:'+file.v+'\r\n';
		cal += 'PRODID:-//ODI Leeds/'+this.name+'//EN\r\n';
		for(var i = 0; i < attr.events.length; i++){
			uid = 'bins-'+attr.events[i].date.substr(0,10);
			ndate = (new Date()).toISOString().replace(/[^0-9TZ]/g,"");
			edate = attr.events[i].date.replace(/[^0-9TZ]/g,"");
			cal += 'BEGIN:VEVENT\r\n';
			cal += 'UID:'+uid+'@odileeds.github.io\r\n';
			cal += 'DTSTAMP:'+ndate+'\r\n';
			cal += 'DTSTART:'+edate+'\r\n';
			cal += 'DTEND:'+edate+'\r\n';
			cal += 'SUMMARY:'+attr.events[i].bin+' collection\r\n';
			cal += 'BEGIN:VALARM\r\n';
			cal += 'TRIGGER:-PT12H\r\n';
			cal += 'ACTION:DISPLAY\r\n';
			cal += 'DESCRIPTION:Reminder\r\n';
			cal += 'END:VALARM\r\n';
			cal += 'END:VEVENT\r\n';
		}
		cal += 'END:VCALENDAR\r\n';

		var textFileAsBlob = new Blob([cal], {type:file.mime});
		

		function destroyClickedElement(event){ document.body.removeChild(event.target); }

		var dl = document.createElement("a");
		dl.download = "bins."+file.ext;
		dl.innerHTML = "Download File";
		if(window.webkitURL != null){
			// Chrome allows the link to be clicked
			// without actually adding it to the DOM.
			dl.href = window.webkitURL.createObjectURL(textFileAsBlob);
		}else{
			// Firefox requires the link to be added to the DOM
			// before it can be clicked.
			dl.href = window.URL.createObjectURL(textFileAsBlob);
			dl.onclick = destroyClickedElement;
			dl.style.display = "none";
			document.body.appendChild(dl);
		}
		dl.click();
		/*
		console.log('Notification permission ',Notification.permission)
		if(Notification.permission === "granted"){
			// If it's okay let's create a notification
			var _obj = this;
			console.log('posting messages');
			if(this.worker){
				console.log('postMessage',JSON.stringify(attr));
				this.worker.postMessage(JSON.stringify(attr));
			}
		
			
		}else if(Notification.permission === "default") {
			var _obj = this;
			// Otherwise, we need to ask the user for permission
			Notification.requestPermission().then(function (permission) {
				// If the user accepts, let's create a notification
				if(permission === "granted") _obj.notify();
			});
		}*/
		return this;
	}

	Bins.prototype.getAddress = function(){
		var channel = new MessageChannel();
		// Load any existing address defined in a cookie
		var address = getCookie('address');
		if(address){
			this.address = address;
			this.el.input.querySelector('#place-street').value = this.address.streetname+', '+this.address.locality;
			this.processStreet(function(){
				if(this.el.input.querySelectorAll('.searchresults li').length==1){
					i = parseInt(this.el.input.querySelector('.searchresults li').getAttribute('data-id'));
					if(this.premises[i].street == this.address.streetname && this.premises[i].locality == this.address.locality){
						this.selectStreet(i);
						this.el.input.querySelector('#place-number').value = this.address.number;
						this.processNumber(function(){
							var lis = this.el.input.querySelectorAll('.searchresults li');
							if(lis && lis.length==1){
								i = this.address.street;
								n = parseInt(lis[0].getAttribute('data-n'));
								if(this.address.street==i && this.address.n==n) this.selectStreetNumber(n);
							}
						});
					}
				}
			});
		}
		// Send the message to the Worker
		// if(this.worker) this.worker.postMessage({'command':'getAddress'}, [channel.port2]);
	}

	Bins.prototype.setAddress = function(){
		var channel = new MessageChannel();
		// Send the message to the Worker
		setCookie('address',this.address);
	//	if(this.worker) this.worker.postMessage({'command':'setAddress','address':this.address}, [channel.port2]);
	}

	function formatDate(date) {
		var monthNames = ["January", "February", "March", "April", "May", "June", "July","August", "September", "October","November", "December"];
		var dayNames = ["Sunday","Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

		var day = date.getDate();
		var monthIndex = date.getMonth();
		var year = date.getFullYear();

		return dayNames[date.getDay()]+' '+ day + ' ' + monthNames[monthIndex] + ' ' + year;
	}

	/**
	 * CSVToArray parses any String of Data including '\r' '\n' characters,
	 * and returns an array with the rows of data.
	 * @param {String} CSV_string - the CSV string you need to parse
	 * @param {String} delimiter - the delimeter used to separate fields of data
	 * @returns {Array} rows - rows of CSV where first row are column headers
	 */
	function CSVToArray (CSV_string, delimiter) {
		delimiter = (delimiter || ","); // user-supplied delimeter or default comma

		var pattern = new RegExp( // regular expression to parse the CSV values.
			( // Delimiters:
				"(\\" + delimiter + "|\\r?\\n|\\r|^)" +
				// Quoted fields.
				"(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
				// Standard fields.
				"([^\"\\" + delimiter + "\\r\\n]*))"
			), "gi"
		);

		var rows = [[]];	// array to hold our data. First row is column headers.
		// array to hold our individual pattern matching groups:
		var matches = false; // false if we don't find any matches
		// Loop until we no longer find a regular expression match
		while (matches = pattern.exec( CSV_string )) {
			var matched_delimiter = matches[1]; // Get the matched delimiter
			// Check if the delimiter has a length (and is not the start of string)
			// and if it matches field delimiter. If not, it is a row delimiter.
			if (matched_delimiter.length && matched_delimiter !== delimiter) {
				// Since this is a new row of data, add an empty row to the array.
				rows.push( [] );
			}
			var matched_value;
			// Once we have eliminated the delimiter, check to see
			// what kind of value was captured (quoted or unquoted):
			if (matches[2]) { // found quoted value. unescape any double quotes.
				matched_value = matches[2].replace(
					new RegExp( "\"\"", "g" ), "\""
				);
			} else { // found a non-quoted value
				matched_value = matches[3];
			}
			// Now that we have our value string, let's add
			// it to the data array.
			rows[rows.length - 1].push(matched_value);
		}
		return rows; // Return the parsed data Array
	}

	function getCookie(cname) {
		var name,ca,i,j,c,str,obj;
		var name = cname + "=";
		var ca = document.cookie.split(';');
		for(i = 0; i < ca.length; i++){
			c = ca[i];
			while(c.charAt(0) == ' ') c = c.substring(1);
			if(c.indexOf(name) == 0) {
				str = c.substring(name.length, c.length);
				bits = str.split(/\|/);
				obj = {};
				for(j = 0; j < bits.length; j+=2) obj[bits[j]] = bits[j+1];
				return obj;
			}
		}
		return "";
	}

	function setCookie(cname,obj){
		var str,key;
		str = "";
		for(key in obj){
			if(str) str += '|';
			str += key+'|'+obj[key];
		}
		document.cookie = cname+'='+str+'; SameSite=Strict';
		return str;
	}


	function removeEl(el){
		// version 1
		if(!el) return;
		if(el.tagName) el = [el];
		el.forEach(function(e){ e.parentNode.removeChild(e); });
	}
	function addEvent(ev,el,attr,fn){
		// version 1.1
		if(el){
			if(el.tagName) el = [el];
			if(typeof fn==="function"){
				el.forEach(function(elem){
					elem.addEventListener(ev,function(e){
						e.data = attr;
						fn.call(attr['this']||this,e);
					});
				});
			}
		}
	}

	root.ODI = ODI;

	ODI.bins = Bins;

})(window || this);

var app;

ODI.ready(function(){

	app = new ODI.bins();

});
