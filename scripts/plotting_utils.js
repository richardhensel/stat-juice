

function plotPolylineOnMap(data, map, mapLayer, colour) {
    
    if (mapLayer) map.removeLayer(mapLayer); // Clear previous layer if exists

    // Extract positions
    var positions = data.records
    .map(entry => entry.position)
    .filter(position => position[0] !== null && position[1] !== null);

    // Create a polyline and add it to the map
    mapLayer = L.polyline(positions, { color: colour }).addTo(map);

    var bounds = map.getBounds();

    mapLayer.getLatLngs().forEach(function(latlng) {
        bounds.extend(latlng);
    });

    // Zoom the map to fit the polyline
    map.fitBounds(bounds);

    return mapLayer;
}

function clearPolylineFromMap(map, mapLayer) {
    if (mapLayer) map.removeLayer(mapLayer);
}

function plotHrDistanceChart(data, ctx, chart, colour) {

    // Extract HR and Distance data
    const hrData = data.records.map(entry => entry.hr).filter(hr => hr !== null);
    const distanceData = data.records.map(entry => entry.distance).filter(distance => distance !== null);

    if (chart) {
        chart.destroy();
    }
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: distanceData,
            datasets: [{
                label: 'Heart Rate',
                data: hrData,
                borderColor: colour,
                fill: false,
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                x: { type: 'linear', position: 'bottom' }
            }
        }
    });

    return chart;
}


function clearChartFromMap(chart) {
    if (chart) {
        chart.destroy();
    }
}
