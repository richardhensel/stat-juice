

// Function to process parsed XML and return the required data structures
function processTcxXmlTotalDistAndCalories(xml) {
    // Extract activity metadata
    const activityElement = xml.getElementsByTagName('Activity')[0];
    const activityType = activityElement ? activityElement.getAttribute('Sport') : null;
    const activityId = activityElement ? activityElement.getElementsByTagName('Id')[0]?.textContent : null;

    // Prepare containers for record and lap data
    const records = [];
    const laps = [];

    // Get the laps from the TCX file
    const lapElements = xml.getElementsByTagName('Lap');

    for (let lapIndex = 0; lapIndex < lapElements.length; lapIndex++) {
        const lap = lapElements[lapIndex];
        const lapId = lapIndex + 1; // Assign a unique ID to each lap
        const lapStartTime = lap.getAttribute('StartTime');

        // Get lap-level data
        const lapCalories = parseFloat(lap.getElementsByTagName('Calories')[0]?.textContent || null);
        const lapDuration = parseFloat(lap.getElementsByTagName('TotalTimeSeconds')[0]?.textContent || null);
        const lapDistance = parseFloat(lap.getElementsByTagName('DistanceMeters')[0]?.textContent || null);
        const lapMaxSpeed = parseFloat(lap.getElementsByTagName('MaximumSpeed')[0]?.textContent || null);
        const lapAvgHeartRate = parseFloat(lap.getElementsByTagName('AverageHeartRateBpm')[0]?.getElementsByTagName('Value')[0]?.textContent || null);
        const lapMaxHeartRate = parseFloat(lap.getElementsByTagName('MaximumHeartRateBpm')[0]?.getElementsByTagName('Value')[0]?.textContent || null);
        const lapIntensity = lap.getElementsByTagName('Intensity')[0]?.textContent || null;
        const lapCadence = parseFloat(lap.getElementsByTagName('Cadence')[0]?.textContent || null);
        const lapTriggerMethod = lap.getElementsByTagName('TriggerMethod')[0]?.textContent || null;

        // Extract lap extensions
        const lapExtensions = lap.getElementsByTagName('Extensions')[0]?.getElementsByTagName('ns3:LX')[0];
        const lapAvgSpeed = parseFloat(lapExtensions?.getElementsByTagName('ns3:AvgSpeed')[0]?.textContent || null);
        const lapMaxBikeCadence = parseFloat(lapExtensions?.getElementsByTagName('ns3:MaxBikeCadence')[0]?.textContent || null);
        const lapSteps = parseInt(lapExtensions?.getElementsByTagName('ns3:Steps')[0]?.textContent || null);
        const lapAvgWatts = parseFloat(lapExtensions?.getElementsByTagName('ns3:AvgWatts')[0]?.textContent || null);
        const lapMaxWatts = parseFloat(lapExtensions?.getElementsByTagName('ns3:MaxWatts')[0]?.textContent || null);

        // Store lap data
        laps.push({
            lapId: lapId,
            startTime: lapStartTime,
            calories: lapCalories,
            duration: lapDuration,
            distance: lapDistance,
            maxSpeed: lapMaxSpeed,
            avgHeartRate: lapAvgHeartRate,
            maxHeartRate: lapMaxHeartRate,
            intensity: lapIntensity,
            cadence: lapCadence,
            triggerMethod: lapTriggerMethod,
            avgSpeed: lapAvgSpeed,
            maxBikeCadence: lapMaxBikeCadence,
            steps: lapSteps,
            avgWatts: lapAvgWatts,
            maxWatts: lapMaxWatts
        });

        const lapCalorieRate = (lapCalories && lapDuration) ? lapCalories / lapDuration : 0;

        // Process each trackpoint within this lap
        const trackpoints = lap.getElementsByTagName('Trackpoint');

        for (let i = 0; i < trackpoints.length; i++) {
            const trackpoint = trackpoints[i];
            const timestamp = trackpoint.getElementsByTagName('Time')[0]?.textContent || null;

            // Extract position data
            const position = trackpoint.getElementsByTagName('Position')[0];
            const lat = position ? parseFloat(position.getElementsByTagName('LatitudeDegrees')[0]?.textContent || null) : null;
            const lon = position ? parseFloat(position.getElementsByTagName('LongitudeDegrees')[0]?.textContent || null) : null;

            // Extract additional data
            const altitude = parseFloat(trackpoint.getElementsByTagName('AltitudeMeters')[0]?.textContent || null);
            const distance = parseFloat(trackpoint.getElementsByTagName('DistanceMeters')[0]?.textContent || null);
            const hr = parseFloat(trackpoint.getElementsByTagName('HeartRateBpm')[0]?.getElementsByTagName('Value')[0]?.textContent || null);
            const cadence = parseFloat(trackpoint.getElementsByTagName('Cadence')[0]?.textContent || null);
            const power = parseFloat(trackpoint.getElementsByTagName('Extensions')[0]?.getElementsByTagName('ns3:TPX')[0]?.getElementsByTagName('ns3:Watts')[0]?.textContent || null);
            const speed = parseFloat(trackpoint.getElementsByTagName('Extensions')[0]?.getElementsByTagName('ns3:TPX')[0]?.getElementsByTagName('ns3:Speed')[0]?.textContent || null);
            const temperature = parseFloat(trackpoint.getElementsByTagName('Temperature')[0]?.textContent || null);

            // Store the data for this trackpoint
            records.push({
                lapId: lapId, // Tag the record entry with the lap ID
                timestamp: timestamp,
                position: [lat, lon],
                altitude: altitude,
                distance: distance,
                hr: hr,
                cadence: cadence,
                power: power,
                speed: speed,
                calorieRate: lapCalorieRate,
                temperature: temperature
            });
        }
    }

    // Extract Creator information
    const creatorElement = activityElement.getElementsByTagName('Creator')[0];
    const creator = creatorElement ? {
        name: creatorElement.getElementsByTagName('Name')[0]?.textContent,
        unitId: creatorElement.getElementsByTagName('UnitId')[0]?.textContent,
        productId: creatorElement.getElementsByTagName('ProductID')[0]?.textContent,
        version: {
            major: creatorElement.getElementsByTagName('VersionMajor')[0]?.textContent,
            minor: creatorElement.getElementsByTagName('VersionMinor')[0]?.textContent,
            buildMajor: creatorElement.getElementsByTagName('BuildMajor')[0]?.textContent,
            buildMinor: creatorElement.getElementsByTagName('BuildMinor')[0]?.textContent
        }
    } : null;

    // Extract Author information
    const authorElement = xml.getElementsByTagName('Author')[0];
    const author = authorElement ? {
        name: authorElement.getElementsByTagName('Name')[0]?.textContent,
        langId: authorElement.getElementsByTagName('LangID')[0]?.textContent,
        partNumber: authorElement.getElementsByTagName('PartNumber')[0]?.textContent,
        version: {
            major: authorElement.getElementsByTagName('VersionMajor')[0]?.textContent,
            minor: authorElement.getElementsByTagName('VersionMinor')[0]?.textContent,
            buildMajor: authorElement.getElementsByTagName('BuildMajor')[0]?.textContent,
            buildMinor: authorElement.getElementsByTagName('BuildMinor')[0]?.textContent
        }
    } : null;

    // Return the data structures
    return {
        records: records,
        laps: laps, // Return all lap data
        activity: {
            activityType: activityType,
            activityId: activityId,
            creator: creator,
            author: author
        }
    };
}

function processTcxXml(xml) {
    // Extract activity metadata
    const activityElement = xml.getElementsByTagName('Activity')[0];
    const activityType = activityElement ? activityElement.getAttribute('Sport') : null;
    const activityId = activityElement ? activityElement.getElementsByTagName('Id')[0]?.textContent : null;

    // Prepare containers for record and lap data
    const records = [];
    const laps = [];

    // Variables to keep track of the previous distance and calorie values
    let previousDistance = 0;
    let previousCalories = 0;

    // Get the laps from the TCX file
    const lapElements = xml.getElementsByTagName('Lap');

    for (let lapIndex = 0; lapIndex < lapElements.length; lapIndex++) {
        const lap = lapElements[lapIndex];
        const lapId = lapIndex + 1; // Assign a unique ID to each lap
        const lapStartTime = lap.getAttribute('StartTime');

        // Get lap-level data
        const lapCalories = parseFloat(lap.getElementsByTagName('Calories')[0]?.textContent || null);
        const lapDuration = parseFloat(lap.getElementsByTagName('TotalTimeSeconds')[0]?.textContent || null);
        const lapDistance = parseFloat(lap.getElementsByTagName('DistanceMeters')[0]?.textContent || null);
        const lapMaxSpeed = parseFloat(lap.getElementsByTagName('MaximumSpeed')[0]?.textContent || null);
        const lapAvgHeartRate = parseFloat(lap.getElementsByTagName('AverageHeartRateBpm')[0]?.getElementsByTagName('Value')[0]?.textContent || null);
        const lapMaxHeartRate = parseFloat(lap.getElementsByTagName('MaximumHeartRateBpm')[0]?.getElementsByTagName('Value')[0]?.textContent || null);
        const lapIntensity = lap.getElementsByTagName('Intensity')[0]?.textContent || null;
        const lapCadence = parseFloat(lap.getElementsByTagName('Cadence')[0]?.textContent || null);
        const lapTriggerMethod = lap.getElementsByTagName('TriggerMethod')[0]?.textContent || null;

        // Extract lap extensions
        const lapExtensions = lap.getElementsByTagName('Extensions')[0]?.getElementsByTagName('ns3:LX')[0];
        const lapAvgSpeed = parseFloat(lapExtensions?.getElementsByTagName('ns3:AvgSpeed')[0]?.textContent || null);
        const lapMaxBikeCadence = parseFloat(lapExtensions?.getElementsByTagName('ns3:MaxBikeCadence')[0]?.textContent || null);
        const lapSteps = parseInt(lapExtensions?.getElementsByTagName('ns3:Steps')[0]?.textContent || null);
        const lapAvgWatts = parseFloat(lapExtensions?.getElementsByTagName('ns3:AvgWatts')[0]?.textContent || null);
        const lapMaxWatts = parseFloat(lapExtensions?.getElementsByTagName('ns3:MaxWatts')[0]?.textContent || null);

        // Store lap data
        laps.push({
            lapId: lapId,
            startTime: lapStartTime,
            calories: lapCalories,
            duration: lapDuration,
            distance: lapDistance,
            maxSpeed: lapMaxSpeed,
            avgHeartRate: lapAvgHeartRate,
            maxHeartRate: lapMaxHeartRate,
            intensity: lapIntensity,
            cadence: lapCadence,
            triggerMethod: lapTriggerMethod,
            avgSpeed: lapAvgSpeed,
            maxBikeCadence: lapMaxBikeCadence,
            steps: lapSteps,
            avgWatts: lapAvgWatts,
            maxWatts: lapMaxWatts
        });

        const lapCalorieRate = (lapCalories && lapDuration) ? lapCalories / lapDuration : 0;

        // Process each trackpoint within this lap
        const trackpoints = lap.getElementsByTagName('Trackpoint');

        for (let i = 0; i < trackpoints.length; i++) {
            const trackpoint = trackpoints[i];
            const timestamp = trackpoint.getElementsByTagName('Time')[0]?.textContent || null;

            // Extract position data
            const position = trackpoint.getElementsByTagName('Position')[0];
            const lat = position ? parseFloat(position.getElementsByTagName('LatitudeDegrees')[0]?.textContent || null) : null;
            const lon = position ? parseFloat(position.getElementsByTagName('LongitudeDegrees')[0]?.textContent || null) : null;

            // Extract additional data
            const altitude = parseFloat(trackpoint.getElementsByTagName('AltitudeMeters')[0]?.textContent || null);
            const distance = parseFloat(trackpoint.getElementsByTagName('DistanceMeters')[0]?.textContent || null);
            const hr = parseFloat(trackpoint.getElementsByTagName('HeartRateBpm')[0]?.getElementsByTagName('Value')[0]?.textContent || null);
            const cadence = parseFloat(trackpoint.getElementsByTagName('Cadence')[0]?.textContent || null);
            const power = parseFloat(trackpoint.getElementsByTagName('Extensions')[0]?.getElementsByTagName('ns3:TPX')[0]?.getElementsByTagName('ns3:Watts')[0]?.textContent || null);
            const speed = parseFloat(trackpoint.getElementsByTagName('Extensions')[0]?.getElementsByTagName('ns3:TPX')[0]?.getElementsByTagName('ns3:Speed')[0]?.textContent || null);
            const temperature = parseFloat(trackpoint.getElementsByTagName('Temperature')[0]?.textContent || null);

            // Calculate incremental values
            const incrementalDistance = distance !== null ? distance - previousDistance : null;
            const incrementalCalories = lapCalorieRate ? lapCalorieRate * (trackpoint.getElementsByTagName('TotalTimeSeconds')[0]?.textContent || 0) : 0;

            // Update previous values
            previousDistance = distance !== null ? distance : previousDistance;
            previousCalories += incrementalCalories;

            // Store the data for this trackpoint
            records.push({
                lapId: lapId, // Tag the record entry with the lap ID
                timestamp: timestamp,
                position: [lat, lon],
                altitude: altitude,
                distance: incrementalDistance,
                hr: hr,
                cadence: cadence,
                power: power,
                speed: speed,
                calorieRate: lapCalorieRate,
                temperature: temperature
            });
        }
    }

    // Extract Creator information
    const creatorElement = activityElement.getElementsByTagName('Creator')[0];
    const creator = creatorElement ? {
        name: creatorElement.getElementsByTagName('Name')[0]?.textContent,
        unitId: creatorElement.getElementsByTagName('UnitId')[0]?.textContent,
        productId: creatorElement.getElementsByTagName('ProductID')[0]?.textContent,
        version: {
            major: creatorElement.getElementsByTagName('VersionMajor')[0]?.textContent,
            minor: creatorElement.getElementsByTagName('VersionMinor')[0]?.textContent,
            buildMajor: creatorElement.getElementsByTagName('BuildMajor')[0]?.textContent,
            buildMinor: creatorElement.getElementsByTagName('BuildMinor')[0]?.textContent
        }
    } : null;

    // Extract Author information
    const authorElement = xml.getElementsByTagName('Author')[0];
    const author = authorElement ? {
        name: authorElement.getElementsByTagName('Name')[0]?.textContent,
        langId: authorElement.getElementsByTagName('LangID')[0]?.textContent,
        partNumber: authorElement.getElementsByTagName('PartNumber')[0]?.textContent,
        version: {
            major: authorElement.getElementsByTagName('VersionMajor')[0]?.textContent,
            minor: authorElement.getElementsByTagName('VersionMinor')[0]?.textContent,
            buildMajor: authorElement.getElementsByTagName('BuildMajor')[0]?.textContent,
            buildMinor: authorElement.getElementsByTagName('BuildMinor')[0]?.textContent
        }
    } : null;

    // Return the data structures
    return {
        records: records,
        laps: laps, // Return all lap data
        activity: {
            activityType: activityType,
            activityId: activityId,
            creator: creator,
            author: author
        }
    };
}

function appendActivitiesSimpleCumulativeDistance(activityDataList) {
    if (!Array.isArray(activityDataList) || activityDataList.length === 0) {
        throw new Error("Input must be a non-empty array of activityData.");
    }

    // Initialize the appended activity with the metadata from the first activity
    const appendedActivity = {
        records: [],
        laps: [],
        activity: {
            activityType: activityDataList[0].activity.activityType,
            activityId: activityDataList[0].activity.activityId,
            creator: activityDataList[0].activity.creator,
            author: activityDataList[0].activity.author
        }
    };

    let lastLapId = 0;
    let lastDistance = 0;

    // Iterate over each activityData in the input list
    for (const activityData of activityDataList) {
        // Adjust lap IDs and append laps
        for (const lap of activityData.laps) {
            const adjustedLap = {
                ...lap,
                lapId: lap.lapId + lastLapId
            };
            appendedActivity.laps.push(adjustedLap);
        }

        // Adjust record data and append records
        for (const record of activityData.records) {
            const adjustedRecord = {
                ...record,
                lapId: record.lapId + lastLapId,
                distance: record.distance !== null ? record.distance + lastDistance : null
            };
            appendedActivity.records.push(adjustedRecord);
        }

        // Update lastLapId and lastDistance for the next iteration
        lastLapId += activityData.laps.length;
        if (activityData.records.length > 0) {
            const lastRecord = activityData.records[activityData.records.length - 1];
            if (lastRecord.distance !== null) {
                lastDistance += lastRecord.distance;
            }
        }
    }

    return appendedActivity;
}

function appendActivitiesSimple(activityDataList) {
    if (!Array.isArray(activityDataList) || activityDataList.length === 0) {
        throw new Error("Input must be a non-empty array of activityData.");
    }

    // Initialize the appended activity with the metadata from the first activity
    const appendedActivity = {
        records: [],
        laps: [],
        activity: {
            activityType: activityDataList[0].activity.activityType,
            activityId: activityDataList[0].activity.activityId,
            creator: activityDataList[0].activity.creator,
            author: activityDataList[0].activity.author
        }
    };

    let lastLapId = 0;

    // Iterate over each activityData in the input list
    for (const activityData of activityDataList) {
        // Adjust lap IDs and append laps
        for (const lap of activityData.laps) {
            const adjustedLap = {
                ...lap,
                lapId: lap.lapId + lastLapId // Adjust lap IDs to ensure uniqueness
            };
            appendedActivity.laps.push(adjustedLap);
        }

        // Append records without modifying the distance or calorie fields
        for (const record of activityData.records) {
            const adjustedRecord = {
                ...record,
                lapId: record.lapId + lastLapId // Adjust lap IDs to ensure uniqueness
            };
            appendedActivity.records.push(adjustedRecord);
        }

        // Update lastLapId for the next iteration
        lastLapId += activityData.laps.length;
    }

    return appendedActivity;
}

// Function to create a TCX file from activity data
function createTcxFileNoReaccumulation(activityData) {
    const xmlDoc = document.implementation.createDocument(null, "TrainingCenterDatabase", null);

    // Add namespace attributes
    const root = xmlDoc.documentElement;
    root.setAttribute("xmlns", "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2");
    root.setAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
    root.setAttribute("xsi:schemaLocation", "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd");
    root.setAttribute("xmlns:ns5", "http://www.garmin.com/xmlschemas/ActivityGoals/v1");
    root.setAttribute("xmlns:ns3", "http://www.garmin.com/xmlschemas/ActivityExtension/v2");
    root.setAttribute("xmlns:ns2", "http://www.garmin.com/xmlschemas/UserProfile/v2");
    root.setAttribute("xmlns:ns4", "http://www.garmin.com/xmlschemas/ProfileExtension/v1");

    // Create Activities element
    const activitiesElem = xmlDoc.createElement("Activities");
    const activityElem = xmlDoc.createElement("Activity");
    activityElem.setAttribute("Sport", activityData.activity.activityType);

    // Add Activity ID
    const idElem = xmlDoc.createElement("Id");
    idElem.textContent = activityData.activity.activityId;
    activityElem.appendChild(idElem);

    // Add laps
    for (const lap of activityData.laps) {
        const lapElem = xmlDoc.createElement("Lap");
        lapElem.setAttribute("StartTime", lap.startTime);

        // Add lap data
        const totalTimeElem = xmlDoc.createElement("TotalTimeSeconds");
        totalTimeElem.textContent = lap.duration;
        lapElem.appendChild(totalTimeElem);

        const distanceElem = xmlDoc.createElement("DistanceMeters");
        distanceElem.textContent = lap.distance;
        lapElem.appendChild(distanceElem);

        const maxSpeedElem = xmlDoc.createElement("MaximumSpeed");
        maxSpeedElem.textContent = lap.maxSpeed;
        lapElem.appendChild(maxSpeedElem);

        const caloriesElem = xmlDoc.createElement("Calories");
        caloriesElem.textContent = lap.calories;
        lapElem.appendChild(caloriesElem);

        const avgHrElem = xmlDoc.createElement("AverageHeartRateBpm");
        const avgHrValueElem = xmlDoc.createElement("Value");
        avgHrValueElem.textContent = lap.avgHeartRate;
        avgHrElem.appendChild(avgHrValueElem);
        lapElem.appendChild(avgHrElem);

        const maxHrElem = xmlDoc.createElement("MaximumHeartRateBpm");
        const maxHrValueElem = xmlDoc.createElement("Value");
        maxHrValueElem.textContent = lap.maxHeartRate;
        maxHrElem.appendChild(maxHrValueElem);
        lapElem.appendChild(maxHrElem);

        const intensityElem = xmlDoc.createElement("Intensity");
        intensityElem.textContent = lap.intensity;
        lapElem.appendChild(intensityElem);

        const cadenceElem = xmlDoc.createElement("Cadence");
        cadenceElem.textContent = lap.cadence;
        lapElem.appendChild(cadenceElem);

        const triggerElem = xmlDoc.createElement("TriggerMethod");
        triggerElem.textContent = lap.triggerMethod;
        lapElem.appendChild(triggerElem);

        // Add trackpoints for this lap
        const trackElem = xmlDoc.createElement("Track");
        const lapRecords = activityData.records.filter(record => record.lapId === lap.lapId);

        for (const record of lapRecords) {
            const trackpointElem = xmlDoc.createElement("Trackpoint");

            const timeElem = xmlDoc.createElement("Time");
            timeElem.textContent = record.timestamp;
            trackpointElem.appendChild(timeElem);

            if (record.position[0] !== null && record.position[1] !== null) {
                const positionElem = xmlDoc.createElement("Position");

                const latElem = xmlDoc.createElement("LatitudeDegrees");
                latElem.textContent = record.position[0];
                positionElem.appendChild(latElem);

                const lonElem = xmlDoc.createElement("LongitudeDegrees");
                lonElem.textContent = record.position[1];
                positionElem.appendChild(lonElem);

                trackpointElem.appendChild(positionElem);
            }

            const altitudeElem = xmlDoc.createElement("AltitudeMeters");
            altitudeElem.textContent = record.altitude;
            trackpointElem.appendChild(altitudeElem);

            const distanceElem = xmlDoc.createElement("DistanceMeters");
            distanceElem.textContent = record.distance;
            trackpointElem.appendChild(distanceElem);

            const hrElem = xmlDoc.createElement("HeartRateBpm");
            const hrValueElem = xmlDoc.createElement("Value");
            hrValueElem.textContent = record.hr;
            hrElem.appendChild(hrValueElem);
            trackpointElem.appendChild(hrElem);

            const cadenceElem = xmlDoc.createElement("Cadence");
            cadenceElem.textContent = record.cadence;
            trackpointElem.appendChild(cadenceElem);

            const extensionsElem = xmlDoc.createElement("Extensions");
            const tpxElem = xmlDoc.createElement("ns3:TPX");

            const speedElem = xmlDoc.createElement("ns3:Speed");
            speedElem.textContent = record.speed;
            tpxElem.appendChild(speedElem);

            const wattsElem = xmlDoc.createElement("ns3:Watts");
            wattsElem.textContent = record.power;
            tpxElem.appendChild(wattsElem);

            extensionsElem.appendChild(tpxElem);
            trackpointElem.appendChild(extensionsElem);

            trackElem.appendChild(trackpointElem);
        }

        lapElem.appendChild(trackElem);
        activityElem.appendChild(lapElem);
    }

    activitiesElem.appendChild(activityElem);
    root.appendChild(activitiesElem);

    // Serialize XML to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
}

// Function to format XML string
function formatXml(xml) {
    const PADDING = '  '; // Define indentation level
    const reg = /(>)(<)(\/*)/g;
    let formatted = '';
    let pad = 0;

    // Add XML declaration
    const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml = xml.replace(reg, '$1\r\n$2$3');

    xml.split('\r\n').forEach((node) => {
        let indent = 0;
        if (node.match(/.+<\//)) {
            indent = 0;
        } else if (node.match(/^<\//)) {
            if (pad !== 0) {
                pad -= 1;
            }
        } else if (node.match(/^<[^\/?].*>$/)) {
            indent = 1;
        }

        formatted += PADDING.repeat(pad) + node + '\r\n';
        pad += indent;
    });

    return xmlDeclaration + formatted;
}

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

                if (timeGap <= maxTimeGapSeconds) {
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

    for (let i = startIndex + 1; i < endIndex; i++) {
        const record = records[i];
        if (record.position[0] !== null || record.position[1] !== null) {
            throw new Error("Invalid section: All elements between the indices must have null position values.");
        }
    }

    // Overwrite the positions
    let previousPosition = records[startIndex].position;
    if (previousPosition[0] === null || previousPosition[1] === null) {
        throw new Error("Invalid start position: Must have valid coordinates.");
    }

    for (let i = 0; i < newPositions.length; i++) {
        const currentIndex = startIndex + 1 + i;
        records[currentIndex].position = newPositions[i];
    }

    let nextPosition = records[endIndex].position;
    if (nextPosition[0] === null || nextPosition[1] === null) {
        throw new Error("Invalid end position: Must have valid coordinates.");
    }

    // Update distances
    let cumulativeDistance = 0;

    for (let i = startIndex; i <= endIndex; i++) {
        const currentRecord = records[i];
        const nextRecord = i < endIndex ? records[i + 1] : null;

        if (nextRecord) {
            const distance = haversineDistance(
                currentRecord.position,
                nextRecord.position
            );
            cumulativeDistance += distance;
            currentRecord.distance = cumulativeDistance;
        }
    }

    // Update velocities
    for (let i = startIndex + 1; i <= endIndex; i++) {
        const previousRecord = records[i - 1];
        const currentRecord = records[i];

        const timeDelta =
            (new Date(currentRecord.timestamp).getTime() -
                new Date(previousRecord.timestamp).getTime()) /
            1000; // seconds

        const distance = currentRecord.distance - previousRecord.distance;
        currentRecord.velocity = timeDelta > 0 ? distance / timeDelta : 0;
    }

    return activityData;
}

function createTcxFile(activityData) {
    const xmlDoc = document.implementation.createDocument(null, "TrainingCenterDatabase", null);

    // Add namespace attributes
    const root = xmlDoc.documentElement;
    root.setAttribute("xmlns", "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2");
    root.setAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
    root.setAttribute("xsi:schemaLocation", "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd");
    root.setAttribute("xmlns:ns5", "http://www.garmin.com/xmlschemas/ActivityGoals/v1");
    root.setAttribute("xmlns:ns3", "http://www.garmin.com/xmlschemas/ActivityExtension/v2");
    root.setAttribute("xmlns:ns2", "http://www.garmin.com/xmlschemas/UserProfile/v2");
    root.setAttribute("xmlns:ns4", "http://www.garmin.com/xmlschemas/ProfileExtension/v1");

    // Create Activities element
    const activitiesElem = xmlDoc.createElement("Activities");
    const activityElem = xmlDoc.createElement("Activity");
    activityElem.setAttribute("Sport", activityData.activity.activityType);

    // Add Activity ID
    const idElem = xmlDoc.createElement("Id");
    idElem.textContent = activityData.activity.activityId;
    activityElem.appendChild(idElem);

    // Add laps
    for (const lap of activityData.laps) {
        const lapElem = xmlDoc.createElement("Lap");
        lapElem.setAttribute("StartTime", lap.startTime);

        // Add lap data
        const totalTimeElem = xmlDoc.createElement("TotalTimeSeconds");
        totalTimeElem.textContent = lap.duration;
        lapElem.appendChild(totalTimeElem);

        const distanceElem = xmlDoc.createElement("DistanceMeters");
        distanceElem.textContent = lap.distance;
        lapElem.appendChild(distanceElem);

        const maxSpeedElem = xmlDoc.createElement("MaximumSpeed");
        maxSpeedElem.textContent = lap.maxSpeed;
        lapElem.appendChild(maxSpeedElem);

        const caloriesElem = xmlDoc.createElement("Calories");
        caloriesElem.textContent = lap.calories;
        lapElem.appendChild(caloriesElem);

        const avgHrElem = xmlDoc.createElement("AverageHeartRateBpm");
        const avgHrValueElem = xmlDoc.createElement("Value");
        avgHrValueElem.textContent = lap.avgHeartRate;
        avgHrElem.appendChild(avgHrValueElem);
        lapElem.appendChild(avgHrElem);

        const maxHrElem = xmlDoc.createElement("MaximumHeartRateBpm");
        const maxHrValueElem = xmlDoc.createElement("Value");
        maxHrValueElem.textContent = lap.maxHeartRate;
        maxHrElem.appendChild(maxHrValueElem);
        lapElem.appendChild(maxHrElem);

        const intensityElem = xmlDoc.createElement("Intensity");
        intensityElem.textContent = lap.intensity;
        lapElem.appendChild(intensityElem);

        const cadenceElem = xmlDoc.createElement("Cadence");
        cadenceElem.textContent = lap.cadence;
        lapElem.appendChild(cadenceElem);

        const triggerElem = xmlDoc.createElement("TriggerMethod");
        triggerElem.textContent = lap.triggerMethod;
        lapElem.appendChild(triggerElem);

        // Add trackpoints for this lap
        const trackElem = xmlDoc.createElement("Track");
        const lapRecords = activityData.records.filter(record => record.lapId === lap.lapId);

        let cumulativeDistance = 0;
        let cumulativeCalories = 0;

        for (const record of lapRecords) {
            const trackpointElem = xmlDoc.createElement("Trackpoint");

            const timeElem = xmlDoc.createElement("Time");
            timeElem.textContent = record.timestamp;
            trackpointElem.appendChild(timeElem);

            if (record.position[0] !== null && record.position[1] !== null) {
                const positionElem = xmlDoc.createElement("Position");

                const latElem = xmlDoc.createElement("LatitudeDegrees");
                latElem.textContent = record.position[0];
                positionElem.appendChild(latElem);

                const lonElem = xmlDoc.createElement("LongitudeDegrees");
                lonElem.textContent = record.position[1];
                positionElem.appendChild(lonElem);

                trackpointElem.appendChild(positionElem);
            }

            const altitudeElem = xmlDoc.createElement("AltitudeMeters");
            altitudeElem.textContent = record.altitude;
            trackpointElem.appendChild(altitudeElem);

            // Re-accumulate distance and calories
            if (record.distance !== null) {
                cumulativeDistance += record.distance;
            }

            if (record.calorieRate !== null && record.calorieRate > 0) {
                const timeDifference = record.timestamp ? (new Date(record.timestamp).getTime() - new Date(lap.startTime).getTime()) / 1000 : 0;
                cumulativeCalories += record.calorieRate * timeDifference;
            }

            const distanceElem = xmlDoc.createElement("DistanceMeters");
            distanceElem.textContent = cumulativeDistance;
            trackpointElem.appendChild(distanceElem);

            const hrElem = xmlDoc.createElement("HeartRateBpm");
            const hrValueElem = xmlDoc.createElement("Value");
            hrValueElem.textContent = record.hr;
            hrElem.appendChild(hrValueElem);
            trackpointElem.appendChild(hrElem);

            const cadenceElem = xmlDoc.createElement("Cadence");
            cadenceElem.textContent = record.cadence;
            trackpointElem.appendChild(cadenceElem);

            const extensionsElem = xmlDoc.createElement("Extensions");
            const tpxElem = xmlDoc.createElement("ns3:TPX");

            const speedElem = xmlDoc.createElement("ns3:Speed");
            speedElem.textContent = record.speed;
            tpxElem.appendChild(speedElem);

            const wattsElem = xmlDoc.createElement("ns3:Watts");
            wattsElem.textContent = record.power;
            tpxElem.appendChild(wattsElem);

            extensionsElem.appendChild(tpxElem);
            trackpointElem.appendChild(extensionsElem);

            trackElem.appendChild(trackpointElem);
        }

        lapElem.appendChild(trackElem);
        activityElem.appendChild(lapElem);
    }

    activitiesElem.appendChild(activityElem);
    root.appendChild(activitiesElem);

    // Serialize XML to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
}





// How to append:

// basic version: there will be a gap in space and time since the previous 

// check: timestamp of file 2 after the last timestamp of file 1

// position: just Append
// altitude: just Append
// distance: add file2 distances to the max distance of datapoints in file 1
// hr: just Append
// cadence: just Append
// power: just Append
// speed: just Append
// calorieRate: just Append
// temp: just Append


// How to merge

// if there is overlap in timestamps, provide options for which data channels are used from which FileSystem


// Fill position data

// Identify points where gps position is not included but other data channels are still ProgressEvent
//     in this case we'll just add position and distance data into the datapoints that already exist.
// Identify points where gps position and time jumps dramatically between consecutive timesamples
//     check that the distance over time between consecutive samples isn't more than a reasonable threshold (50km/h?)
//     in this case we'll need to create timestamps, position and distance data.