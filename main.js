// Init tangram
map = (function () {
    'use strict';

    // Default map location
    var map_start_location = [0, 0, 3];

    // Parse URL hash looking for a map location
    var url_hash = window.location.hash.slice(1).split('/');
    if (url_hash.length == 3) {
        map_start_location = [url_hash[1],url_hash[2], url_hash[0]];
        map_start_location = map_start_location.map(Number);
    }

    // Create a Leaflet Map
    var map = L.map('map',{
        trackResize: true,
        keyboard: false,
        dragging: (window.self !== window.top && L.Browser.touch) ? false : true,
        tap: (window.self !== window.top && L.Browser.touch) ? false : true,
    });

    // Create a Tangram Layer
    var layer = Tangram.leafletLayer({
        scene: 'scene.yaml',
        attribution: '<a href="https://twitter.com/patriciogv" target="_blank">@patriciogv</a> | <a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors | <a href="https://mapzen.com/" target="_blank">Mapzen</a>'
    });

    window.layer = layer;
    var scene = layer.scene;
    window.scene = scene;

    map.setView(map_start_location.slice(0, 2), map_start_location[2]);
    var hash = new L.Hash(map);

    /***** Render loop *****/
    window.addEventListener('load', function () {
        init();
    });

    return map;
}());

function init() {

    // Listen to when the user stop moving (`moveend`) the leaflet map
    // Note: a debounce function is use to prevent multiple calls to OpenWeatherMaps api
    map.on('moveend', debounce(function() {
        // Update the displayed information
        update();
    }, 500));

    // Add Tangram `layer` to Leaflet `map`
    layer.addTo(map);
}

function update() {

    // Get the current boundaries of the displayed area on the map
    var bbox = map.getBounds();

    // Make the URL for OpenWeatherMaps API, asking for all stations inside that area (bounding box)
    var url = 'http://api.openweathermap.org/data/2.5/box/station?cluster=true&cnt=200&format=json&bbox=';
    url += bbox.getNorthWest().lng + ',' +bbox.getNorthWest().lat + ',' + bbox.getSouthEast().lng + ',' + bbox.getSouthEast().lat + ',';
    url += map.getZoom();
    url += '&appid=6b75c0fa496c2aaf62eb52f8bcce7cd8';

    // Make the request and wait for the reply
    fetch(url)
        .then(function (response) {
            // If we get a positive response...
            if (response.status !== 200) {
                console.log('Error getting data from OpenWeatherMaps. Status code: ' + response.status);
                return;
            }
            // ... parse it to JSON
            return response.json();
        })
        .then(function(json) {
            // Check that there are stations in that area
            if (json.cnt === 0) {
                console.log('No stations in this region');
                return;
            }

            // Make a GeoJSON POI for every station
            var features = [];
            for (var i in json.list) {
                features.push(makePOIs(json.list[i]));
            }

            // Pass the POIs as a GeoJSON FeaturesCollection to tangram
            scene.setDataSource('stations', {type: 'GeoJSON', data: {
                'type': 'FeatureCollection',
                'features': features
            }});
        })
        .catch(function(error) {
            console.log('Error parsing the JSON from OpenWeatherMaps.', error)
        })
}


// ============================================= Some Helper functions
function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

function makePOIs(station) {
    if (!station.wind) {
        station.wind = {speed: 0, deg: 0};
    }
    return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [station.coord.lon, station.coord.lat]
            },
            properties: {
                name: station.name,
                temp: station.main.temp,
                pressure: station.main.pressure,
                humidity: station.main.humidity,
                w_speed: station.wind.speed,
                w_deg: station.wind.deg, 
                kind: 'station'
            }
        };
}