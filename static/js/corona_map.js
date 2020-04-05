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
let feature_display = "active"; // can be either: active, confirmed, dead, or recovered
let map_type = "total"; // can be either: total, daily-change
let circle_colors = {
	active: "#de7c21",
	confirmed: "#ebf765",
	dead: "#f54842",
	recovered: "#39e639"
}

let last_zoom = 2;
let min_radius = 2500;

let zoomins = {
	active: 1,
	confirmed: 1,
	recovered: 1,
	dead: 1,
	dactive: 1,
	dconfirmed: 1,
	drecovered: 1,
	ddead: 1
}

function init_coronamap() {
	map = new google.maps.Map($("#map")[0],
		{
			zoom: 2,
			minZoom: 1,
			center: {
				lat: 20,
				lng: 0
			},
			streetViewControl: false,
			styles: dark_mode_style
		});
	map.addListener("zoom_changed", function() {
		let new_zoom = map.zoom;
		let zoom_scale = Math.pow(last_zoom/new_zoom, 2);
		for (let circle of active_markers) {
			circle.setRadius((circle.getRadius() - min_radius) * zoom_scale + min_radius);
		}

		last_zoom = new_zoom;
	});
	infowindow = new google.maps.InfoWindow({
		content: ""
	});

	setTimeout(reload_cases, 500);
}

function init() {
	init_selectors(update_info);

	chart = new_chart("chart");
	
	$("select[name=scale-type]").change(
		function() {
			if (this.value == 'logarithmic' || this.value == 'linear') {
				set_scale_type(this.value);
				show_chart(country, province, admin2, generate_name(country, province, admin2), chart);
			}
		}
	)
	$("select[name=chart-type]").change(
		function() {
			chart_type = this.value;
			show_chart(country, province, admin2, generate_name(country, province, admin2), chart);
		}
	)
	$("select[name=map-type]").change(
		function() {
			map_type = this.value;
			reload_cases();
		}
	)
	$("select[name=map-display]").change(
		function() {
			feature_display = this.value;
			reload_cases();
		}
	)
	
	show_chart('', '', '', 'World', chart);
}

let chart = null;

function set_scale_type(scale_type) {
	chart.options.scales.yAxes[0].type = scale_type;
	chart.update();
}

function init_autocomplete() {
	location_autocomplete = new google.maps.places.Autocomplete($("#location")[0], {});
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
	setTimeout(reload_cases, 500);
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
	setTimeout(reload_cases, 500);
}

function format_data(label, data) {
	let formatted = `
	<div class="font-weight-bold" style="font-size: 1.5rem; background-color: #212121;">
		<span style="color: #f5f5f5;">${label}</span><br/>
		<span style="color: ${circle_colors.confirmed}">${data.confirmed} (+${data.dconfirmed}) Confirmed</span><br/>
		<span style="color: ${circle_colors.active}">${data.active} (+${data.dactive}) Active</span><br/>
		<span style="color: ${circle_colors.dead}">${data.dead} (+${data.ddead}) Dead</span><br/>
		<span style="color: ${circle_colors.recovered}">${data.recovered} (+${data.drecovered}) Recovered</span><br/>
	</div>
	`;

	return formatted;
}

function add_world_info(person, entry_date) {
	let xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			let data = JSON.parse(this.responseText)[0];
			if (data) {
				zoomins.confirmed = data.confirmed/data.confirmed;
				zoomins.active = data.confirmed/data.active;
				zoomins.dead = data.confirmed/data.dead;
				zoomins.recovered = data.confirmed/data.recovered;
				zoomins.dconfirmed = data.confirmed/data.dconfirmed;
				zoomins.dactive = data.confirmed/data.dactive;
				zoomins.ddead = data.confirmed/data.ddead;
				zoomins.drecovered = data.confirmed/data.drecovered;
			} else {
			}
		}
	}
	xhr.open("GET", `/cases/totals?date=${entry_date}`)
	xhr.send()
}

function update_info() {
	let entry_date = $("#date")[0].value;
	let xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			let data = JSON.parse(this.responseText)[0];
			if (data) {
				$("#stats-info")[0].innerHTML = format_data(generate_name(country, province, admin2), data);
			} else {
				$("#stats-info")[0].innerHTML = '';
			}
		}
	}
	xhr.open("GET", `/cases/totals?country=${country}&province=${province}&admin2=${admin2}&date=${entry_date}`)
	xhr.send()
	
	show_chart(country, province, admin2, generate_name(country, province, admin2), chart);
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
	update_info();
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
			let feature = (map_type == "daily-change" ? "d" : "") + feature_display;
			for (let person of JSON.parse(this.responseText)) {
				if (person[feature] > 0) {
					let new_marker = new google.maps.Circle({
						center: {
							lat: person.latitude,
							lng: person.longitude
						},
						strokeColor: circle_colors[feature_display],
						strokeOpacity: 0.8,
						fillColor: circle_colors[feature_display],
						fillOpacity: 0.35,
						map: map,
						radius: min_radius + Math.sqrt(person[feature] * zoomins[feature]) * 4000 / (map.zoom * map.zoom)
					});
					
					new_marker.addListener('click', function(ev) {
						let entry_date = $("#date")[0].value;
						most_recent_person = person;
						infowindow.setContent(`<div class="text-dark">${format_data(generate_name(person.country, person.province, person.admin2), person)}</div>`);
						infowindow.setPosition(ev.latLng);
						infowindow.open(map);
						update_most_recent(entry_date);
					});

					active_markers.push(new_marker);
				}
			}
		}
	};
	
	let entry_date = $("#date")[0].value;
	xhr.open("GET", `/cases/date?date=${entry_date}`);
	xhr.send();
}