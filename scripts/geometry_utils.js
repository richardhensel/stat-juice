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

// class(activity, minDropoutDistance, maxTimeGapSeconds). automatically identify the dropouts upon construction
// getDropouts() return a list of [startPosition, endPosition]. One element for each dropout
// remapDropout(dropoutId, roughPolyline) take a polyline with first element at startPosition and last element at endPosition, and interpolate the dropout data over this polyline.
// resetDropout(dropoutId) respore the dropout data to its original state, before it was remapped.
// getRemappedData() return the activity data with the dropouts remapped.


function identifyPositionDropouts(activityData, maxTimeGapSeconds) {
    if (!activityData || !Array.isArray(activityData.records)) {
        throw new Error("Invalid activity data or records array.");
    }

    const records = activityData.records;
    const dropouts = []; // List to store dropout bounding indices
    let dropoutStartIndex = null; // Index of the first null position
    let dropoutEndIndex = null; // Index of the last null position
    let lastNonNullIndex = null; // Index of the last non-null position

    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const position = record.position;
        const timestamp = new Date(record.timestamp).getTime();

        if (position[0] !== null && position[1] !== null) {
            // Position is non-null
            if (dropoutStartIndex !== null) {
                // Check if the timing gap is within the allowed threshold
                const timeGap = (timestamp - new Date(records[dropoutEndIndex].timestamp).getTime()) / 1000;

                if (timeGap <= maxTimeGapSeconds && lastNonNullIndex !== null) {
                    // Add dropout bounding indices to the result
                    dropouts.push([lastNonNullIndex, i]); 
                }
                // Reset dropout tracking
                dropoutStartIndex = null;
                dropoutEndIndex = null;
            }
            lastNonNullIndex = i;
        } else {
            // Position is null
            if (dropoutStartIndex === null) {
                dropoutStartIndex = i; // Start of null values
            }
            dropoutEndIndex = i; // Update the end of null values
        }
    }

    return dropouts; // List of bounding indices for each dropout
}

function extractSubarray(array, index_bounds) {
    if (!Array.isArray(array) || !Array.isArray(index_bounds) || index_bounds.length !== 2) {
        throw new Error("Invalid input: array must be an array with at least 2 elements, and index_bounds must be an array with exactly 2 elements.");
    }

    const [startIndex, endIndex] = index_bounds;

    // Validate indices
    if (
        typeof startIndex !== "number" || 
        typeof endIndex !== "number" || 
        startIndex < 0 || 
        endIndex >= array.length || 
        startIndex > endIndex
    ) {
        throw new Error("Invalid indices: ensure start and end indices are valid within the bounds of array.");
    }

    // Extract and return the subarray
    return array.slice(startIndex, endIndex + 1);
}

// [gap start index, gap end index], initial data, replacement position data to be put between the indices
// place the data nicely in the activity struct. accumulate distance and add velocity. 
function updateActivitySection(activityData, indices, newPositions) {
    if (!activityData || !Array.isArray(activityData.records)) {
        throw new Error("Invalid activityData: records must be an array.");
    }

    const records = activityData.records;

    if (
        !Array.isArray(indices) ||
        indices.length !== 2 ||
        typeof indices[0] !== "number" ||
        typeof indices[1] !== "number" ||
        indices[0] < 0 ||
        indices[1] >= records.length ||
        indices[0] >= indices[1]
    ) {
        throw new Error("Invalid indices: Must be a list of two valid numbers.");
    }

    const [startIndex, endIndex] = indices;
    const sectionLength = endIndex - startIndex - 1;

    if (!Array.isArray(newPositions) || newPositions.length !== sectionLength) {
        throw new Error("Invalid newPositions: Length must match the number of elements between the indices.");
    }

    // for (let i = startIndex + 1; i < endIndex; i++) {
    //     const record = records[i];
    //     if (record.position[0] !== null || record.position[1] !== null) {
    //         throw new Error("Invalid section: All elements between the indices must have null position values.");
    //     }
    // }

    // Overwrite the positions
    let previousPosition = records[startIndex].position;
    if (previousPosition[0] === null || previousPosition[1] === null) {
        throw new Error("Invalid start position: Must have valid coordinates.");
    }

    for (let i = 0; i < newPositions.length; i++) {
        const currentIndex = startIndex + 1 + i;
        records[currentIndex].position = [newPositions[i].position.lat, newPositions[i].position.lon];
        records[currentIndex].distance = newPositions[i].distance;
    }

    // let nextPosition = records[endIndex].position;
    // if (nextPosition[0] === null || nextPosition[1] === null) {
    //     throw new Error("Invalid end position: Must have valid coordinates.");
    // }

    // Update distances
    // let cumulativeDistance = 0;

    // for (let i = startIndex; i <= endIndex; i++) {
    //     const currentRecord = records[i];
    //     const nextRecord = i < endIndex ? records[i + 1] : null;

    //     if (nextRecord) {
    //         const distance = haversineDistance(
    //             currentRecord.position,
    //             nextRecord.position
    //         );
    //         // cumulativeDistance += distance;
    //         // currentRecord.distance = cumulativeDistance;
    //         currentRecord.distance = distance;
    //     }
    // }

    // Update velocities
    for (let i = startIndex + 1; i <= endIndex; i++) {
        const previousRecord = records[i - 1];
        const currentRecord = records[i];

        const timeDelta =
            (new Date(currentRecord.timestamp).getTime() -
                new Date(previousRecord.timestamp).getTime()) /
            1000; // seconds

        currentRecord.velocity = timeDelta > 0 ? currentRecord.distance / timeDelta : 0;
    }

    // Update the values of the first non-null record after the dropout
    records[endIndex].distance = newPositions[newPositions.length -1].distance;
    records[endIndex].velocity = records[endIndex-1].velocity;


    return activityData;
}

// class ActivityDropoutHandlerBackup {
//     constructor(activity, minDropoutDistance, maxTimeGapSeconds) {
//         if (!activity || !Array.isArray(activity.records)) {
//             throw new Error("Invalid activity data or records array.");
//         }

//         this.originalActivity = JSON.parse(JSON.stringify(activity)); // Deep copy of the original activity
//         this.activity = JSON.parse(JSON.stringify(activity)); // Working copy of the activity
//         this.minDropoutDistance = minDropoutDistance;
//         this.maxTimeGapSeconds = maxTimeGapSeconds;
//         this.dropoutBoundingIndices = identifyPositionDropouts(this.activity, this.maxTimeGapSeconds);
        
//         this.dropoutBoundingPositions = this.dropoutBoundingIndices.map(([startIndex, endIndex]) => {
//             const startPosition = this.activity.records[startIndex]?.position;
//             const endPosition = this.activity.records[endIndex]?.position;
//             return { startPosition, endPosition };
//         });

//         this.hasBeenRemapped = Array(dropoutBoundingIndices.length).fill(false);

        
//     }

//     getDropouts() {
//         console.log("bounding indices")
//         console.log(this.dropoutBoundingIndices);

//         console.log("bounding positions")
//         console.log(this.dropoutBoundingPositions);

//         // return this.dropoutBoundingIndices.map(([startIndex, endIndex]) => {
//         //     const startPosition = this.activity.records[startIndex]?.position;
//         //     const endPosition = this.activity.records[endIndex]?.position;
//         //     return { startPosition, endPosition };
//         // });

//         return this.dropoutBoundingPositions;
//     }

//     remapDropout(dropoutId, roughPolyline) {
//         if (dropoutId < 0 || dropoutId >= this.dropoutBoundingIndices.length) {
//             throw new Error("Invalid dropout ID.");
//         }

//         const [startIndex, endIndex] = this.dropoutBoundingIndices[dropoutId];
//         const numberOfDropoutTrackPoints = endIndex - startIndex - 1;

//         if (!Array.isArray(roughPolyline) || roughPolyline.length < 2) {
//             throw new Error("Invalid polyline: Must have at least two points.");
//         }

//         // Ensure the polyline starts and ends correctly
//         if (
//             JSON.stringify(roughPolyline[0]) !== JSON.stringify(this.activity.records[startIndex].position) ||
//             JSON.stringify(roughPolyline[roughPolyline.length - 1]) !== JSON.stringify(this.activity.records[endIndex].position)
//         ) {
//             throw new Error("Invalid polyline: Start and end positions must match dropout bounds.");
//         }

//         const totalRoughPolylineDistance = calculatePolylineLength(roughPolyline);
//         const distancePerIncrement = totalRoughPolylineDistance / (numberOfDropoutTrackPoints + 1);

//         let runningDistance = 0;
//         const interpolatedPositions = [];

//         for (let i = 0; i < numberOfDropoutTrackPoints; i++) {
//             runningDistance += distancePerIncrement;

//             const pointResult = findPointOnPolyline(roughPolyline, runningDistance);

//             if (pointResult.error) {
//                 throw new Error(`Error finding point on polyline: ${pointResult.error}`);
//             }

//             interpolatedPositions.push([pointResult.lat, pointResult.lon]);
//         }

//         updateActivitySection(this.activity, [startIndex, endIndex], interpolatedPositions);
//         this.hasBeenRemapped[dropoutId] = true;
//     }

//     resetDropout(dropoutId) {
//         if (dropoutId < 0 || dropoutId >= this.dropoutBoundingIndices.length) {
//             throw new Error("Invalid dropout ID.");
//         }

//         const [startIndex, endIndex] = this.dropoutBoundingIndices[dropoutId];
//         const originalSection = extractSubarray(this.originalActivity.records, [startIndex + 1, endIndex - 1]);

//         for (let i = startIndex + 1; i < endIndex; i++) {
//             this.activity.records[i].position = originalSection[i - (startIndex + 1)].position;
//         }

//         // Recalculate distances and velocities for the affected section
//         updateActivitySection(this.activity, [startIndex, endIndex], originalSection.map(record => record.position));

//         this.hasBeenRemapped[dropoutId] = false;
//     }

//     getRemappedData() {
//         return this.activity;
//     }
// }

// Function to calculate total distance covered
function calculateTotalDistance(records) {
    if (records.length <= 1) return 0;
    return records.slice(1).reduce((acc, record) => acc + (record.distance || 0), 0);
}

// Function to calculate total time in seconds
function calculateTotalTime(records) {
    if (records.length < 2) return 0;
    const startTime = new Date(records[0].timestamp).getTime();
    const endTime = new Date(records[records.length - 1].timestamp).getTime();
    return (endTime - startTime) / 1000;
}

class ActivityDropoutHandler {
    constructor(activity, minDropoutDistance, maxTimeGapSeconds) {
        if (!activity || !Array.isArray(activity.records)) {
            throw new Error("Invalid activity data or records array.");
        }

        this.originalActivity = JSON.parse(JSON.stringify(activity)); // Deep copy of the original activity
        this.activity = JSON.parse(JSON.stringify(activity)); // Working copy of the activity
        this.minDropoutDistance = minDropoutDistance;
        this.maxTimeGapSeconds = maxTimeGapSeconds;
        this.dropouts = identifyPositionDropouts(this.activity, this.maxTimeGapSeconds);

        this.hasBeenRemapped = Array(this.dropouts.length).fill(false);
    }

    getDropoutStartAndEnd() {
        return this.dropouts.map(([startIndex, endIndex]) => {
            const startPosition = this.activity.records[startIndex]?.position;
            const endPosition = this.activity.records[endIndex]?.position;
            return { startPosition, endPosition };
        });
    }

    getDropoutRecords(dropoutId) {
        if (dropoutId < 0 || dropoutId >= this.dropouts.length) {
            throw new Error("Invalid dropout ID.");
        }

        const [startIndex, endIndex] = this.dropouts[dropoutId];
        const records = this.activity.records;

        // Include the last non-null record before the dropout
        const startRecord = records[startIndex];

        // Include the first non-null record after the dropout
        const endRecord = records[endIndex];

        return {records: [startRecord, ...records.slice(startIndex + 1, endIndex), endRecord], hasBeenRemapped: this.hasBeenRemapped[dropoutId]};
        // return {records: records.slice(startIndex, endIndex), hasBeenRemapped: this.hasBeenRemapped[dropoutId]};
    }

    remapDropout(dropoutId, roughPolyline) {
        if (dropoutId < 0 || dropoutId >= this.dropouts.length) {
            throw new Error("Invalid dropout ID.");
        }

        const [startIndex, endIndex] = this.dropouts[dropoutId];
        const numberOfDropoutTrackPoints = endIndex - startIndex -1; 

        if (!Array.isArray(roughPolyline) || roughPolyline.length < 2) {
            throw new Error("Invalid polyline: Must have at least two points.");
        }

        // Ensure the polyline starts and ends correctly
        if (
            JSON.stringify(roughPolyline[0]) !== JSON.stringify(this.activity.records[startIndex].position) ||
            JSON.stringify(roughPolyline[roughPolyline.length - 1]) !== JSON.stringify(this.activity.records[endIndex].position)
        ) {
            throw new Error("Invalid polyline: Start and end positions must match dropout bounds.");
        }

        const totalRoughPolylineDistance = calculatePolylineLength(roughPolyline);

        // refactor to use avg velocity instead of average distance. 
        // const totalTime = calculateTotalTime(this.getDropoutRecords(dropoutId).records);
        // const averageVelocity = totalRoughPolylineDistance / totalTime;

        const distancePerIncrement = totalRoughPolylineDistance / (numberOfDropoutTrackPoints + 1);

        let runningDistance = 0;
        const interpolatedPositions = [];

        for (let i = 0; i < numberOfDropoutTrackPoints; i++) {
            runningDistance += distancePerIncrement;

            const pointResult = findPointOnPolyline(roughPolyline, runningDistance);

            if (pointResult.error) {
                throw new Error(`Error finding point on polyline: ${pointResult.error}`);
            }

            interpolatedPositions.push({position: {lat:pointResult.lat, lon: pointResult.lon}, distance: distancePerIncrement});
        }

        updateActivitySection(this.activity, [startIndex, endIndex], interpolatedPositions);
        this.hasBeenRemapped[dropoutId] = true;
    }

    resetDropout(dropoutId) {
        if (dropoutId < 0 || dropoutId >= this.dropouts.length) {
            throw new Error("Invalid dropout ID.");
        }

        const [startIndex, endIndex] = this.dropouts[dropoutId];
        const originalSection = extractSubarray(this.originalActivity.records, [startIndex + 1, endIndex - 1]);

        for (let i = startIndex + 1; i < endIndex; i++) {
            this.activity.records[i].position = originalSection[i - (startIndex + 1)].position;
        }

        // Recalculate distances and velocities for the affected section
        updateActivitySection(this.activity, [startIndex, endIndex], originalSection.map(record => record.position));

        this.hasBeenRemapped[dropoutId] = false;
    }

    getRemappedData() {
        return this.activity;
    }
}
