// Function to process parsed XML and return the required data structures
// function processTcxXmlBackup(xml) {
//     // Extract activity metadata
//     const activityElement = xml.getElementsByTagName('Activity')[0];
//     const activityType = activityElement ? activityElement.getAttribute('Sport') : null;
//     const activityId = activityElement ? activityElement.getElementsByTagName('Id')[0]?.textContent : null;

//     // Extract schema version and XML version from the XML
//     const schemaLocation = xml.documentElement.getAttribute('xsi:schemaLocation');
//     const xmlVersion = xml.xmlVersion;

//     // Prepare containers for timeseries and lap data
//     const timeseriesData = [];
//     const lapStartTimes = [];

//     // Get the laps from the TCX file
//     const laps = xml.getElementsByTagName('Lap');

//     for (let lapIndex = 0; lapIndex < laps.length; lapIndex++) {
//         const lap = laps[lapIndex];
//         const lapStartTime = lap.getAttribute('StartTime');
//         lapStartTimes.push(lapStartTime);

//         // Get lap-level data: total calories and total time
//         const lapCalories = parseFloat(lap.getElementsByTagName('Calories')[0]?.textContent || null);
//         const lapDuration = parseFloat(lap.getElementsByTagName('TotalTimeSeconds')[0]?.textContent || null);
//         const lapCalorieRate = (lapCalories && lapDuration) ? lapCalories / lapDuration : 0;

//         // Process each trackpoint within this lap
//         const trackpoints = lap.getElementsByTagName('Trackpoint');
//         // let previousTrackpoint = null;

//         for (let i = 0; i < trackpoints.length; i++) {
//             const trackpoint = trackpoints[i];
//             const timestamp = trackpoint.getElementsByTagName('Time')[0]?.textContent || null;

//             // Extract position data
//             const position = trackpoint.getElementsByTagName('Position')[0];
//             const lat = position ? parseFloat(position.getElementsByTagName('LatitudeDegrees')[0]?.textContent || null) : null;
//             const lon = position ? parseFloat(position.getElementsByTagName('LongitudeDegrees')[0]?.textContent || null) : null;

//             // Extract additional data
//             const altitude = parseFloat(trackpoint.getElementsByTagName('AltitudeMeters')[0]?.textContent || null);
//             const distance = parseFloat(trackpoint.getElementsByTagName('DistanceMeters')[0]?.textContent || null);
//             const hr = parseFloat(trackpoint.getElementsByTagName('HeartRateBpm')[0]?.getElementsByTagName('Value')[0]?.textContent || null);
//             const cadence = parseFloat(trackpoint.getElementsByTagName('Cadence')[0]?.textContent || null);
//             const power = parseFloat(trackpoint.getElementsByTagName('Extensions')[0]?.getElementsByTagName('ns3:TPX')[0]?.getElementsByTagName('ns3:Watts')[0]?.textContent || null);
//             const speed = parseFloat(trackpoint.getElementsByTagName('Extensions')[0]?.getElementsByTagName('ns3:TPX')[0]?.getElementsByTagName('ns3:Speed')[0]?.textContent || null);
//             const temperature = parseFloat(trackpoint.getElementsByTagName('Temperature')[0]?.textContent || null);
//             // const course = parseFloat(trackpoint.getElementsByTagName('Course')[0]?.textContent || null);

//             // Store the data for this trackpoint
//             timeseriesData.push({
//                 timestamp: timestamp,
//                 position: [lat, lon],
//                 altitude: altitude,
//                 distance: distance,
//                 hr: hr,
//                 cadence: cadence,
//                 power: power,
//                 speed: speed,
//                 calorieRate: lapCalorieRate,
//                 temperature: temperature,
//                 // course: course
//             });
//         }
//     }

//     // Return the data structures
//     return {
//         timeseriesData: timeseriesData,
//         lapStartTimes: lapStartTimes,
//         activityData: {
//             activityType: activityType,
//             activityId: activityId
//         },
//         metadata: {
//             xmlVersion: xmlVersion,
//             schemaLocation: schemaLocation
//         }
//     };
// }


// Function to process parsed XML and return the required data structures
function processTcxXmlBackup2(xml) {
    // Extract activity metadata
    const activityElement = xml.getElementsByTagName('Activity')[0];
    const activityType = activityElement ? activityElement.getAttribute('Sport') : null;
    const activityId = activityElement ? activityElement.getElementsByTagName('Id')[0]?.textContent : null;

    // Extract schema version and XML version from the XML
    const schemaLocation = xml.documentElement.getAttribute('xsi:schemaLocation');
    const xmlVersion = xml.xmlVersion;

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
            triggerMethod: lapTriggerMethod
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

    // Return the data structures
    return {
        records: records,
        laps: laps, // Return all lap data
        activityData: {
            activityType: activityType,
            activityId: activityId
        },
        metadata: {
            xmlVersion: xmlVersion,
            schemaLocation: schemaLocation
        }
    };
}

// Function to process parsed XML and return the required data structures
function processTcxXml(xml) {
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

// Function to create a TCX file from activity data
function createTcxFileBackup(activityData) {
    const xmlDoc = document.implementation.createDocument(null, "TrainingCenterDatabase", null);

    // Add namespace attributes
    const root = xmlDoc.documentElement;
    root.setAttribute("xmlns", "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2");
    root.setAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
    root.setAttribute("xsi:schemaLocation", "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd");

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

        // Add lap extensions
        const extensionsElem = xmlDoc.createElement("Extensions");
        const lxElem = xmlDoc.createElement("ns3:LX");

        const avgSpeedElem = xmlDoc.createElement("ns3:AvgSpeed");
        avgSpeedElem.textContent = lap.avgSpeed;
        lxElem.appendChild(avgSpeedElem);

        const maxBikeCadenceElem = xmlDoc.createElement("ns3:MaxBikeCadence");
        maxBikeCadenceElem.textContent = lap.maxBikeCadence;
        lxElem.appendChild(maxBikeCadenceElem);

        const stepsElem = xmlDoc.createElement("ns3:Steps");
        stepsElem.textContent = lap.steps;
        lxElem.appendChild(stepsElem);

        const avgWattsElem = xmlDoc.createElement("ns3:AvgWatts");
        avgWattsElem.textContent = lap.avgWatts;
        lxElem.appendChild(avgWattsElem);

        const maxWattsElem = xmlDoc.createElement("ns3:MaxWatts");
        maxWattsElem.textContent = lap.maxWatts;
        lxElem.appendChild(maxWattsElem);

        extensionsElem.appendChild(lxElem);
        lapElem.appendChild(extensionsElem);

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

    // Add Creator
    if (activityData.activity.creator) {
        const creatorElem = xmlDoc.createElement("Creator");
        creatorElem.setAttribute("xsi:type", "Device_t");

        const nameElem = xmlDoc.createElement("Name");
        nameElem.textContent = activityData.activity.creator.name;
        creatorElem.appendChild(nameElem);

        const unitIdElem = xmlDoc.createElement("UnitId");
        unitIdElem.textContent = activityData.activity.creator.unitId;
        creatorElem.appendChild(unitIdElem);

        const productIdElem = xmlDoc.createElement("ProductID");
        productIdElem.textContent = activityData.activity.creator.productId;
        creatorElem.appendChild(productIdElem);

        const versionElem = xmlDoc.createElement("Version");
        const versionMajorElem = xmlDoc.createElement("VersionMajor");
        versionMajorElem.textContent = activityData.activity.creator.version.major;
        versionElem.appendChild(versionMajorElem);

        const versionMinorElem = xmlDoc.createElement("VersionMinor");
        versionMinorElem.textContent = activityData.activity.creator.version.minor;
        versionElem.appendChild(versionMinorElem);

        const buildMajorElem = xmlDoc.createElement("BuildMajor");
        buildMajorElem.textContent = activityData.activity.creator.version.buildMajor;
        versionElem.appendChild(buildMajorElem);

        const buildMinorElem = xmlDoc.createElement("BuildMinor");
        buildMinorElem.textContent = activityData.activity.creator.version.buildMinor;
        versionElem.appendChild(buildMinorElem);

        creatorElem.appendChild(versionElem);
        activityElem.appendChild(creatorElem);
    }

    // Add Author
    if (activityData.activity.author) {
        const authorElem = xmlDoc.createElement("Author");
        authorElem.setAttribute("xsi:type", "Application_t");

        const nameElem = xmlDoc.createElement("Name");
        nameElem.textContent = activityData.activity.author.name;
        authorElem.appendChild(nameElem);

        const buildElem = xmlDoc.createElement("Build");
        const versionElem = xmlDoc.createElement("Version");

        const versionMajorElem = xmlDoc.createElement("VersionMajor");
        versionMajorElem.textContent = activityData.activity.author.version.major;
        versionElem.appendChild(versionMajorElem);

        const versionMinorElem = xmlDoc.createElement("VersionMinor");
        versionMinorElem.textContent = activityData.activity.author.version.minor;
        versionElem.appendChild(versionMinorElem);

        const buildMajorElem = xmlDoc.createElement("BuildMajor");
        buildMajorElem.textContent = activityData.activity.author.version.buildMajor;
        versionElem.appendChild(buildMajorElem);

        const buildMinorElem = xmlDoc.createElement("BuildMinor");
        buildMinorElem.textContent = activityData.activity.author.version.buildMinor;
        versionElem.appendChild(buildMinorElem);

        buildElem.appendChild(versionElem);
        authorElem.appendChild(buildElem);

        const langIdElem = xmlDoc.createElement("LangID");
        langIdElem.textContent = activityData.activity.author.langId;
        authorElem.appendChild(langIdElem);

        const partNumberElem = xmlDoc.createElement("PartNumber");
        partNumberElem.textContent = activityData.activity.author.partNumber;
        authorElem.appendChild(partNumberElem);

        root.appendChild(authorElem);
    }

    root.appendChild(activitiesElem);

    // Serialize XML to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
}

// Function to create a TCX file from activity data
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