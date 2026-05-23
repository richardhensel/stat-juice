(function (global) {
  "use strict";

  function cloneRecord(record) {
    return {
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
      sourceKind: record.sourceKind,
      sourcePriority: record.sourcePriority,
      sourceName: record.sourceName,
      sourceRecordIndex: record.sourceRecordIndex,
      _timestampMs: record._timestampMs,
    };
  }

  function sortRecords(records) {
    return [...records].sort((left, right) => {
      if (left._timestampMs !== right._timestampMs) {
        return left._timestampMs - right._timestampMs;
      }
      return (left.sourcePriority ?? 0) - (right.sourcePriority ?? 0);
    });
  }

  function sanitiseDonorRecord(record) {
    const clone = cloneRecord(record);
    clone.hr = null;
    clone.cadence = null;
    clone.power = null;
    return clone;
  }

  function dedupeRecords(records) {
    const uniqueByTimestamp = new Map();
    for (const record of sortRecords(records)) {
      if (!uniqueByTimestamp.has(record.timestamp)) {
        uniqueByTimestamp.set(record.timestamp, record);
      }
    }
    return sortRecords([...uniqueByTimestamp.values()]);
  }

  function buildOutputRecordsFromBlocks(blocks) {
    const collected = [];

    for (const block of blocks) {
      if (block.currentSelection === "base") {
        for (const record of dedupeRecords(block.baseRecords)) {
          collected.push(cloneRecord(record));
        }
      } else if (block.currentSelection === "donor") {
        for (const record of dedupeRecords(block.donorRecords)) {
          collected.push(sanitiseDonorRecord(record));
        }
      }
    }

    return dedupeRecords(collected);
  }

  function getSelectedRecordsForBlock(block) {
    if (block.currentSelection === "base") {
      return dedupeRecords(block.baseRecords).map(cloneRecord);
    }
    if (block.currentSelection === "donor") {
      return dedupeRecords(block.donorRecords).map(sanitiseDonorRecord);
    }
    return [];
  }

  function hasPosition(record) {
    return global.FillFromSurrogateBlocks.hasPosition(record);
  }

  function calculateIncrementalDistance(previousRecord, currentRecord) {
    if (!previousRecord) {
      return 0;
    }

    if (hasPosition(previousRecord) && hasPosition(currentRecord)) {
      return global.haversineDistance(previousRecord.position, currentRecord.position);
    }

    if (Number.isFinite(currentRecord.incrementalDistance) && currentRecord.incrementalDistance > 0) {
      return currentRecord.incrementalDistance;
    }

    return 0;
  }

  function rebuildOutputRecords(records) {
    const rebuilt = [];
    let cumulativeDistance = 0;
    let totalCalories = 0;

    for (let index = 0; index < records.length; index += 1) {
      const sourceRecord = records[index];
      const previousRecord = rebuilt[index - 1] || null;
      const nextRecord = records[index + 1] || null;

      const incrementalDistance = calculateIncrementalDistance(previousRecord, sourceRecord);
      cumulativeDistance += incrementalDistance;

      let cumulativeDuration = 0;
      if (index > 0) {
        cumulativeDuration =
          previousRecord.cumulativeDuration +
          (sourceRecord._timestampMs - previousRecord._timestampMs) / 1000;
      }

      if (nextRecord && Number.isFinite(sourceRecord.calorieRate)) {
        totalCalories +=
          sourceRecord.calorieRate * ((nextRecord._timestampMs - sourceRecord._timestampMs) / 1000);
      }

      rebuilt.push(
        Object.assign({}, sourceRecord, {
          lapId: 1,
          incrementalDistance,
          cumulativeDistance,
          cumulativeDuration,
        }),
      );
    }

    return {
      records: rebuilt,
      totalCalories,
    };
  }

  function pickTemplateActivity(baseInputs, donorInputs) {
    const template =
      baseInputs.find((input) => input.activityData.records.length > 0) ||
      donorInputs.find((input) => input.activityData.records.length > 0) ||
      null;

    return template ? template.activityData : null;
  }

  function averageOf(records, fieldName) {
    const values = records
      .map((record) => record[fieldName])
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length) {
      return null;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function maxOf(records, fieldName) {
    const values = records
      .map((record) => record[fieldName])
      .filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? Math.max(...values) : null;
  }

  function buildOutputActivity(baseInputs, donorInputs, blocks) {
    const selectedRecords = buildOutputRecordsFromBlocks(blocks);
    if (!selectedRecords.length) {
      return null;
    }

    const rebuilt = rebuildOutputRecords(selectedRecords);
    const outputRecords = rebuilt.records;
    const templateActivity = pickTemplateActivity(baseInputs, donorInputs);
    const totalTimeSeconds =
      outputRecords.length > 1
        ? (outputRecords[outputRecords.length - 1]._timestampMs - outputRecords[0]._timestampMs) / 1000
        : 0;
    const totalDistance = outputRecords[outputRecords.length - 1].cumulativeDistance || 0;

    return {
      activity: {
        activityType: templateActivity?.activity?.activityType || "Other",
        activityId: outputRecords[0].timestamp,
        creator: templateActivity?.activity?.creator || null,
        author: templateActivity?.activity?.author || null,
      },
      laps: [
        {
          lapId: 1,
          startTime: outputRecords[0].timestamp,
          calories: Math.round(rebuilt.totalCalories),
          duration: totalTimeSeconds,
          distance: totalDistance,
          maxSpeed: maxOf(outputRecords, "speed"),
          avgHeartRate: averageOf(outputRecords, "hr"),
          maxHeartRate: maxOf(outputRecords, "hr"),
          intensity: templateActivity?.laps?.[0]?.intensity || "Active",
          cadence: averageOf(outputRecords, "cadence"),
          triggerMethod: templateActivity?.laps?.[0]?.triggerMethod || "Manual",
          avgSpeed: totalTimeSeconds > 0 ? totalDistance / totalTimeSeconds : 0,
          maxBikeCadence: maxOf(outputRecords, "cadence"),
          steps: null,
          avgWatts: averageOf(outputRecords, "power"),
          maxWatts: maxOf(outputRecords, "power"),
        },
      ],
      records: outputRecords,
    };
  }

  function positionsFromRecords(records) {
    return records
      .filter((record) => hasPosition(record))
      .map((record) => ({
        lat: record.position[0],
        lon: record.position[1],
        timestamp: record.timestamp,
      }));
  }

  function buildOutputMapSegments(blocks) {
    const segments = [];
    let previousSelectedBlock = null;
    let previousSelectedRecords = [];

    for (const block of blocks) {
      const selectedRecords = getSelectedRecordsForBlock(block);
      const positions = positionsFromRecords(selectedRecords);

      if (selectedRecords.length && previousSelectedBlock && previousSelectedRecords.length) {
        const skippedBlocks = block.index - previousSelectedBlock.index > 1;
        const previousPositions = positionsFromRecords(previousSelectedRecords);
        const previousEnd = previousPositions[previousPositions.length - 1];
        const currentStart = positions[0];

        if (skippedBlocks && previousEnd && currentStart) {
          segments.push({
            kind: "connector",
            colourKey: "none",
            blockNumber: block.blockNumber,
            points: [
              [previousEnd.lat, previousEnd.lon],
              [currentStart.lat, currentStart.lon],
            ],
          });
        }
      }

      if (positions.length >= 2) {
        segments.push({
          kind: "selected",
          colourKey: block.currentSelection,
          blockNumber: block.blockNumber,
          points: positions.map((position) => [position.lat, position.lon]),
        });
      }

      if (selectedRecords.length) {
        previousSelectedBlock = block;
        previousSelectedRecords = selectedRecords;
      }
    }

    return segments;
  }

  function buildOutputFileName(baseInputs) {
    const baseName = baseInputs[0]?.name || "activity";
    const dotIndex = baseName.lastIndexOf(".");
    if (dotIndex === -1) {
      return `${baseName}_filled_from_surrogate.tcx`;
    }
    return `${baseName.slice(0, dotIndex)}_filled_from_surrogate${baseName.slice(dotIndex)}`;
  }

  function downloadTcx(activityData, fileName) {
    if (!activityData) {
      return;
    }

    const tcxContent = global.createTcxFile(activityData);
    const blob = new Blob([tcxContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  global.FillFromSurrogateOutput = {
    sanitiseDonorRecord,
    dedupeRecords,
    buildOutputRecordsFromBlocks,
    buildOutputActivity,
    buildOutputMapSegments,
    buildOutputFileName,
    downloadTcx,
  };
})(globalThis);
