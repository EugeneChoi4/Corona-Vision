let map = null;
let active_markers = [];
let locations = {};
let location_autocomplete = null;
let most_recent_person = null;
let dark_mode_style = [
	{elementType: 'geometry', stylers: [{color: '#242f3e'}]},
	{elementType: 'labels.text.stroke', stylers: [{color: '#242f3e'}]},
	{elementType: 'labels.text.fill', stylers: [{color: '#746855'}]},
	{
		featureType: 'administrative.locality',
		elementType: 'labels.text.fill',
		stylers: [{color: '#d59563'}]
	},
	{
		featureType: 'poi',
		elementType: 'labels.text.fill',
		stylers: [{color: '#d59563'}]
	},
	{
		featureType: 'poi.park',
		elementType: 'geometry',
		stylers: [{color: '#263c3f'}]
	},
	{
		featureType: 'poi.park',
		elementType: 'labels.text.fill',
		stylers: [{color: '#6b9a76'}]
	},
	{
		featureType: 'road',
		elementType: 'geometry',
		stylers: [{color: '#38414e'}]
	},
	{
		featureType: 'road',
		elementType: 'geometry.stroke',
		stylers: [{color: '#212a37'}]
	},
	{
		featureType: 'road',
		elementType: 'labels.text.fill',
		stylers: [{color: '#9ca5b3'}]
	},
	{
		featureType: 'road.highway',
		elementType: 'geometry',
		stylers: [{color: '#746855'}]
	},
	{
		featureType: 'road.highway',
		elementType: 'geometry.stroke',
		stylers: [{color: '#1f2835'}]
	},
	{
		featureType: 'road.highway',
		elementType: 'labels.text.fill',
		stylers: [{color: '#f3d19c'}]
	},
	{
		featureType: 'transit',
		elementType: 'geometry',
		stylers: [{color: '#2f3948'}]
	},
	{
		featureType: 'transit.station',
		elementType: 'labels.text.fill',
		stylers: [{color: '#d59563'}]
	},
	{
		featureType: 'water',
		elementType: 'geometry',
		stylers: [{color: '#17263c'}]
	},
	{
		featureType: 'water',
		elementType: 'labels.text.fill',
		stylers: [{color: '#515c6d'}]
	},
	{
		featureType: 'water',
		elementType: 'labels.text.stroke',
		stylers: [{color: '#17263c'}]
	}
];
let infowindow = null;
let map_display = "active";
let map_type = "total";

function init_coronamap() {
	map = new google.maps.Map($("#map")[0],
		{
			zoom: 1.5,
			minZoom: 1,
			center: {
				lat: 0,
				lng: 0
			},
			streetViewControl: false,
			styles: dark_mode_style
		});
	map.addListener("zoom_changed", function() {
		reload_cases();
	});
	infowindow = new google.maps.InfoWindow({
		content: ""
	})
}

function init() {
	init_autocomplete();
	for (let chart_level of ['world', 'country', 'province', 'admin2']) {
		charts[chart_level] = new_chart(chart_level + "-total");
	}
	$("input[type=radio][name=scale-type]").change(
		function() {
			if (this.value == 'logarithmic' || this.value == 'linear') {
				set_scale_type(this.value);
				update_charts();
			}
		}
	)
	$("input[type=radio][name=chart-type]").change(
		function() {
			chart_type = this.value;
			update_charts();
		}
	)
	$("#input[type=radio][name=map-type]").change(
		function() {
			map_type = this.value;
			reload_cases();
		}
	)
	$("#input[type=radio][name=map-display]").change(
		function() {
			map_display = this.value;
			reload_cases();
		}
	)
	update_charts();
}

let charts = {
	world: null,
	country: null,
	province: null,
	admin2: null
}

function set_scale_type(scale_type) {
	for (let chart_level in charts) {
		let chart = charts[chart_level];
		chart.options.scales.yAxes[0].type = scale_type;
		chart.update();
	}
}

function init_autocomplete() {
	let map_options = {};
	location_autocomplete = new google.maps.places.Autocomplete($("#location")[0], map_options);
}

function show_location(position) {
	let latitude = position.coords.latitude;
	let longitude = position.coords.longitude;
	$("#map")[0].setAttribute("class", "map");
	let my_location = {
		lat: latitude,
		lng: longitude
	};
	map.setCenter(my_location);
	setTimeout(reload_cases, 1000);
}

function remove_previous_markers() {
	for (let marker of active_markers) {
		marker.setMap(null);
	}
	active_markers = [];
}

function find_cases() {
	if (typeof(location_autocomplete.getPlace()) !== 'undefined') {
		let loc = location_autocomplete.getPlace().geometry.location;
		map.setCenter(loc);
		map.setZoom(8);
	}
	setTimeout(reload_cases, 1000);
}

function format_data(label, data) {
	let formatted = `<b>${label}</b><hr class="custom-hr"/>`
	+ `<b>Confirmed:</b> ${data.confirmed} (+${data.dconfirmed})<br/>`
	+ `<b>Recovered:</b> ${data.recovered} (+${data.drecovered})<br/>`
	+ `<b>Dead:</b> ${data.dead} (+${data.ddead})<br/>`
	+ `<b>Active:</b> ${data.active} (+${data.dactive})<br/><br/>`;

	return formatted;
}

function add_world_info(person, entry_date) {
	let xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			let data = JSON.parse(this.responseText)[0];
			if (data)
				$("#world-info")[0].innerHTML = format_data(`World: ${data.country}`, data);	
			else
				$("#world-info")[0].innerHTML = '';
		}
	}
	xhr.open("GET", `/cases/totals?date=${entry_date}`)
	xhr.send()
}

function add_country_info(person, entry_date) {
	if (person && person.country) {
		let xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
				let data = JSON.parse(this.responseText)[0];
				if (data)
					$("#country-info")[0].innerHTML = format_data(`Selected country: ${data.country}`, data);	
				else
					$("#country-info")[0].innerHTML = '';
			}
		}
		xhr.open("GET", `/cases/totals?country=${person.country}&date=${entry_date}`)
		xhr.send()
	} else {
		$("#country-info")[0].innerHTML = '';
	}
}

function add_county_info(person, entry_date) {
	if (person && person.admin2) {
		let xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
				let data = JSON.parse(this.responseText)[0];
				if (data)
					$("#county-info")[0].innerHTML = format_data(`Selected county: ${person.admin2}`, person);	
				else
					$("#county-info")[0].innerHTML = '';
			}
		}
		xhr.open("GET", `/cases/totals?country=${person.country}&province=${person.province}&admin2=${person.admin2}&date=${entry_date}`)
		xhr.send()
	} else {
		$("#county-info")[0].innerHTML = '';
	}
}

function add_province_info(person, entry_date) {
	if (person && person.province) {
		let xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
				let data = JSON.parse(this.responseText)[0];
				if (data)
					$("#province-info")[0].innerHTML = format_data(`Selected state: ${data.province}`, data);
				else
					$("#province-info")[0].innerHTML = '';
			}
		}
		xhr.open("GET", `/cases/totals?country=${person.country}&province=${person.province}&date=${entry_date}`)
		xhr.send()
	} else {
		$("#province-info")[0].innerHTML = '';
	}
}

function update_most_recent(entry_date) {
	add_world_info(most_recent_person, entry_date);
	add_country_info(most_recent_person, entry_date);
	add_province_info(most_recent_person, entry_date);
	add_county_info(most_recent_person, entry_date);
}
function update_charts() {
	show_chart('', '', '', 'World', charts.world);
	if (most_recent_person) {
		if (most_recent_person.country) {
			$("#ctc")[0].style.display = "block";
			show_chart(most_recent_person.country, '', '', most_recent_person.country, charts.country);
		} else {
			reset_chart(charts.country);
			$("#ctc")[0].style.display = "none";
		}
		if (most_recent_person.province) {
			$("#ptc")[0].style.display = "block";
			show_chart(most_recent_person.country, most_recent_person.province, '', most_recent_person.province, charts.province);
		} else {
			reset_chart(charts.province);
			$("#ptc")[0].style.display = "none";
		}
		if (most_recent_person.admin2) {
			$("#atc")[0].style.display = "block";
			show_chart(most_recent_person.country, most_recent_person.province, most_recent_person.admin2, most_recent_person.admin2, charts.admin2);
		} else {
			reset_chart(charts.admin2);
			$("#atc")[0].style.display = "none";
		}
	}
}

function generate_name(country, province, admin2) {
	let l = '';
	if (admin2) {
		l += admin2 + ", ";
	}
	if (province) {
		l += province + ", ";
	}
	if (country) {
		l += country;
	}
	if (!l) {
		return "World";
	}
	return l;
}

function reload_cases() {
	let xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			remove_previous_markers();

			let entry_date = $("#date")[0].value;
			update_most_recent(entry_date);

			if (most_recent_person && most_recent_person.entry_date != entry_date) {
				infowindow.close();
			}

			let county_found = false;
			for (let person of JSON.parse(this.responseText)) {
				if (person.confirmed > 0 && person.country) {
					let new_marker = new google.maps.Circle({
						center: {
							lat: person.latitude,
							lng: person.longitude
						},
						strokeColor: "#FF0000",
						strokeOpacity: 0.8,
						fillColor: "#FF0000",
						fillOpacity: 0.35,
						map: map,
						radius: 25 + Math.sqrt(person.confirmed) * 5000 / (map.zoom * map.zoom)
					});
					
					new_marker.addListener('click', function(ev) {
						let entry_date = $("#date")[0].value;
						most_recent_person = person;
						infowindow.setContent(`<div class="text-dark">${format_data(generate_name(person.country, person.province, person.admin2), person)}</div>`);
						infowindow.setPosition(ev.latLng);
						infowindow.open(map);
						update_most_recent(entry_date);
						update_charts();
					});

					active_markers.push(new_marker);
				}
			}
		}
	};
	
	let bounds = map.getBounds();
	let ne = bounds.getNorthEast();
	let sw = bounds.getSouthWest();
	let entry_date = $("#date")[0].value;
	//let request_content = `?ne_lat=${ne.lat()}&ne_lng=${ne.lng()}&sw_lat=${sw.lat()}&sw_lng=${sw.lng()}&date=${entry_date}`;
	let request_content = `?ne_lat=90&ne_lng=180&sw_lat=-90&sw_lng=-180&date=${entry_date}`;
	xhr.open("GET", "/cases/box" + request_content);
	xhr.send();
}