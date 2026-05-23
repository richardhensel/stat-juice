(function (global) {
  "use strict";

  const DEFAULT_CONFIG = {
    gapFactor: 3.0,
    minCoverageThresholdSeconds: 5,
    maxCoverageThresholdSeconds: 30,
    donorSwitchRadiusMetres: 100,
    donorSwitchProximityCheck: true,
  };

  function toTimestampMs(timestamp) {
    const value = new Date(timestamp).getTime();
    return Number.isFinite(value) ? value : null;
  }

  function cloneRecord(record, extraFields) {
    return Object.assign(
      {
        lapId: record.lapId,
        timestamp: record.timestamp,
        position: Array.isArray(record.position) ? [...record.position] : [null, null],
        altitude: record.altitude,
        incrementalDistance: record.incrementalDistance,
        cumulativeDistance: record.cumulativeDistance,
        hr: record.hr,
        cadence: record.cadence,
        power: record.power,
        speed: record.speed,
        calorieRate: record.calorieRate,
        temperature: record.temperature,
        cumulativeDuration: record.cumulativeDuration,
      },
      extraFields || {},
    );
  }

  function sortRecords(records) {
    return [...records].sort((left, right) => {
      if (left._timestampMs !== right._timestampMs) {
        return left._timestampMs - right._timestampMs;
      }
      return (left.priority ?? left.sourcePriority ?? 0) - (right.priority ?? right.sourcePriority ?? 0);
    });
  }

  function createSourceInput(sourceKind, fileName, activityData, priority) {
    const records = (activityData.records || [])
      .map((record, index) =>
        cloneRecord(record, {
          sourceKind,
          sourceName: fileName,
          priority,
          sourcePriority: priority,
          sourceRecordIndex: index,
          _timestampMs: toTimestampMs(record.timestamp),
        }),
      )
      .filter((record) => record._timestampMs !== null);

    const sortedRecords = sortRecords(records);
    const expectedIntervalSeconds = estimateExpectedIntervalSeconds(sortedRecords);
    const coverageThresholdSeconds = calculateThresholdSeconds(
      expectedIntervalSeconds,
      DEFAULT_CONFIG.gapFactor,
      DEFAULT_CONFIG.minCoverageThresholdSeconds,
      DEFAULT_CONFIG.maxCoverageThresholdSeconds,
    );

    return {
      id: `${sourceKind}-${priority}-${fileName}`,
      name: fileName,
      sourceKind,
      priority,
      activityData,
      records: sortedRecords,
      expectedIntervalSeconds,
      coverageThresholdSeconds,
      coverageIntervals: buildCoverageIntervals(sortedRecords, coverageThresholdSeconds),
    };
  }

  function estimateExpectedIntervalSeconds(records) {
    const deltas = [];
    for (let index = 1; index < records.length; index += 1) {
      const deltaSeconds = (records[index]._timestampMs - records[index - 1]._timestampMs) / 1000;
      if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
        deltas.push(deltaSeconds);
      }
    }

    if (deltas.length === 0) {
      return 1;
    }

    deltas.sort((left, right) => left - right);
    const middle = Math.floor(deltas.length / 2);
    if (deltas.length % 2 === 1) {
      return deltas[middle];
    }
    return (deltas[middle - 1] + deltas[middle]) / 2;
  }

  function calculateThresholdSeconds(expectedIntervalSeconds, gapFactor, minGapSeconds, maxGapSeconds) {
    const unclamped = expectedIntervalSeconds * gapFactor;
    return Math.max(minGapSeconds, Math.min(maxGapSeconds, unclamped));
  }

  function buildCoverageIntervals(records, thresholdSeconds) {
    if (!records.length) {
      return [];
    }

    const halfWindowMs = (thresholdSeconds * 1000) / 2;
    const rawIntervals = records.map((record) => ({
      startMs: record._timestampMs - halfWindowMs,
      endMs: record._timestampMs + halfWindowMs,
    }));

    return mergeIntervals(rawIntervals);
  }

  function mergeIntervals(intervals) {
    if (!intervals.length) {
      return [];
    }

    const sortedIntervals = [...intervals].sort((left, right) => left.startMs - right.startMs);
    const merged = [Object.assign({}, sortedIntervals[0])];

    for (let index = 1; index < sortedIntervals.length; index += 1) {
      const current = sortedIntervals[index];
      const last = merged[merged.length - 1];
      if (current.startMs <= last.endMs) {
        last.endMs = Math.max(last.endMs, current.endMs);
      } else {
        merged.push(Object.assign({}, current));
      }
    }

    return merged;
  }

  function isIntervalCovered(intervals, startMs, endMs) {
    return intervals.some((interval) => interval.startMs < endMs && interval.endMs > startMs);
  }

  function hasPosition(record) {
    return (
      record &&
      Array.isArray(record.position) &&
      record.position.length === 2 &&
      record.position[0] !== null &&
      record.position[1] !== null &&
      Number.isFinite(record.position[0]) &&
      Number.isFinite(record.position[1])
    );
  }

  function chooseLatestRecord(recordsAtTime) {
    if (!recordsAtTime.length) {
      return null;
    }

    return [...recordsAtTime].sort((left, right) => {
      if ((left.priority ?? left.sourcePriority ?? 0) !== (right.priority ?? right.sourcePriority ?? 0)) {
        return (left.priority ?? left.sourcePriority ?? 0) - (right.priority ?? right.sourcePriority ?? 0);
      }
      return (left.sourceRecordIndex ?? 0) - (right.sourceRecordIndex ?? 0);
    })[0];
  }

  function collectTransitionBoundaryTimes(baseRecords, donorRecords, radiusMetres, overallStartMs, overallEndMs) {
    const groupedEvents = new Map();
    const allRecords = [...baseRecords, ...donorRecords];

    for (const record of allRecords) {
      if (record._timestampMs < overallStartMs || record._timestampMs > overallEndMs) {
        continue;
      }
      if (!groupedEvents.has(record._timestampMs)) {
        groupedEvents.set(record._timestampMs, { base: [], donor: [] });
      }
      groupedEvents.get(record._timestampMs)[record.sourceKind].push(record);
    }

    const orderedTimes = [...groupedEvents.keys()].sort((left, right) => left - right);
    const boundaries = [];
    let latestBase = null;
    let latestDonor = null;
    let previousInsideRadius = false;

    for (const timeMs of orderedTimes) {
      const eventGroup = groupedEvents.get(timeMs);
      if (eventGroup.base.length) {
        latestBase = chooseLatestRecord(eventGroup.base);
      }
      if (eventGroup.donor.length) {
        latestDonor = chooseLatestRecord(eventGroup.donor);
      }

      let insideRadius = false;
      if (hasPosition(latestBase) && hasPosition(latestDonor)) {
        insideRadius =
          global.haversineDistance(latestBase.position, latestDonor.position) <= radiusMetres;
      }

      if (!previousInsideRadius && insideRadius) {
        boundaries.push(timeMs);
      }
      previousInsideRadius = insideRadius;
    }

    return boundaries;
  }

  function assignRecordsToBlocks(blocks, records, fieldName) {
    let recordIndex = 0;

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
      const block = blocks[blockIndex];
      const blockRecords = [];

      while (recordIndex < records.length && records[recordIndex]._timestampMs < block.startMs) {
        recordIndex += 1;
      }

      let scanIndex = recordIndex;
      while (scanIndex < records.length) {
        const isLastBlock = blockIndex === blocks.length - 1;
        const timestampMs = records[scanIndex]._timestampMs;
        const inBlock = isLastBlock
          ? timestampMs >= block.startMs && timestampMs <= block.endMs
          : timestampMs >= block.startMs && timestampMs < block.endMs;

        if (!inBlock) {
          if (timestampMs >= block.endMs) {
            break;
          }
          scanIndex += 1;
          continue;
        }

        blockRecords.push(records[scanIndex]);
        scanIndex += 1;
      }

      block[fieldName] = blockRecords;
    }
  }

  function findNearestRecord(records, timeMs, direction) {
    if (!records.length) {
      return null;
    }

    if (direction === "before") {
      for (let index = records.length - 1; index >= 0; index -= 1) {
        if (records[index]._timestampMs <= timeMs) {
          return records[index];
        }
      }
      return null;
    }

    for (const record of records) {
      if (record._timestampMs >= timeMs) {
        return record;
      }
    }
    return null;
  }

  function chooseBoundaryLocation(primaryRecords, fallbackRecords, timeMs, direction) {
    const direct = primaryRecords.find(hasPosition);
    if (direct) {
      return direct.position;
    }

    const before = findNearestRecord(fallbackRecords, timeMs, "before");
    if (hasPosition(before)) {
      return before.position;
    }

    const after = findNearestRecord(fallbackRecords, timeMs, "after");
    if (hasPosition(after)) {
      return after.position;
    }

    return null;
  }

  function addBoundaryLocations(blocks, baseRecords, donorRecords) {
    const allRecords = sortRecords([...baseRecords, ...donorRecords]);

    for (const block of blocks) {
      const firstBlockRecords = sortRecords([...block.baseRecords, ...block.donorRecords]);
      const lastBlockRecords = [...firstBlockRecords].reverse();
      block.startLocation = chooseBoundaryLocation(firstBlockRecords, allRecords, block.startMs, "start");
      block.endLocation = chooseBoundaryLocation(lastBlockRecords, allRecords, block.endMs, "end");
      block.baseStartLocation = chooseBoundaryLocation(block.baseRecords, baseRecords, block.startMs, "start");
      block.donorStartLocation = chooseBoundaryLocation(block.donorRecords, donorRecords, block.startMs, "start");
    }
  }

  function calculateBlockDistanceMetres(records) {
    if (!records.length) {
      return 0;
    }

    let total = 0;
    let previousWithPosition = null;

    for (const record of records) {
      if (Number.isFinite(record.incrementalDistance) && record.incrementalDistance > 0) {
        total += record.incrementalDistance;
        if (hasPosition(record)) {
          previousWithPosition = record;
        }
        continue;
      }

      if (hasPosition(previousWithPosition) && hasPosition(record)) {
        total += global.haversineDistance(previousWithPosition.position, record.position);
      }

      if (hasPosition(record)) {
        previousWithPosition = record;
      }
    }

    return total;
  }

  function buildBlocks(baseInputs, donorInputs, config) {
    const mergedConfig = Object.assign({}, DEFAULT_CONFIG, config || {});
    const baseRecords = sortRecords(baseInputs.flatMap((input) => input.records));
    const donorRecords = sortRecords(donorInputs.flatMap((input) => input.records));
    const allRecords = sortRecords([...baseRecords, ...donorRecords]);

    if (!allRecords.length) {
      return [];
    }

    const overallStartMs = allRecords[0]._timestampMs;
    const overallEndMs = allRecords[allRecords.length - 1]._timestampMs;
    const baseCoverage = mergeIntervals(baseInputs.flatMap((input) => input.coverageIntervals));
    const donorCoverage = mergeIntervals(donorInputs.flatMap((input) => input.coverageIntervals));

    const boundaryTimes = new Set([overallStartMs, overallEndMs]);
    for (const interval of [...baseCoverage, ...donorCoverage]) {
      boundaryTimes.add(Math.max(overallStartMs, interval.startMs));
      boundaryTimes.add(Math.min(overallEndMs, interval.endMs));
    }

    for (const transitionTime of collectTransitionBoundaryTimes(
      baseRecords,
      donorRecords,
      mergedConfig.donorSwitchRadiusMetres,
      overallStartMs,
      overallEndMs,
    )) {
      boundaryTimes.add(transitionTime);
    }

    const orderedBoundaryTimes = [...boundaryTimes]
      .filter((timeMs) => timeMs >= overallStartMs && timeMs <= overallEndMs)
      .sort((left, right) => left - right);

    const blocks = [];
    const pushBlock = (index, startMs, endMs) => {
      blocks.push({
        id: `block-${index + 1}`,
        index,
        startMs,
        endMs,
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
        baseCoverage: isIntervalCovered(baseCoverage, startMs, endMs) || isIntervalCovered(baseCoverage, startMs - 1, endMs + 1),
        donorCoverage: isIntervalCovered(donorCoverage, startMs, endMs) || isIntervalCovered(donorCoverage, startMs - 1, endMs + 1),
        baseRecords: [],
        donorRecords: [],
        defaultSelection: "none",
        currentSelection: "none",
        defaultReason: "No data selected yet.",
        userOverridden: false,
      });
    };

    if (orderedBoundaryTimes.length === 1) {
      pushBlock(0, orderedBoundaryTimes[0], orderedBoundaryTimes[0]);
    } else {
      for (let index = 0; index < orderedBoundaryTimes.length - 1; index += 1) {
        const startMs = orderedBoundaryTimes[index];
        const endMs = orderedBoundaryTimes[index + 1];
        if (!(endMs > startMs)) {
          continue;
        }
        pushBlock(index, startMs, endMs);
      }
    }

    assignRecordsToBlocks(blocks, baseRecords, "baseRecords");
    assignRecordsToBlocks(blocks, donorRecords, "donorRecords");

    for (const block of blocks) {
      block.baseAvailable = block.baseRecords.length > 0;
      block.donorAvailable = block.donorRecords.length > 0;
      block.blockNumber = block.index + 1;
      block.startElapsedSeconds = (block.startMs - overallStartMs) / 1000;
      block.endElapsedSeconds = (block.endMs - overallStartMs) / 1000;
      block.baseDistanceMetres = calculateBlockDistanceMetres(block.baseRecords);
      block.donorDistanceMetres = calculateBlockDistanceMetres(block.donorRecords);
    }

    addBoundaryLocations(blocks, baseRecords, donorRecords);

    return blocks;
  }

  function findLatestBaseRecordBefore(baseInputs, timeMs) {
    const baseRecords = sortRecords(baseInputs.flatMap((input) => input.records));
    let latest = null;
    for (const record of baseRecords) {
      if (record._timestampMs >= timeMs) {
        break;
      }
      latest = record;
    }
    return latest;
  }

  function applyDefaultBlockSelections(blocks, baseInputs, config) {
    const mergedConfig = Object.assign({}, DEFAULT_CONFIG, config || {});
    let lastSelectedNonEmptySource = null;

    for (const block of blocks) {
      let defaultSelection = "none";
      let defaultReason = "No base or donor records are available in this block.";

      if (block.baseAvailable) {
        defaultSelection = "base";
        defaultReason = "Base records are available in this block, so base is the default choice.";
      } else if (block.donorAvailable) {
        const requiresEntryCheck =
          mergedConfig.donorSwitchProximityCheck && lastSelectedNonEmptySource === "base";

        if (!requiresEntryCheck) {
          defaultSelection = "donor";
          defaultReason =
            lastSelectedNonEmptySource === "donor"
              ? "Donor records continue from an earlier selected donor block, so no new proximity check is required."
              : "Donor records are available and there is no selected base block forcing a base-to-donor proximity check.";
        } else {
          const firstDonorRecord = block.donorRecords[0];
          const latestBaseRecord = findLatestBaseRecordBefore(baseInputs, block.startMs);

          if (!latestBaseRecord || !hasPosition(firstDonorRecord) || !hasPosition(latestBaseRecord)) {
            defaultSelection = "donor";
            defaultReason =
              "Donor records are available and no usable preceding base position was found, so the donor entry check does not block this block.";
          } else {
            const distanceMetres = global.haversineDistance(
              latestBaseRecord.position,
              firstDonorRecord.position,
            );
            if (distanceMetres <= mergedConfig.donorSwitchRadiusMetres) {
              defaultSelection = "donor";
              defaultReason = `Donor records are available and the donor block starts ${distanceMetres.toFixed(1)}m from the latest base point, within the ${mergedConfig.donorSwitchRadiusMetres}m switch radius.`;
            } else {
              defaultSelection = "none";
              defaultReason = `Donor records are available, but the donor block starts ${distanceMetres.toFixed(1)}m from the latest base point, outside the ${mergedConfig.donorSwitchRadiusMetres}m switch radius.`;
            }
          }
        }
      } else if (block.baseCoverage || block.donorCoverage) {
        defaultReason =
          "Coverage exists in this block, but no trackpoints fall inside it, so the default selection is none.";
      }

      block.defaultSelection = defaultSelection;
      block.currentSelection = defaultSelection;
      block.defaultReason = defaultReason;
      block.userOverridden = false;

      if (defaultSelection !== "none") {
        lastSelectedNonEmptySource = defaultSelection;
      }
    }

    return blocks;
  }

  global.FillFromSurrogateBlocks = {
    DEFAULT_CONFIG,
    createSourceInput,
    estimateExpectedIntervalSeconds,
    calculateThresholdSeconds,
    buildCoverageIntervals,
    mergeIntervals,
    collectTransitionBoundaryTimes,
    buildBlocks,
    applyDefaultBlockSelections,
    hasPosition,
    sortRecords,
  };
})(globalThis);
