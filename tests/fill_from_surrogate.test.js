function makeSurrogateRecord({
  timestamp,
  position,
  incrementalDistance = 5,
  hr = 150,
  cadence = 80,
  power = 220,
  speed = 3.1,
  temperature = 20,
} = {}) {
  return {
    lapId: 1,
    timestamp,
    position,
    altitude: 10,
    incrementalDistance,
    cumulativeDistance: incrementalDistance,
    hr,
    cadence,
    power,
    speed,
    calorieRate: 1,
    temperature,
    cumulativeDuration: 0,
  };
}

function makeSurrogateActivity(records) {
  return {
    activity: {
      activityType: "Running",
      activityId: records[0]?.timestamp || "activity",
      creator: { name: "Device" },
      author: { name: "Author" },
    },
    laps: [
      {
        lapId: 1,
        startTime: records[0]?.timestamp || "2024-01-01T00:00:00Z",
        calories: 100,
        duration: records.length > 1 ? records.length - 1 : 0,
        distance: records.reduce((sum, record) => sum + (record.incrementalDistance || 0), 0),
        maxSpeed: 4,
        avgHeartRate: 150,
        maxHeartRate: 170,
        intensity: "Active",
        cadence: 85,
        triggerMethod: "Manual",
        avgSpeed: 3,
        maxBikeCadence: 95,
        steps: 100,
        avgWatts: 200,
        maxWatts: 300,
      },
    ],
    records,
  };
}

describe("fill from surrogate helpers", () => {
  it("creates a new block when latest known base and donor positions move inside radius", () => {
    const baseInput = FillFromSurrogateBlocks.createSourceInput(
      "base",
      "base.tcx",
      makeSurrogateActivity([
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:00Z",
          position: [0, 0],
        }),
      ]),
      0,
    );

    const donorInput = FillFromSurrogateBlocks.createSourceInput(
      "donor",
      "donor.tcx",
      makeSurrogateActivity([
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:06Z",
          position: [0, 0.02],
        }),
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:12Z",
          position: [0, 0.0002],
        }),
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:18Z",
          position: [0, 0.00019],
        }),
      ]),
      0,
    );

    const blocks = FillFromSurrogateBlocks.buildBlocks(
      [baseInput],
      [donorInput],
      { donorSwitchRadiusMetres: 100 },
    );

    const matchingBlock = blocks.find((block) => block.startTime === "2024-01-01T00:00:12.000Z");
    expect(matchingBlock).to.exist;
  });

  it("keeps donor continuation without repeating the donor entry proximity check", () => {
    const baseInput = FillFromSurrogateBlocks.createSourceInput(
      "base",
      "base.tcx",
      makeSurrogateActivity([
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:00Z",
          position: [0, 0],
        }),
      ]),
      0,
    );

    const donorInput = FillFromSurrogateBlocks.createSourceInput(
      "donor",
      "donor.tcx",
      makeSurrogateActivity([
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:05Z",
          position: [0, 0.0002],
        }),
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:40Z",
          position: [0, 0.05],
        }),
      ]),
      0,
    );

    const blocks = FillFromSurrogateBlocks.buildBlocks(
      [baseInput],
      [donorInput],
      { donorSwitchRadiusMetres: 100, minCoverageThresholdSeconds: 5, maxCoverageThresholdSeconds: 5 },
    );
    FillFromSurrogateBlocks.applyDefaultBlockSelections(
      blocks,
      [baseInput],
      { donorSwitchRadiusMetres: 100, donorSwitchProximityCheck: true },
    );

    const donorSelections = blocks.filter((block) => block.defaultSelection === "donor");
    expect(donorSelections.length).to.be.greaterThan(0);
    expect(donorSelections[donorSelections.length - 1].defaultReason).to.contain("continue");
  });

  it("strips personalised donor metrics from output records", () => {
    const donorInput = FillFromSurrogateBlocks.createSourceInput(
      "donor",
      "donor.tcx",
      makeSurrogateActivity([
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:05Z",
          position: [0, 0],
          hr: 160,
          cadence: 95,
          power: 310,
          temperature: 18,
        }),
      ]),
      0,
    );

    const blocks = FillFromSurrogateBlocks.buildBlocks([], [donorInput], {});
    FillFromSurrogateBlocks.applyDefaultBlockSelections(blocks, [], {});

    const output = FillFromSurrogateOutput.buildOutputActivity([], [donorInput], blocks);
    expect(output.records[0].hr).to.equal(null);
    expect(output.records[0].cadence).to.equal(null);
    expect(output.records[0].power).to.equal(null);
    expect(output.records[0].temperature).to.equal(18);
  });

  it("supports choosing none even when a source is available", () => {
    const baseInput = FillFromSurrogateBlocks.createSourceInput(
      "base",
      "base.tcx",
      makeSurrogateActivity([
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:00Z",
          position: [0, 0],
        }),
      ]),
      0,
    );

    const blocks = FillFromSurrogateBlocks.buildBlocks([baseInput], [], {});
    FillFromSurrogateBlocks.applyDefaultBlockSelections(blocks, [baseInput], {});
    blocks[0].currentSelection = "none";

    const output = FillFromSurrogateOutput.buildOutputActivity([baseInput], [], blocks);
    expect(output).to.equal(null);
  });

  it("stores elapsed block timing and per-source block distances", () => {
    const baseInput = FillFromSurrogateBlocks.createSourceInput(
      "base",
      "base.tcx",
      makeSurrogateActivity([
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:00Z",
          position: [0, 0],
          incrementalDistance: 0,
        }),
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:10Z",
          position: [0, 0.001],
          incrementalDistance: 100,
        }),
      ]),
      0,
    );

    const blocks = FillFromSurrogateBlocks.buildBlocks([baseInput], [], {});
    expect(blocks[0].startElapsedSeconds).to.equal(0);
    expect(blocks[0].baseDistanceMetres).to.be.at.least(0);
    expect(blocks[0].blockNumber).to.equal(1);
  });

  it("does not create blocks for uncovered gaps between covered periods", () => {
    const baseInput = FillFromSurrogateBlocks.createSourceInput(
      "base",
      "base.tcx",
      makeSurrogateActivity([
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:00Z",
          position: [0, 0],
        }),
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:05Z",
          position: [0, 0.0005],
        }),
      ]),
      0,
    );

    const donorInput = FillFromSurrogateBlocks.createSourceInput(
      "donor",
      "donor.tcx",
      makeSurrogateActivity([
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:30Z",
          position: [0, 0.003],
        }),
        makeSurrogateRecord({
          timestamp: "2024-01-01T00:00:35Z",
          position: [0, 0.0035],
        }),
      ]),
      0,
    );

    const blocks = FillFromSurrogateBlocks.buildBlocks(
      [baseInput],
      [donorInput],
      { minCoverageThresholdSeconds: 5, maxCoverageThresholdSeconds: 5 },
    );

    expect(blocks.length).to.equal(2);
    expect(blocks.every((block) => block.baseCoverage || block.donorCoverage)).to.equal(true);
  });

  it("builds coloured output-map segments and grey connectors across skipped blocks", () => {
    const baseRecords = [
      Object.assign(makeSurrogateRecord({
        timestamp: "2024-01-01T00:00:00Z",
        position: [0, 0],
      }), { sourceKind: "base", sourcePriority: 0, sourceRecordIndex: 0, _timestampMs: new Date("2024-01-01T00:00:00Z").getTime() }),
      Object.assign(makeSurrogateRecord({
        timestamp: "2024-01-01T00:00:05Z",
        position: [0, 0.0005],
      }), { sourceKind: "base", sourcePriority: 0, sourceRecordIndex: 1, _timestampMs: new Date("2024-01-01T00:00:05Z").getTime() }),
    ];
    const donorRecords = [
      Object.assign(makeSurrogateRecord({
        timestamp: "2024-01-01T00:00:20Z",
        position: [0, 0.002],
      }), { sourceKind: "donor", sourcePriority: 0, sourceRecordIndex: 0, _timestampMs: new Date("2024-01-01T00:00:20Z").getTime() }),
      Object.assign(makeSurrogateRecord({
        timestamp: "2024-01-01T00:00:25Z",
        position: [0, 0.0025],
      }), { sourceKind: "donor", sourcePriority: 0, sourceRecordIndex: 1, _timestampMs: new Date("2024-01-01T00:00:25Z").getTime() }),
    ];

    const blocks = [
      { index: 0, blockNumber: 1, currentSelection: "base", baseRecords, donorRecords: [] },
      { index: 1, blockNumber: 2, currentSelection: "none", baseRecords: [], donorRecords: [] },
      { index: 2, blockNumber: 3, currentSelection: "donor", baseRecords: [], donorRecords },
    ];

    const segments = FillFromSurrogateOutput.buildOutputMapSegments(blocks);
    expect(segments.some((segment) => segment.colourKey === "base")).to.equal(true);
    expect(segments.some((segment) => segment.colourKey === "donor")).to.equal(true);
    expect(segments.some((segment) => segment.colourKey === "none")).to.equal(true);
  });
});
