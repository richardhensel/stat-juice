function parseXml(xmlText) {
  return new DOMParser().parseFromString(xmlText, "application/xml");
}

function getFirstText(parent, tagName) {
  return parent.getElementsByTagName(tagName)[0]?.textContent ?? null;
}

function getDirectChildren(parent, tagName) {
  return Array.from(parent.children).filter((child) => child.tagName === tagName);
}

function makeTrackpointXml({
  time = "2024-01-01T00:00:00Z",
  position = [51.5, -0.1],
  altitude = 5,
  distance = 10,
  hr = 150,
  cadence = 80,
  power = 210,
  speed = 3.2,
  temperature = 20,
} = {}) {
  const positionXml = position
    ? `
        <Position>
          <LatitudeDegrees>${position[0]}</LatitudeDegrees>
          <LongitudeDegrees>${position[1]}</LongitudeDegrees>
        </Position>`
    : "";

  const altitudeXml = altitude === undefined ? "" : `<AltitudeMeters>${altitude}</AltitudeMeters>`;
  const distanceXml = distance === undefined ? "" : `<DistanceMeters>${distance}</DistanceMeters>`;
  const hrXml = hr === undefined
    ? ""
    : `<HeartRateBpm><Value>${hr}</Value></HeartRateBpm>`;
  const cadenceXml = cadence === undefined ? "" : `<Cadence>${cadence}</Cadence>`;
  const temperatureXml = temperature === undefined ? "" : `<Temperature>${temperature}</Temperature>`;
  const tpxHasValues = power !== undefined || speed !== undefined;
  const tpxXml = tpxHasValues
    ? `
        <Extensions>
          <ns3:TPX>
            ${speed === undefined ? "" : `<ns3:Speed>${speed}</ns3:Speed>`}
            ${power === undefined ? "" : `<ns3:Watts>${power}</ns3:Watts>`}
          </ns3:TPX>
        </Extensions>`
    : "";

  return `
    <Trackpoint>
      <Time>${time}</Time>
      ${positionXml}
      ${altitudeXml}
      ${distanceXml}
      ${hrXml}
      ${cadenceXml}
      ${tpxXml}
      ${temperatureXml}
    </Trackpoint>`;
}

function makeLapXml({
  startTime = "2024-01-01T00:00:00Z",
  calories = 100,
  duration = 60,
  distance = 1000,
  maxSpeed = 4.5,
  avgHeartRate = 150,
  maxHeartRate = 170,
  intensity = "Active",
  cadence = 85,
  triggerMethod = "Manual",
  avgSpeed = 3.3,
  maxBikeCadence = 95,
  steps = 120,
  avgWatts = 210,
  maxWatts = 320,
  includeExtensions = true,
  trackpoints = [],
} = {}) {
  const extensionsXml = includeExtensions
    ? `
      <Extensions>
        <ns3:LX>
          ${avgSpeed === undefined ? "" : `<ns3:AvgSpeed>${avgSpeed}</ns3:AvgSpeed>`}
          ${maxBikeCadence === undefined ? "" : `<ns3:MaxBikeCadence>${maxBikeCadence}</ns3:MaxBikeCadence>`}
          ${steps === undefined ? "" : `<ns3:Steps>${steps}</ns3:Steps>`}
          ${avgWatts === undefined ? "" : `<ns3:AvgWatts>${avgWatts}</ns3:AvgWatts>`}
          ${maxWatts === undefined ? "" : `<ns3:MaxWatts>${maxWatts}</ns3:MaxWatts>`}
        </ns3:LX>
      </Extensions>`
    : "";

  return `
    <Lap StartTime="${startTime}">
      ${calories === undefined ? "" : `<Calories>${calories}</Calories>`}
      ${duration === undefined ? "" : `<TotalTimeSeconds>${duration}</TotalTimeSeconds>`}
      ${distance === undefined ? "" : `<DistanceMeters>${distance}</DistanceMeters>`}
      ${maxSpeed === undefined ? "" : `<MaximumSpeed>${maxSpeed}</MaximumSpeed>`}
      ${avgHeartRate === undefined ? "" : `<AverageHeartRateBpm><Value>${avgHeartRate}</Value></AverageHeartRateBpm>`}
      ${maxHeartRate === undefined ? "" : `<MaximumHeartRateBpm><Value>${maxHeartRate}</Value></MaximumHeartRateBpm>`}
      ${intensity === undefined ? "" : `<Intensity>${intensity}</Intensity>`}
      ${cadence === undefined ? "" : `<Cadence>${cadence}</Cadence>`}
      ${triggerMethod === undefined ? "" : `<TriggerMethod>${triggerMethod}</TriggerMethod>`}
      ${extensionsXml}
      <Track>
        ${trackpoints.join("\n")}
      </Track>
    </Lap>`;
}

function makeActivityXml({
  sport = "Running",
  id = "2024-01-01T00:00:00Z",
  laps = [],
  creator,
  author,
} = {}) {
  const creatorXml = creator
    ? `
      <Creator>
        <Name>${creator.name}</Name>
        <UnitId>${creator.unitId}</UnitId>
        <ProductID>${creator.productId}</ProductID>
        <Version>
          <VersionMajor>${creator.version.major}</VersionMajor>
          <VersionMinor>${creator.version.minor}</VersionMinor>
          <BuildMajor>${creator.version.buildMajor}</BuildMajor>
          <BuildMinor>${creator.version.buildMinor}</BuildMinor>
        </Version>
      </Creator>`
    : "";

  const authorXml = author
    ? `
      <Author>
        <Name>${author.name}</Name>
        <LangID>${author.langId}</LangID>
        <PartNumber>${author.partNumber}</PartNumber>
        <Version>
          <VersionMajor>${author.version.major}</VersionMajor>
          <VersionMinor>${author.version.minor}</VersionMinor>
          <BuildMajor>${author.version.buildMajor}</BuildMajor>
          <BuildMinor>${author.version.buildMinor}</BuildMinor>
        </Version>
      </Author>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
    <TrainingCenterDatabase
      xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
      xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
      <Activities>
        <Activity Sport="${sport}">
          <Id>${id}</Id>
          ${laps.join("\n")}
          ${creatorXml}
        </Activity>
      </Activities>
      ${authorXml}
    </TrainingCenterDatabase>`;
}

function makeRecord({
  lapId = 1,
  timestamp = "2024-01-01T00:00:00Z",
  position = [51.5, -0.1],
  altitude = 10,
  incrementalDistance = 5,
  cumulativeDistance = 5,
  hr = 150,
  cadence = 80,
  power = 200,
  speed = 3.2,
  calorieRate = 1.5,
  temperature = 20,
  cumulativeDuration = 0,
} = {}) {
  return {
    lapId,
    timestamp,
    position,
    altitude,
    incrementalDistance,
    cumulativeDistance,
    hr,
    cadence,
    power,
    speed,
    calorieRate,
    temperature,
    cumulativeDuration,
  };
}

function makeActivityData({
  activity = {
    activityType: "Running",
    activityId: "activity-1",
    creator: { name: "Device 1" },
    author: { name: "Author 1" },
  },
  laps = [
    {
      lapId: 1,
      startTime: "2024-01-01T00:00:00Z",
      calories: 100,
      duration: 60,
      distance: 100,
      maxSpeed: 4,
      avgHeartRate: 150,
      maxHeartRate: 170,
      intensity: "Active",
      cadence: 85,
      triggerMethod: "Manual",
      avgSpeed: 3.5,
      maxBikeCadence: 95,
      steps: 120,
      avgWatts: 200,
      maxWatts: 300,
    },
  ],
  records = [
    makeRecord(),
    makeRecord({
      timestamp: "2024-01-01T00:00:05Z",
      incrementalDistance: 7,
      cumulativeDistance: 12,
      speed: 3.4,
      cumulativeDuration: 5,
    }),
  ],
} = {}) {
  return { activity, laps, records };
}

describe("scripts/tcx_utils.js", () => {
  describe("processTcxXml", () => {
    // Minimal activity metadata is enough here because this case is only about
    // the top-level Activity attributes and Id extraction, not laps or records.
    it("extracts top-level activity metadata", () => {
      const xml = parseXml(
        makeActivityXml({
          sport: "Running",
          id: "2024-02-03T04:05:06Z",
        }),
      );

      const result = processTcxXml(xml);

      expect(result.activity.activityType).to.equal("Running");
      expect(result.activity.activityId).to.equal("2024-02-03T04:05:06Z");
    });

    // Two laps with distinct values let us verify both behaviors at once:
    // lap IDs should be assigned sequentially by order, and each parsed lap
    // field should come from the matching source lap rather than bleeding across.
    it("assigns sequential lap IDs and captures lap-level fields", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              startTime: "2024-01-01T00:00:00Z",
              calories: 100,
              duration: 60,
              distance: 500,
              maxSpeed: 4.5,
              avgHeartRate: 150,
              maxHeartRate: 170,
              intensity: "Active",
              cadence: 85,
              triggerMethod: "Manual",
              avgSpeed: 3.1,
              maxBikeCadence: 92,
              steps: 120,
              avgWatts: 210,
              maxWatts: 320,
            }),
            makeLapXml({
              startTime: "2024-01-01T00:10:00Z",
              calories: 110,
              duration: 70,
              distance: 650,
              maxSpeed: 4.8,
              avgHeartRate: 151,
              maxHeartRate: 171,
              intensity: "Resting",
              cadence: 86,
              triggerMethod: "Distance",
              avgSpeed: 3.2,
              maxBikeCadence: 93,
              steps: 121,
              avgWatts: 211,
              maxWatts: 321,
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);

      expect(result.laps).to.have.length(2);
      expect(result.laps[0]).to.include({
        lapId: 1,
        startTime: "2024-01-01T00:00:00Z",
        calories: 100,
        duration: 60,
        distance: 500,
        maxSpeed: 4.5,
        avgHeartRate: 150,
        maxHeartRate: 170,
        intensity: "Active",
        cadence: 85,
        triggerMethod: "Manual",
        avgSpeed: 3.1,
        maxBikeCadence: 92,
        steps: 120,
        avgWatts: 210,
        maxWatts: 320,
      });
      expect(result.laps[1]).to.include({
        lapId: 2,
        startTime: "2024-01-01T00:10:00Z",
        calories: 110,
        duration: 70,
        distance: 650,
        maxSpeed: 4.8,
        avgHeartRate: 151,
        maxHeartRate: 171,
        intensity: "Resting",
        cadence: 86,
        triggerMethod: "Distance",
        avgSpeed: 3.2,
        maxBikeCadence: 93,
        steps: 121,
        avgWatts: 211,
        maxWatts: 321,
      });
    });

    // Two fully-populated trackpoints let us assert that record parsing keeps
    // all channel values intact and that every emitted record inherits the lap's
    // generated lapId.
    it("parses trackpoints into record objects and tags each record with its lap ID", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              trackpoints: [
                makeTrackpointXml({
                  time: "2024-01-01T00:00:00Z",
                  position: [10, 20],
                  altitude: 100,
                  distance: 5,
                  hr: 140,
                  cadence: 81,
                  power: 201,
                  speed: 3.1,
                  temperature: 18,
                }),
                makeTrackpointXml({
                  time: "2024-01-01T00:00:10Z",
                  position: [11, 21],
                  altitude: 101,
                  distance: 15,
                  hr: 141,
                  cadence: 82,
                  power: 202,
                  speed: 3.2,
                  temperature: 19,
                }),
              ],
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);

      expect(result.records).to.have.length(2);
      expect(result.records[0]).to.include({
        lapId: 1,
        timestamp: "2024-01-01T00:00:00Z",
        altitude: 100,
        cumulativeDistance: 5,
        hr: 140,
        cadence: 81,
        power: 201,
        speed: 3.1,
        temperature: 18,
      });
      expect(result.records[0].position).to.deep.equal([10, 20]);
      expect(result.records[1]).to.include({
        lapId: 1,
        timestamp: "2024-01-01T00:00:10Z",
        altitude: 101,
        cumulativeDistance: 15,
        hr: 141,
        cadence: 82,
        power: 202,
        speed: 3.2,
        temperature: 19,
      });
      expect(result.records[1].position).to.deep.equal([11, 21]);
    });

    // Omitting Position entirely is the way the source XML represents missing
    // coordinates, so asserting [null, null] checks the intended fallback shape.
    it("parses missing position as [null, null]", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              trackpoints: [makeTrackpointXml({ position: null })],
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);

      expect(result.records[0].position).to.deep.equal([null, null]);
    });

    // The second point intentionally omits DistanceMeters so the parser must
    // reuse the prior cumulative distance; if that happens, the incremental
    // distance for that point should be zero.
    it("carries forward cumulative distance when a trackpoint omits DistanceMeters", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              trackpoints: [
                makeTrackpointXml({ distance: 25 }),
                makeTrackpointXml({
                  time: "2024-01-01T00:00:10Z",
                  distance: undefined,
                }),
              ],
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);

      expect(result.records[1].cumulativeDistance).to.equal(25);
      expect(result.records[1].incrementalDistance).to.equal(0);
    });

    // Monotonically increasing distances make the expected increments obvious,
    // so differences between cumulative readings directly prove the calculation.
    it("computes incrementalDistance from successive reported distances", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              trackpoints: [
                makeTrackpointXml({ distance: 10 }),
                makeTrackpointXml({ time: "2024-01-01T00:00:10Z", distance: 25 }),
                makeTrackpointXml({ time: "2024-01-01T00:00:20Z", distance: 40 }),
              ],
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);

      expect(result.records.map((record) => record.incrementalDistance)).to.deep.equal([10, 15, 15]);
    });

    // Every record in a lap should inherit the same calorieRate, so one lap
    // with two trackpoints is enough to prove both the division and propagation.
    it("computes calorieRate from lap calories and duration and applies it to each record in that lap", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              calories: 120,
              duration: 60,
              trackpoints: [
                makeTrackpointXml(),
                makeTrackpointXml({ time: "2024-01-01T00:00:10Z" }),
              ],
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);

      expect(result.records.map((record) => record.calorieRate)).to.deep.equal([2, 2]);
    });

    // Supplying all creator/author subfields lets us check the nested object
    // mapping exactly, including the version blocks.
    it("extracts creator and author metadata when present", () => {
      const xml = parseXml(
        makeActivityXml({
          creator: {
            name: "Garmin 1",
            unitId: "123",
            productId: "456",
            version: {
              major: "10",
              minor: "11",
              buildMajor: "12",
              buildMinor: "13",
            },
          },
          author: {
            name: "Author App",
            langId: "en",
            partNumber: "PN-1",
            version: {
              major: "1",
              minor: "2",
              buildMajor: "3",
              buildMinor: "4",
            },
          },
        }),
      );

      const result = processTcxXml(xml);

      expect(result.activity.creator).to.deep.equal({
        name: "Garmin 1",
        unitId: "123",
        productId: "456",
        version: {
          major: "10",
          minor: "11",
          buildMajor: "12",
          buildMinor: "13",
        },
      });
      expect(result.activity.author).to.deep.equal({
        name: "Author App",
        langId: "en",
        partNumber: "PN-1",
        version: {
          major: "1",
          minor: "2",
          buildMajor: "3",
          buildMinor: "4",
        },
      });
    });

    // An activity with no Lap elements should still return valid top-level
    // activity metadata while producing empty collections for parsed content.
    it("returns empty collections when there are no laps", () => {
      const xml = parseXml(
        makeActivityXml({
          sport: "Cycling",
          id: "activity-empty",
          laps: [],
        }),
      );

      const result = processTcxXml(xml);

      expect(result.records).to.deep.equal([]);
      expect(result.laps).to.deep.equal([]);
      expect(result.activity.activityType).to.equal("Cycling");
      expect(result.activity.activityId).to.equal("activity-empty");
    });

    // This is a desired-behavior test: removing the lap extensions isolates the
    // parser's fallback path and asserts that absent optional numeric fields are
    // represented as null rather than synthetic numeric values.
    it("handles optional lap extension fields being absent", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              includeExtensions: false,
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);

      expect(result.laps).to.have.length(1);
      expect(result.laps[0].avgSpeed).to.equal(null);
      expect(result.laps[0].maxBikeCadence).to.equal(null);
      expect(result.laps[0].steps).to.equal(null);
      expect(result.laps[0].avgWatts).to.equal(null);
      expect(result.laps[0].maxWatts).to.equal(null);
    });

    // This case removes optional numeric trackpoint channels one by one so any
    // NaN result can be traced to missing-source handling rather than bad input.
    it("parses missing optional numeric trackpoint fields as null, not NaN", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              trackpoints: [
                makeTrackpointXml({
                  altitude: undefined,
                  hr: undefined,
                  cadence: undefined,
                  temperature: undefined,
                  power: undefined,
                  speed: undefined,
                }),
              ],
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);
      const record = result.records[0];

      expect(record.altitude).to.equal(null);
      expect(record.hr).to.equal(null);
      expect(record.cadence).to.equal(null);
      expect(record.temperature).to.equal(null);
      expect(record.power).to.equal(null);
      expect(record.speed).to.equal(null);
    });

    // Similar to the previous case, but at lap scope. The intent is to define
    // the desired API contract for absent optional lap numeric values.
    it("parses missing optional lap numeric fields as null, not NaN", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              calories: undefined,
              maxSpeed: undefined,
              cadence: undefined,
              avgHeartRate: undefined,
              maxHeartRate: undefined,
              avgSpeed: undefined,
              maxBikeCadence: undefined,
              steps: undefined,
              avgWatts: undefined,
              maxWatts: undefined,
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);
      const lap = result.laps[0];

      expect(lap.calories).to.equal(null);
      expect(lap.maxSpeed).to.equal(null);
      expect(lap.cadence).to.equal(null);
      expect(lap.avgHeartRate).to.equal(null);
      expect(lap.maxHeartRate).to.equal(null);
      expect(lap.avgSpeed).to.equal(null);
      expect(lap.maxBikeCadence).to.equal(null);
      expect(lap.steps).to.equal(null);
      expect(lap.avgWatts).to.equal(null);
      expect(lap.maxWatts).to.equal(null);
    });

    // The first record has no predecessor, so cumulative duration should start
    // at zero regardless of timestamp content.
    it("sets cumulativeDuration to 0 for the first record", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              trackpoints: [makeTrackpointXml({ time: "2024-01-01T00:00:00Z" })],
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);

      expect(result.records[0].cumulativeDuration).to.equal(0);
    });

    // The chosen timestamps create deltas of +10s and then +15s, so the running
    // total should be [0, 10, 25] if accumulation uses adjacent timestamps.
    it("accumulates cumulativeDuration from timestamp deltas across records", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              trackpoints: [
                makeTrackpointXml({ time: "2024-01-01T00:00:00Z" }),
                makeTrackpointXml({ time: "2024-01-01T00:00:10Z" }),
                makeTrackpointXml({ time: "2024-01-01T00:00:25Z" }),
              ],
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);

      expect(result.records.map((record) => record.cumulativeDuration)).to.deep.equal([0, 10, 25]);
    });

    // This specifies the intended cross-lap behavior: duration should reflect
    // elapsed activity time, not restart at each lap boundary.
    it("keeps accumulating cumulativeDuration across lap boundaries rather than resetting per lap", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              startTime: "2024-01-01T00:00:00Z",
              trackpoints: [
                makeTrackpointXml({ time: "2024-01-01T00:00:00Z" }),
                makeTrackpointXml({ time: "2024-01-01T00:01:00Z" }),
              ],
            }),
            makeLapXml({
              startTime: "2024-01-01T00:01:05Z",
              trackpoints: [
                makeTrackpointXml({ time: "2024-01-01T00:01:05Z" }),
                makeTrackpointXml({ time: "2024-01-01T00:01:15Z" }),
              ],
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);

      expect(result.records[2].cumulativeDuration).to.equal(65);
      expect(result.records[3].cumulativeDuration).to.equal(75);
    });

    // A single-point lap cannot produce a time delta, so this guards against
    // accidental non-zero duration initialization.
    it("handles a single-trackpoint lap without inventing duration", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              trackpoints: [makeTrackpointXml({ time: "2024-01-01T00:00:00Z" })],
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);

      expect(result.records[0].cumulativeDuration).to.equal(0);
    });

    // This is a regression-style test for the current suspicious implementation:
    // multiple timestamped records should still yield finite numeric durations.
    it("uses parsed timestamps directly for duration calculation, not unrelated variables", () => {
      const xml = parseXml(
        makeActivityXml({
          laps: [
            makeLapXml({
              trackpoints: [
                makeTrackpointXml({ time: "2024-01-01T00:00:00Z" }),
                makeTrackpointXml({ time: "2024-01-01T00:00:10Z" }),
                makeTrackpointXml({ time: "2024-01-01T00:00:30Z" }),
              ],
            }),
          ],
        }),
      );

      const result = processTcxXml(xml);

      result.records.forEach((record) => {
        expect(record.cumulativeDuration).to.be.a("number");
        expect(Number.isFinite(record.cumulativeDuration)).to.equal(true);
      });
    });
  });

  describe("calculateSummaryStats", () => {
    // These malformed inputs all violate the same precondition, so grouping them
    // in one test documents the accepted input shape for the function.
    it("throws on invalid input", () => {
      expect(() => calculateSummaryStats(null)).to.throw("Invalid activityData: missing or invalid records array");
      expect(() => calculateSummaryStats({})).to.throw("Invalid activityData: missing or invalid records array");
      expect(() => calculateSummaryStats({ records: "not-an-array" })).to.throw("Invalid activityData: missing or invalid records array");
    });

    // Empty records trigger the function's explicit zero-summary branch, so this
    // test locks down that full return object.
    it("returns the zeroed summary for an empty records array", () => {
      const result = calculateSummaryStats({ records: [], laps: [] });

      expect(result).to.deep.equal({
        totalTime: 0,
        totalDistance: 0,
        averageSpeed: 0,
        averagePower: null,
        averageHR: null,
        totalElevationGained: 0,
        totalCalories: 0,
      });
    });

    // Total time is defined as the sum of lap durations, so two laps with known
    // values directly prove the aggregation source.
    it("sums lap durations into total time", () => {
      const result = calculateSummaryStats({
        laps: [{ duration: 60 }, { duration: 30 }],
        records: [{ incrementalDistance: 10 }],
      });

      expect(result.totalTime).to.equal(90);
    });

    // Using decimal and zero values ensures we test both summation accuracy and
    // the treatment of zero-distance records.
    it("sums incrementalDistance across records", () => {
      const result = calculateSummaryStats({
        laps: [{ duration: 100 }],
        records: [
          { incrementalDistance: 10 },
          { incrementalDistance: 12.5 },
          { incrementalDistance: 0 },
        ],
      });

      expect(result.totalDistance).to.equal(22.5);
    });

    // A 4/3 ratio gives a non-terminating decimal, which makes the rounding
    // behavior visible instead of trivially exact.
    it("computes average speed as totalDistance divided by totalTime and rounds to 2 decimals", () => {
      const result = calculateSummaryStats({
        laps: [{ duration: 3 }],
        records: [
          { incrementalDistance: 1 },
          { incrementalDistance: 1 },
          { incrementalDistance: 1 },
          { incrementalDistance: 1 },
        ],
      });

      expect(result.averageSpeed).to.equal(1.33);
    });

    // Null and zero values are included deliberately to confirm that only
    // positive, non-null power samples participate in the average.
    it("averages only positive, non-null power samples and rounds to nearest integer", () => {
      const result = calculateSummaryStats({
        laps: [{ duration: 60 }],
        records: [
          { incrementalDistance: 1, power: 200 },
          { incrementalDistance: 1, power: 220 },
          { incrementalDistance: 1, power: null },
          { incrementalDistance: 1, power: 0 },
        ],
      });

      expect(result.averagePower).to.equal(210);
    });

    // Same pattern as power: the mixed sample set distinguishes filtering logic
    // from the arithmetic mean itself.
    it("averages only positive, non-null HR samples and rounds to nearest integer", () => {
      const result = calculateSummaryStats({
        laps: [{ duration: 60 }],
        records: [
          { incrementalDistance: 1, hr: 150 },
          { incrementalDistance: 1, hr: 155 },
          { incrementalDistance: 1, hr: null },
          { incrementalDistance: 1, hr: 0 },
        ],
      });

      expect(result.averageHR).to.equal(153);
    });

    // The altitude series includes one drop between two climbs, so we can prove
    // that only positive gains contribute to the total.
    it("totals only positive altitude gains, ignoring drops", () => {
      const result = calculateSummaryStats({
        laps: [{ duration: 60 }],
        records: [
          { incrementalDistance: 1, altitude: 100 },
          { incrementalDistance: 1, altitude: 105 },
          { incrementalDistance: 1, altitude: 103 },
          { incrementalDistance: 1, altitude: 110 },
        ],
      });

      expect(result.totalElevationGained).to.equal(12);
    });

    // Calories are sourced from laps, not records, so two lap calorie values are
    // enough to verify the aggregation rule.
    it("sums lap calories", () => {
      const result = calculateSummaryStats({
        laps: [{ duration: 60, calories: 100 }, { duration: 30, calories: 50 }],
        records: [{ incrementalDistance: 10 }],
      });

      expect(result.totalCalories).to.equal(150);
    });

    // Omitting laps entirely exercises the default empty-laps path and checks
    // that the function still returns a valid summary object.
    it("handles missing laps by treating them as empty", () => {
      const result = calculateSummaryStats({
        records: [{ incrementalDistance: 10, altitude: 100 }],
      });

      expect(result.totalTime).to.equal(0);
      expect(result.totalCalories).to.equal(0);
    });
  });

  describe("appendActivitiesSimple", () => {
    // These inputs all violate the requirement that the function receives a
    // non-empty array of activities.
    it("throws on invalid input", () => {
      expect(() => appendActivitiesSimple([])).to.throw("Input must be a non-empty array of activityData.");
      expect(() => appendActivitiesSimple(null)).to.throw("Input must be a non-empty array of activityData.");
      expect(() => appendActivitiesSimple("not-an-array")).to.throw("Input must be a non-empty array of activityData.");
    });

    // Giving the second activity different metadata makes it clear whether the
    // function preserves the first activity's top-level metadata as designed.
    it("copies metadata from the first activity only", () => {
      const first = makeActivityData({
        activity: {
          activityType: "Running",
          activityId: "first-id",
          creator: { name: "Creator A" },
          author: { name: "Author A" },
        },
      });
      const second = makeActivityData({
        activity: {
          activityType: "Cycling",
          activityId: "second-id",
          creator: { name: "Creator B" },
          author: { name: "Author B" },
        },
      });

      const result = appendActivitiesSimple([first, second]);

      expect(result.activity).to.deep.equal(first.activity);
    });

    // One lap in each source activity makes the append order and count obvious.
    it("appends laps from all activities", () => {
      const first = makeActivityData({
        laps: [{ lapId: 1, startTime: "a" }],
        records: [],
      });
      const second = makeActivityData({
        laps: [{ lapId: 1, startTime: "b" }],
        records: [],
      });

      const result = appendActivitiesSimple([first, second]);

      expect(result.laps).to.have.length(2);
      expect(result.laps[0].startTime).to.equal("a");
      expect(result.laps[1].startTime).to.equal("b");
    });

    // Distinct timestamps across both inputs make it easy to verify that record
    // order is preserved exactly through concatenation.
    it("appends records from all activities in order", () => {
      const first = makeActivityData({
        records: [
          makeRecord({ timestamp: "2024-01-01T00:00:00Z" }),
          makeRecord({ timestamp: "2024-01-01T00:00:10Z" }),
        ],
      });
      const second = makeActivityData({
        records: [
          makeRecord({ timestamp: "2024-01-01T00:01:00Z" }),
          makeRecord({ timestamp: "2024-01-01T00:01:10Z" }),
        ],
      });

      const result = appendActivitiesSimple([first, second]);

      expect(result.records.map((record) => record.timestamp)).to.deep.equal([
        "2024-01-01T00:00:00Z",
        "2024-01-01T00:00:10Z",
        "2024-01-01T00:01:00Z",
        "2024-01-01T00:01:10Z",
      ]);
    });

    // The second activity starts its lap numbering at 1 again, so if the result
    // is [1, 2, 3] we know the offset logic was applied.
    it("offsets lap IDs of later activities to keep them unique", () => {
      const first = makeActivityData({
        laps: [{ lapId: 1 }, { lapId: 2 }],
        records: [],
      });
      const second = makeActivityData({
        laps: [{ lapId: 1 }],
        records: [],
      });

      const result = appendActivitiesSimple([first, second]);

      expect(result.laps.map((lap) => lap.lapId)).to.deep.equal([1, 2, 3]);
    });

    // This mirrors the lap-offset case at record level to prove records stay
    // aligned with their adjusted appended laps.
    it("offsets each record lapId consistently with its adjusted lap", () => {
      const first = makeActivityData({
        laps: [{ lapId: 1 }, { lapId: 2 }],
        records: [
          makeRecord({ lapId: 1, timestamp: "2024-01-01T00:00:00Z" }),
          makeRecord({ lapId: 2, timestamp: "2024-01-01T00:01:00Z" }),
        ],
      });
      const second = makeActivityData({
        laps: [{ lapId: 1 }],
        records: [makeRecord({ lapId: 1, timestamp: "2024-01-01T00:02:00Z" })],
      });

      const result = appendActivitiesSimple([first, second]);

      expect(result.records.map((record) => record.lapId)).to.deep.equal([1, 2, 3]);
    });

    // Distinct non-lapId values on each source object let us confirm that the
    // function only rewrites lapId and leaves other data untouched.
    it("preserves record and lap fields other than lapId", () => {
      const first = makeActivityData({
        laps: [{ lapId: 1, calories: 123, duration: 45 }],
        records: [
          makeRecord({
            lapId: 1,
            timestamp: "2024-01-01T00:00:00Z",
            incrementalDistance: 12,
            hr: 155,
          }),
        ],
      });
      const second = makeActivityData({
        laps: [{ lapId: 1, calories: 456, duration: 78 }],
        records: [
          makeRecord({
            lapId: 1,
            timestamp: "2024-01-01T00:10:00Z",
            incrementalDistance: 34,
            hr: 165,
          }),
        ],
      });

      const result = appendActivitiesSimple([first, second]);

      expect(result.laps[0]).to.include({ calories: 123, duration: 45 });
      expect(result.laps[1]).to.include({ calories: 456, duration: 78 });
      expect(result.records[0]).to.include({
        timestamp: "2024-01-01T00:00:00Z",
        incrementalDistance: 12,
        hr: 155,
      });
      expect(result.records[1]).to.include({
        timestamp: "2024-01-01T00:10:00Z",
        incrementalDistance: 34,
        hr: 165,
      });
    });
  });

  describe("createTcxFile", () => {
    // Parsing the output back as XML is the quickest way to verify that the
    // serializer produced a structurally valid TCX document rather than a string
    // that merely "looks right".
    it("returns parseable TCX XML with the expected root structure", () => {
      const xmlText = createTcxFile(makeActivityData());
      const xml = parseXml(xmlText);

      expect(xml.documentElement.tagName).to.equal("TrainingCenterDatabase");
      expect(xml.getElementsByTagName("Activities")).to.have.length(1);
      expect(xml.getElementsByTagName("Activity")).to.have.length(1);
    });

    // The sport is written as an Activity attribute, so this focuses only on the
    // top-level metadata mapping from activity.activityType.
    it("writes the activity sport from activity.activityType", () => {
      const xml = parseXml(
        createTcxFile(
          makeActivityData({
            activity: {
              activityType: "Running",
              activityId: "activity-1",
              creator: { name: "Creator" },
              author: { name: "Author" },
            },
          }),
        ),
      );

      expect(xml.getElementsByTagName("Activity")[0].getAttribute("Sport")).to.equal("Running");
    });

    // The implementation intentionally uses the second record timestamp as the
    // Activity Id because the first record of the first lap is later dropped.
    // Using two distinct timestamps makes that rule explicit.
    it("uses the second record timestamp as the output activity ID", () => {
      const xml = parseXml(
        createTcxFile(
          makeActivityData({
            records: [
              makeRecord({ timestamp: "2024-01-01T00:00:00Z" }),
              makeRecord({ timestamp: "2024-01-01T00:00:05Z" }),
            ],
          }),
        ),
      );

      expect(getFirstText(xml, "Id")).to.equal("2024-01-01T00:00:05Z");
    });

    // This case is deliberately shaped around the serializer quirk: the first
    // record of the first lap is treated as disposable, while subsequent laps
    // should remain untouched.
    it("omits the first record from the first lap only", () => {
      const xml = parseXml(
        createTcxFile(
          makeActivityData({
            laps: [
              { lapId: 1, startTime: "2024-01-01T00:00:00Z", calories: 100, duration: 60 },
              { lapId: 2, startTime: "2024-01-01T00:10:00Z", calories: 100, duration: 60 },
            ],
            records: [
              makeRecord({ lapId: 1, timestamp: "2024-01-01T00:00:00Z" }),
              makeRecord({ lapId: 1, timestamp: "2024-01-01T00:00:05Z" }),
              makeRecord({ lapId: 1, timestamp: "2024-01-01T00:00:10Z" }),
              makeRecord({ lapId: 2, timestamp: "2024-01-01T00:10:00Z" }),
              makeRecord({ lapId: 2, timestamp: "2024-01-01T00:10:05Z" }),
            ],
          }),
        ),
      );

      const lapElements = xml.getElementsByTagName("Lap");
      const firstLapTrackpoints = lapElements[0].getElementsByTagName("Trackpoint");
      const secondLapTrackpoints = lapElements[1].getElementsByTagName("Trackpoint");

      expect(firstLapTrackpoints).to.have.length(2);
      expect(secondLapTrackpoints).to.have.length(2);
    });

    // By mixing two lapIds in the source records and then checking per-lap
    // output timestamps, we verify grouping after the first-lap record drop.
    it("groups records into laps using lapId", () => {
      const xml = parseXml(
        createTcxFile(
          makeActivityData({
            laps: [
              { lapId: 1, startTime: "2024-01-01T00:00:00Z", calories: 100, duration: 60 },
              { lapId: 2, startTime: "2024-01-01T00:10:00Z", calories: 110, duration: 70 },
            ],
            records: [
              makeRecord({ lapId: 1, timestamp: "2024-01-01T00:00:00Z" }),
              makeRecord({ lapId: 1, timestamp: "2024-01-01T00:00:05Z" }),
              makeRecord({ lapId: 2, timestamp: "2024-01-01T00:10:00Z" }),
              makeRecord({ lapId: 2, timestamp: "2024-01-01T00:10:05Z" }),
            ],
          }),
        ),
      );

      const lapElements = xml.getElementsByTagName("Lap");
      const firstLapTimes = Array.from(lapElements[0].getElementsByTagName("Time")).map((node) => node.textContent);
      const secondLapTimes = Array.from(lapElements[1].getElementsByTagName("Time")).map((node) => node.textContent);

      expect(firstLapTimes).to.deep.equal(["2024-01-01T00:00:05Z"]);
      expect(secondLapTimes).to.deep.equal(["2024-01-01T00:10:00Z", "2024-01-01T00:10:05Z"]);
    });

    // Because the serializer removes the first record of the first lap, the
    // null-position assertions need to target the remaining emitted records.
    // This setup covers all three meaningful branches for emitted records:
    // both coords null, only lat present, only lon present, and both present.
    it("writes position nodes only when both coordinates are non-null", () => {
      const xml = parseXml(
        createTcxFile(
          makeActivityData({
            records: [
              makeRecord({ timestamp: "2024-01-01T00:00:00Z", position: [51.5, -0.1] }),
              makeRecord({ timestamp: "2024-01-01T00:00:05Z", position: [null, null] }),
              makeRecord({ timestamp: "2024-01-01T00:00:10Z", position: [51.6, null] }),
              makeRecord({ timestamp: "2024-01-01T00:00:15Z", position: [null, -0.2] }),
              makeRecord({ timestamp: "2024-01-01T00:00:20Z", position: [51.7, -0.3] }),
            ],
          }),
        ),
      );

      const trackpoints = xml.getElementsByTagName("Trackpoint");

      expect(trackpoints[0].getElementsByTagName("Position")).to.have.length(0);
      expect(trackpoints[1].getElementsByTagName("Position")).to.have.length(0);
      expect(trackpoints[2].getElementsByTagName("Position")).to.have.length(0);
      expect(trackpoints[3].getElementsByTagName("Position")).to.have.length(1);
    });

    // After the first record is dropped, the emitted records have increments of
    // 7 and then null, so the serialized cumulative distances should stay at 7.
    it("writes cumulative trackpoint distance by summing incrementalDistance", () => {
      const xml = parseXml(
        createTcxFile(
          makeActivityData({
            records: [
              makeRecord({ timestamp: "2024-01-01T00:00:00Z", incrementalDistance: 5 }),
              makeRecord({ timestamp: "2024-01-01T00:00:05Z", incrementalDistance: 7 }),
              makeRecord({ timestamp: "2024-01-01T00:00:10Z", incrementalDistance: null }),
            ],
          }),
        ),
      );

      const distances = Array.from(xml.getElementsByTagName("Trackpoint")).map((trackpoint) => {
        return Number(getFirstText(trackpoint, "DistanceMeters"));
      });

      expect(distances).to.deep.equal([7, 7]);
    });

    // The lap total should reflect only emitted first-lap records, not the
    // dropped dummy record, so 7 + 11 is the expected serialized lap distance.
    it("writes lap DistanceMeters as the sum of that lap incremental distances after first-lap trimming", () => {
      const xml = parseXml(
        createTcxFile(
          makeActivityData({
            records: [
              makeRecord({ timestamp: "2024-01-01T00:00:00Z", incrementalDistance: 5 }),
              makeRecord({ timestamp: "2024-01-01T00:00:05Z", incrementalDistance: 7 }),
              makeRecord({ timestamp: "2024-01-01T00:00:10Z", incrementalDistance: 11 }),
            ],
          }),
        ),
      );

      const lapDistance = Number(getFirstText(xml.getElementsByTagName("Lap")[0], "DistanceMeters"));

      expect(lapDistance).to.equal(18);
    });

    // The dropped first record has speed 2.5, so using 3.2 on the next emitted
    // record proves the lap max is derived from serialized records, not all input.
    it("writes lap MaximumSpeed as the max non-null record speed in that lap", () => {
      const xml = parseXml(
        createTcxFile(
          makeActivityData({
            records: [
              makeRecord({ timestamp: "2024-01-01T00:00:00Z", speed: 2.5 }),
              makeRecord({ timestamp: "2024-01-01T00:00:05Z", speed: 3.2 }),
              makeRecord({ timestamp: "2024-01-01T00:00:10Z", speed: null }),
            ],
          }),
        ),
      );

      expect(Number(getFirstText(xml.getElementsByTagName("Lap")[0], "MaximumSpeed"))).to.equal(3.2);
    });

    // Calories are lap-level metadata, so this test isolates that mapping from
    // any trackpoint serialization concerns.
    it("writes lap calories from lap.calories", () => {
      const xml = parseXml(
        createTcxFile(
          makeActivityData({
            laps: [
              {
                lapId: 1,
                startTime: "2024-01-01T00:00:00Z",
                calories: 123,
                duration: 60,
              },
            ],
          }),
        ),
      );

      expect(Number(getFirstText(xml.getElementsByTagName("Lap")[0], "Calories"))).to.equal(123);
    });

    // Because the first record is always dropped, the emitted trackpoint here is
    // the one with null channel values. That makes absence checks unambiguous.
    it("includes HR, cadence, speed, and watts only when source values are present", () => {
      const xml = parseXml(
        createTcxFile(
          makeActivityData({
            records: [
              makeRecord({
                timestamp: "2024-01-01T00:00:00Z",
                hr: 140,
                cadence: 80,
                speed: 3.1,
                power: 200,
              }),
              makeRecord({
                timestamp: "2024-01-01T00:00:05Z",
                hr: null,
                cadence: null,
                speed: null,
                power: null,
              }),
            ],
          }),
        ),
      );

      const trackpoint = xml.getElementsByTagName("Trackpoint")[0];

      expect(trackpoint.getElementsByTagName("HeartRateBpm")).to.have.length(0);
      expect(trackpoint.getElementsByTagName("Cadence")).to.have.length(0);
      expect(trackpoint.getElementsByTagName("ns3:Speed")).to.have.length(0);
      expect(trackpoint.getElementsByTagName("ns3:Watts")).to.have.length(0);
    });

    // The emitted timestamps should be the original sequence minus the first
    // dropped record of the first lap.
    it("preserves timestamps for emitted trackpoints", () => {
      const xml = parseXml(
        createTcxFile(
          makeActivityData({
            records: [
              makeRecord({ timestamp: "2024-01-01T00:00:00Z" }),
              makeRecord({ timestamp: "2024-01-01T00:00:05Z" }),
              makeRecord({ timestamp: "2024-01-01T00:00:10Z" }),
            ],
          }),
        ),
      );

      const times = Array.from(xml.getElementsByTagName("Trackpoint")).map((trackpoint) => {
        return getFirstText(trackpoint, "Time");
      });

      expect(times).to.deep.equal(["2024-01-01T00:00:05Z", "2024-01-01T00:00:10Z"]);
    });
  });
});
