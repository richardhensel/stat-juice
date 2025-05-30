

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

// function plotHrDistanceChart(data, ctx, chart, colour) {

//     // Extract HR and Distance data
//     const hrData = data.records.map(entry => entry.hr).filter(hr => hr !== null);
//     const distanceData = data.records.map(entry => entry.distance).filter(distance => distance !== null);

//     if (chart) {
//         chart.destroy();
//     }
//     chart = new Chart(ctx, {
//         type: 'line',
//         data: {
//             labels: distanceData,
//             datasets: [{
//                 label: 'Heart Rate',
//                 data: hrData,
//                 borderColor: colour,
//                 fill: false,
//                 borderWidth: 2
//             }]
//         },
//         options: {
//             scales: {
//                 x: { type: 'linear', position: 'bottom' }
//             }
//         }
//     });

//     return chart;
// }

function plotHrDistanceChart(data, ctx, chart, colour) {
    // Initialize variables for cumulative distance and filtered data
    let cumulativeDistance = 0;
    const hrData = [];
    const cumulativeDistanceData = [];

    const cumulativeDurationData = [];

    // Process data to calculate cumulative distance and pair HR with it
    data.records.forEach(entry => {
        const hr = entry.hr;
        const distance = entry.distance;

        // Update cumulative distance if distance is not null
        if (distance !== null) {

        // There's a bug here. Check in the tcx function.
        // if (distance >= 0) {
            cumulativeDistance += distance;
        }

        // if (cumulativeDistance < 10 || cumulativeDistance > 2000) {
        //     console.log(`cumulative dist: ${cumulativeDistance}, Incremental: ${distance}`);
        // }

        // Add HR and cumulative distance to arrays only if HR is not null
        if (hr !== null) {
            hrData.push(hr);
            cumulativeDistanceData.push(cumulativeDistance);
            cumulativeDurationData.push(entry.cumulativeDuration/3600);
        }

        // cumulativeDurationData.push(entry.cumulativeDuration/3600);
    });

    // Destroy existing chart if it exists
    if (chart) {
        chart.destroy();
    }

    // Create the new chart
    // Create the new chart
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: cumulativeDistanceData,
            datasets: [{
                label: 'HR vs Distance',
                data: hrData,
                borderColor: colour, // Line color
                backgroundColor: colour, // Fill color (matches line color)
                fill: true, // Enable area fill below the line
                borderWidth: 0, // Thickness of the line
                pointRadius: 0 // Remove markers at each point
            }]
        },
        options: {
            scales: {
                x: { type: 'linear', position: 'bottom' } // X-axis configuration
            },
            responsive: true, // Ensure responsiveness
            // maintainAspectRatio: false // Allow custom aspect ratio
        }
    });

    return chart;
}

function plotdistanceTimeChart(data, ctx, chart, colour) {

    // var ctx = canvas.getContext('2d');
    // Initialize variables for cumulative distance and filtered data
    let cumulativeDistance = 0;
    const timestampData = [];
    const cumulativeDistanceData = [];

    const cumulativeDurationData = [];
    const distanceData = [];

    const hasDistanceData = [];

    // Process data to calculate cumulative distance and pair HR with it
    data.records.forEach(entry => {
        const duration = entry.cumulativeDuration;
        const distance = entry.distance;

        // Update cumulative distance if distance is not null
        if (distance !== null) {

        // There's a bug here. Check in the tcx function.
        // if (distance >= 0) {
            cumulativeDistance += distance;
        }

        if (distance == null || distance == 0){
            hasDistanceData.push(1);
        }
        else {
            hasDistanceData.push(0);
        }

        distanceData.push(distance);

        cumulativeDistanceData.push(cumulativeDistance);
        // timestampData.push(timestamp);

        cumulativeDurationData.push(entry.cumulativeDuration/3600);
    });

    // Destroy existing chart if it exists
    if (chart) {
        chart.destroy();
    }

    // Create the new chart
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: cumulativeDurationData,
            datasets: [{
                label: 'Gaps',
                data: hasDistanceData,
                borderColor: colour, // Line color
                backgroundColor: colour, // Fill color (matches line color)
                fill: true, // Enable area fill below the line
                borderWidth: 0, // Thickness of the line
                pointRadius: 0 // Remove markers at each point
            }]
        },
        // options: {
        //     scales: {
        //         x: { type: 'linear', position: 'bottom' } // X-axis configuration
        //     },
        //     responsive: true, // Ensure responsiveness
        //     // maintainAspectRatio: false // Allow custom aspect ratio
        // }
    });

    return chart;
}


function clearChartFromMap(chart) {
    if (chart) {
        chart.destroy();
    }
}
