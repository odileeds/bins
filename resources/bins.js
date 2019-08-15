/* Created August 7th 2019 by Stuart Lowe (ODI Leeds) */

function Bins(inp){

	this.inp = (inp || {});
	if(!this.inp.input) this.inp.input = 'locate';
	if(!this.inp.output) this.inp.output = 'results';
	this.el = { 'input': S('#'+this.inp.input), 'output': S('#'+this.inp.output) };
	this.version = "0.1";
	this.premises = [];
	this.files = [];
	this.address = {};
	this.index = {'file':'data/leeds/index.csv'};
	this.logging = (location.search.indexOf('logging=true')>0);
	this.svg = { 'edit': '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" style="position:relative;top:0.125em;right:-0.5em;" viewBox="0 0 20 20"><title>edit</title><path style="color:black;" d="M16.77 8l1.94-2a1 1 0 0 0 0-1.41l-3.34-3.3a1 1 0 0 0-1.41 0L12 3.23zm-5.81-3.71L1 14.25V19h4.75l9.96-9.96-4.75-4.75z"/></svg>' };
	this.settings = {'notifications':{'ready':false,'enabled':false}};

	this.bins = {
		'B':{'text':'General waste','cls':'b2-bg','svg':'https://www.leeds.gov.uk/_catalogs/masterpage/public/images/bins_black.svg','url':'https://www.leeds.gov.uk/residents/bins-and-recycling/your-bins/black-bin'},
		'G':{'text':'Recycling','cls':'c6-bg','svg':'https://www.leeds.gov.uk/_catalogs/masterpage/public/images/bins_green.svg','url':'https://www.leeds.gov.uk/residents/bins-and-recycling/your-bins/green-recycling-bin'},
		'R':{'text':'Garden waste','cls':'c15-bg','svg':'https://www.leeds.gov.uk/_catalogs/masterpage/public/images/bins_brown.svg','url':'https://www.leeds.gov.uk/residents/bins-and-recycling/your-bins/brown-garden-waste-bin'},
		'F':{'text':'Food','cls':'c9-bg','svg':'https://www.leeds.gov.uk/_catalogs/masterpage/public/images/bins_food.svg','url':'https://www.leeds.gov.uk/residents/bins-and-recycling/your-bins/food-waste-bin'}
	}

	if(console) console.log('%cBins v'+this.version+'%c','font-weight:bold;font-size:1.25em;','');

	/* Set up the Service Worker */
	let deferredPrompt;
	this.worker;
	var _obj = this;
	if('serviceWorker' in navigator){
		navigator.serviceWorker.register('sw.js',{'scope':'/bins/'}).then(function(registration){
			console.log('Service worker registration',_obj,registration);
			_obj.worker = (registration.installing || registration.active);
			_obj.log('Service worker registered in scope '+registration.scope);		
		}).catch(function(error){
			_obj.log('ERROR','Service worker failed to register with error '+error);
		});
	
		// Handler for messages coming from the service worker
		navigator.serviceWorker.addEventListener('message', function handler(e){
			if(e.source !== _obj.worker) return;
			console.log('heard',e.data);
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
			}
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
		if(navigator.onLine) S('header').removeClass('b4-bg').addClass('c14-bg');
		else S('header').removeClass('c14-bg').addClass('b4-bg');
	}

	this.init();

	return this;
};

Bins.prototype.message = function(msg,attr){
	if(msg) this.log(msg);

	var msgel = this.el.output.parent().find('.message');
	
	if(!attr) attr = {'id':'default'};
	if(!msg){
		if(msgel.length > 0){
			// Remove the specific message container
			if(msgel.find('#'+attr.id).length > 0) msgel.find('#'+attr.id).remove();
			// Remove the whole message container if there is nothing left
			if(msgel.html()==""){
				msgel.remove();
				this.el.output.parent().css({'padding-bottom':''});
			}
		}
	}else if(msg){
		// If there is no message container, we make that now
		if(msgel.length == 0){
			this.el.output.after('<div class="message c14-bg"></div>');
			msgel = this.el.output.parent().find('.message');
		}
		// We make a specific message container
		if(msgel.find('#'+attr.id).length==0) msgel.append('<div id="'+attr.id+'"></div>');
		msgel = msgel.find('#'+attr.id);
		msgel.html(msg);
		var n = this.el.output.parent().find('.message > div').length;
		this.el.output.parent().css({'padding-bottom':(2*n + 2)+'em'});
	}

	return this;
};

Bins.prototype.log = function(){
	if(this.logging || arguments[0]=="ERROR"){
		var args = Array.prototype.slice.call(arguments, 0);
		if(console && typeof console.log==="function"){
			if(arguments[0] == "ERROR") console.error('%cBins%c: '+args[1],'font-weight:bold;','',(args.splice(2).length > 0 ? args.splice(2):""));
			else console.log('%cBins%c','font-weight:bold;','',args);
		}
	}
	return this;
};

Bins.prototype.getIndex = function(){
	if(this.index.loading || this.index.loaded) return this;
	this.index.loading = true;
	S().ajax(this.index.file,{
		"dataType": "text",
		"this": this,
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
			this.el.input.find('.spinner').remove();
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
	this.el.output.append('<div class="list"></div>');

	S('.bg').on('click',function(e){
		S('#hamburger')[0].checked = false;
	});

	var el = this.el.input.find('.placesearch');
	var focus = false;

	el.find('form').on('submit',function(e){ e.preventDefault(); });
	el.find('.submit').on('click',function(e){
		if(!focus) on();
		else off();
	});

	function on(){
		focus = true;
		el.addClass('typing');
		el.find('#place-number')[0].focus();
	}
	function off(){
		focus = false;
		el.removeClass('typing');
	}

	this.getIndex();
	
	function searchResultsSelect(keyCode){
		var li = el.find('.searchresults li');
		var s = -1;
		for(var i = 0; i < li.e.length; i++){
			if(S(li.e[i]).hasClass('selected')) s = i;
		}
		if(keyCode==40) s++;
		else s--;
		if(s < 0) s = li.e.length-1;
		if(s >= li.e.length) s = 0;
		el.find('.searchresults .selected').removeClass('selected');
		S(li.e[s]).addClass('selected');
	}


	el.find('#place-street').on('keyup',{me:this},function(e){

		e.preventDefault();
		me = e.data.me;

		if(e.originalEvent.keyCode==40 || e.originalEvent.keyCode==38) searchResultsSelect(e.originalEvent.keyCode);
		else if(e.originalEvent.keyCode==13) me.selectStreet(el.find('.searchresults .selected').attr('data-id'));
		else me.processStreet();
	});
	
	el.find('.place-number').css({'display':'none'});
	el.find('#place-number').on('keyup',{me:this},function(e){

		e.preventDefault();
		me = e.data.me;

		if(e.originalEvent.keyCode==40 || e.originalEvent.keyCode==38) searchResultsSelect(e.originalEvent.keyCode);
		else if(e.originalEvent.keyCode==13) me.selectStreetNumber(el.find('.searchresults .selected').attr('data-n'));
		else me.processNumber();
	});
	
	S('header nav a').on('click',{me:this},function(e){
		e.preventDefault();
		var el = S(e.currentTarget);
		S('header nav a.c14-bg').removeClass('c14-bg');
		el.addClass('c14-bg');

		var href = el.attr('href');
		if(href.indexOf('#')==0){
			S('.screen').css({'display':'none'});
			S(href).css({'display':'block'});
		}
		if(href == "#locate") e.data.me.clearResults();

		// Set the location
		location.href = "#";

		// Close menu
		S('#hamburger')[0].checked = false;
	});
	
	return this;
}

Bins.prototype.clearResults = function(){
	// Zap search results
	this.el.input.find('.searchresults').html('');
	this.message('',{'id':'premises'});
	return this;
}

Bins.prototype.selectStreet = function(i){
	i = parseInt(i);
	this.address.street = i;
	this.clearResults();
	var html = '<ol>';
	for(var n = 0; n < this.premises[i].numbers.length; n++){
		str = this.premises[i].numbers[n].n+' '+this.premises[i].street+', '+this.premises[i].locality;
		html += '<li data-n="'+n+'"'+(n==0 ? ' class="selected"':'')+'><a href="#" class="padding-small name">'+str+'</a></li>';
	}
	html += '</ol>';
	this.el.input.find('.searchresults').html(html);

	var li = this.el.input.find('.searchresults li a');
	for(var i = 0 ; i < li.length ; i++){
		S(li[i]).on('click',{me:this},function(e){
			e.preventDefault();
			n = parseInt(S(this).parent().attr('data-n'));
			e.data.me.selectStreetNumber(n);
		});
	}
	this.el.input.find('.place-street').css({'display':'none'});
	this.el.input.find('.place-number').css({'display':''});
	this.el.input.find('#place-number')[0].focus();
	if(this.el.input.find('#place-number')[0].value!="") this.processNumber();

	return this;
}

Bins.prototype.selectStreetNumber = function(n){
	if(n) this.address.n = (typeof n==="number") ? n : parseInt(n);
	if(typeof this.address.n==="number"){
		this.clearResults();
		this.getCollections(this.premises[this.address.street].numbers[this.address.n].id);
		this.setAddress();
	}
	return this;
}

Bins.prototype.processStreet = function(callback){
	if(!this.index.loaded) return this;

	str = S('#place-street')[0].value.toUpperCase();
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
					S().ajax(this.files[found].file,{
						'dataType':'text',
						'this': this,
						'i': found,
						'str': str,
						'success': function(d,attr){
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
										cols = data.numbers[n].split(/:/);
										data.numbers[n] = {'n':cols[0],'id':parseInt(cols[1], 36)};
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
	var str,tmp,i;
	if(typeof name==="string" && name.length > 0){
		name = name.toLowerCase().replace(/[\s\-\,]/g,"");
		for(i = 0; i < this.premises.length; i++){
			str = this.premises[i].street.toLowerCase()+', '+this.premises[i].locality.toLowerCase();
			str = str.replace(/[\s\-\,]/g,"");
			if(str.indexOf(name) == 0) tmp.push(i);
		}

		this.el.input.find('.searchresults li').off('click');
		html = "<ol>";
		for(i = 0; i < tmp.length; i++){
			str = this.premises[tmp[i]].street+', '+this.premises[tmp[i]].locality;//+(tmp[i].name == tmp[i].region ? '' : ', '+tmp[i].region)+(tmp[i].type != "r" && tmp[i].type != "a" && tmp[i].type != "p" ? ' ('+t+')' : '');
			//if(typeof attr.formatResult==="function") str = attr.formatResult.call((attr.this || _obj),tmp[i]);
			html += '<li data-id="'+tmp[i]+'" '+(i==0 ? ' class="selected"':'')+'><a href="#" class="padding-small name">'+str+'</a></li>';
		}
		html += "</ol>";
		this.el.input.find('.searchresults').html(html);
		var li = this.el.input.find('.searchresults li a');
		for(i = 0 ; i < li.length ; i++){
			S(li[i]).on('click',{me:this},function(e){
				e.preventDefault();
				i = parseInt(S(this).parent().attr('data-id'));
				e.data.me.selectStreet(i);
			});
		}
	}
	if(typeof callback==="function") callback.call(this);

	return this;
}

Bins.prototype.processNumber = function(callback){
	var name = S('#place-number')[0].value;
	var html = "";
	var tmp = [];
	var str,tmp,i;
	for(i = 0; i < this.premises[this.address.street].numbers.length; i++){
		str = this.premises[this.address.street].numbers[i].n.toLowerCase();
		if(str.indexOf(name) >= 0) tmp.push(i);
	}
	this.el.input.find('.searchresults li').off('click');
	html = "<ol>";
	for(i = 0; i < tmp.length; i++){
		str = this.premises[this.address.street].numbers[tmp[i]].n+' '+this.premises[this.address.street].street+', '+this.premises[this.address.street].locality;
		html += '<li data-n="'+tmp[i]+'" '+(i==0 ? ' class="selected"':'')+'><a href="#" class="padding-small name">'+str+'</a></li>';
	}
	html += "</ol>";
	this.el.input.find('.searchresults').html(html);
	var li = this.el.input.find('.searchresults li a');
	for(i = 0 ; i < li.length ; i++){
		S(li[i]).on('click',{me:this},function(e){
			e.preventDefault();
			n = parseInt(S(this).parent().attr('data-n'));
			e.data.me.selectStreetNumber(n);
		});
	}

	if(typeof callback==="function") callback.call(this);

	return this;
}

Bins.prototype.getCollections = function(id){

	this.address.string = this.premises[this.address.street].numbers[this.address.n].n+' '+this.premises[this.address.street].street+', '+this.premises[this.address.street].locality;
	this.address.id = id;
	this.address.number = this.premises[this.address.street].numbers[this.address.n].n;
	this.address.streetname = this.premises[this.address.street].street;
	this.address.locality = this.premises[this.address.street].locality;
	
	S('#locate').css({'display':'none'});
	S('#results').css({'display':'block'}).html('<h3>'+this.address.string+this.svg.edit+'</h3><div class="spinner"><div class="rect1 c14-bg"></div><div class="rect2 c14-bg"></div><div class="rect3 c14-bg"></div><div class="rect4 c14-bg"></div><div class="rect5 c14-bg"></div></div>');
	S('#results h3').on('click',{me:this},function(e){
		
		e.data.me.clearResults();
		// Clear messages
		S('.message > div').remove();

		S('#results').html('').css({'display':'none'});
		S('#locate').css({'display':''});
		S('.place-number').css({'display':'none'});
		S('.place-street').css({'display':''});
		S('#place-street')[0].focus();
		e.data.me.processStreet();
		
	});

	n = 1000;
	r = Math.floor(id/n)*1000;
	S().ajax(this.files[this.filefound].jobs,{
		'dataType': 'text',
		'this': this,
		'cache': false,
		'id': id,
		'success': function(d,attr){
			this.files[this.filefound].jobs.data = CSVToArray(d);
			var rows = CSVToArray(d);
			var result;
			var i,d,cols;
			var found = "";
			for(i = 0; i < rows.length; i++){
				if(rows[i][0] == id) found = rows[i][1];
			}
			html = '<ul class="grid">';
			now = new Date();
			this.events = [];	// Clear any existing events
			for(i = 0; i < found.length; i+=5){
				t = found.substr(i+4,1);
				d = "20"+parseInt(found.substr(i,4),36);
				d = d.replace(/([0-9]{4})([0-9]{2})([0-9]{2})/,function(m,p1,p2,p3){ return p1+"-"+p2+"-"+p3+"T08:00"; });
				d = new Date(d);
				if(d >= now){
					html += '<li><a href="'+this.bins[t].url+'" class="'+this.bins[t].cls+'"><img src="'+this.bins[t].svg+'" class="bin" alt="'+this.bins[t].text+' bin" /><h2>'+this.bins[t].text+'</h2><time datetime="'+d.toISOString()+'">'+formatDate(d)+'</time></a></li>';
					this.events.push({'date':d.toISOString(),'url':this.bins[t].url,'bin':this.bins[t].text,'nicedate':formatDate(d),'icon':this.bins[t].svg});
				}
			}
			html += '</ul>';

			this.el.output.append(html);
			this.el.output.find('.spinner').remove();

			if("Notification" in window){
				this.message('<button id="notifications" class="c14-bg">Add reminders'+(Notification.permission === "default" ? ' (you will be asked to allow notifications first)':'')+'</button>',{'id':'notify'});
				var _obj = this;
				S('#notifications').on('click',{me:this},function(e){
					console.log('notify');
					e.data.me.notify({ 'command': 'reminders', 'events': _obj.events});
					e.data.me.message('',{'id':'notify'});
				});
			}

		},
		'error': function(e,attr){
			this.message('Unable to load collection times',{'id':'collections'});
		}
	});
	return this;
}

Bins.prototype.notify = function(attr){
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
	}
	return this;
}

Bins.prototype.getAddress = function(){
	var channel = new MessageChannel();
	// Send the message to the Worker
	if(this.worker) this.worker.postMessage({'command':'getAddress'}, [channel.port2]);
}

Bins.prototype.setAddress = function(){
	var channel = new MessageChannel();
	// Send the message to the Worker
	if(this.worker) this.worker.postMessage({'command':'setAddress','address':this.address}, [channel.port2]);
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

var app;

S(document).ready(function(){
	
	app = new Bins();

});
