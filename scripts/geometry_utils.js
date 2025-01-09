/**
 * Helper function to calculate the distance between two coordinates using the Haversine formula
 * @param {Array} coord1 - First coordinate [latitude, longitude]
 * @param {Array} coord2 - Second coordinate [latitude, longitude]
 * @returns {number} - Distance between the two points in meters
 */
function haversineDistance(coord1, coord2) {
    const EARTH_RADIUS = 6371000; // Earth radius in meters
    const [lat1, lon1] = coord1;
    const [lat2, lon2] = coord2;

    const toRadians = (deg) => (deg * Math.PI) / 180;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) ** 2;

    return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(a));
}

/**
 * Function to calculate the total length of a polyline
 * @param {Array} polyline - Array of coordinates in [latitude, longitude] format
 * @returns {number} - Total length of the polyline in meters
 */
function calculatePolylineLength(polyline) {
    if (polyline.length < 2) {
        return 0; // No length if the polyline has less than two points
    }

    return polyline.reduce((totalLength, currentPoint, index) => {
        if (index === 0) return totalLength; // Skip the first point
        return totalLength + haversineDistance(polyline[index - 1], currentPoint);
    }, 0);
}

/**
 * Function to find a point on a polyline at a given distance
 * @param {Array} polyline - Array of coordinates in [latitude, longitude] format
 * @param {number} distance - Distance in meters from the start point
 * @returns {Object} - Coordinate { lat: number, lon: number } or an error message
 */
function findPointOnPolyline(polyline, distance) {
    if (polyline.length < 2) {
        return { error: "Polyline must have at least two points." };
    }

    let accumulatedDistance = 0;

    for (let i = 0; i < polyline.length - 1; i++) {
        const currentPoint = polyline[i];
        const nextPoint = polyline[i + 1];
        const segmentDistance = haversineDistance(currentPoint, nextPoint);

        if (accumulatedDistance + segmentDistance >= distance) {
            // Calculate the fraction of the segment distance needed
            const remainingDistance = distance - accumulatedDistance;
            const fraction = remainingDistance / segmentDistance;

            const [lat1, lon1] = currentPoint;
            const [lat2, lon2] = nextPoint;

            const lat = lat1 + fraction * (lat2 - lat1);
            const lon = lon1 + fraction * (lon2 - lon1);

            return { lat, lon };
        }

        accumulatedDistance += segmentDistance;
    }

    return { error: "Distance exceeds the total length of the polyline." };
}