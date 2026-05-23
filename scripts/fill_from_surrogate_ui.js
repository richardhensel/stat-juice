(function (global) {
  "use strict";

  const SOURCE_COLOURS = {
    baseFiles: ["#2563eb", "#0ea5e9", "#16a34a", "#7c3aed", "#ea580c", "#db2777"],
    donorFiles: ["#dc2626", "#f97316", "#ca8a04", "#9333ea", "#0891b2", "#64748b"],
    base: "#2563eb",
    donor: "#dc2626",
    none: "#9ca3af",
  };

  function formatDateTime(timestamp) {
    if (!timestamp) {
      return "Unknown";
    }
    return new Date(timestamp).toLocaleString();
  }

  function formatLocation(position) {
    if (!position || position[0] == null || position[1] == null) {
      return "Unknown";
    }
    return `${position[0].toFixed(5)}, ${position[1].toFixed(5)}`;
  }

  function formatElapsedSeconds(totalSeconds) {
    const rounded = Math.max(0, Math.round(totalSeconds || 0));
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const seconds = rounded % 60;
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  function formatDistanceMetres(distanceMetres) {
    return `${(distanceMetres / 1000).toFixed(2)} km`;
  }

  function formatSummaryStats(stats) {
    if (!stats) {
      return "No data";
    }

    return {
      totalTime: `${Math.round((stats.totalTime || 0) / 60)} min`,
      totalDistance: `${((stats.totalDistance || 0) / 1000).toFixed(2)} km`,
      averageSpeed: `${(((stats.averageSpeed || 0) * 3.6)).toFixed(1)} km/h`,
      totalElevationGained: `${stats.totalElevationGained || 0} m`,
      averageHR: stats.averageHR == null ? "n/a" : `${stats.averageHR} bpm`,
      averagePower: stats.averagePower == null ? "n/a" : `${stats.averagePower} W`,
      totalCalories: `${stats.totalCalories || 0} kcal`,
    };
  }

  function parseFiles(fileList, sourceKind) {
    const files = Array.from(fileList || []);
    return Promise.all(
      files.map(
        (file, priority) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              try {
                const xml = new DOMParser().parseFromString(event.target.result, "text/xml");
                const activityData = global.processTcxXml(xml);
                resolve(
                  global.FillFromSurrogateBlocks.createSourceInput(
                    sourceKind,
                    file.name,
                    activityData,
                    priority,
                  ),
                );
              } catch (error) {
                reject(error);
              }
            };
            reader.onerror = () => reject(reader.error || new Error(`Failed to read ${file.name}`));
            reader.readAsText(file);
          }),
      ),
    );
  }

  function createMap(mapId) {
    const map = L.map(mapId).setView([0, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    return map;
  }

  function clearLayerList(map, layers) {
    for (const layer of layers) {
      if (layer) {
        map.removeLayer(layer);
      }
    }
    layers.length = 0;
  }

  function createNumberedIcon(blockNumber, colour) {
    return L.divIcon({
      className: "block-marker-icon",
      html: `<div class="block-marker-dot" style="background:${colour};">${blockNumber}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  function clearMarkerList(map, markers) {
    for (const marker of markers) {
      if (marker) {
        map.removeLayer(marker);
      }
    }
    markers.length = 0;
  }

  function fitMapToBounds(map, latLngs) {
    if (!latLngs.length) {
      return;
    }
    const bounds = L.latLngBounds(latLngs);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [16, 16] });
    }
  }

  function plotActivitiesOnMap(map, layers, inputs, colours) {
    clearLayerList(map, layers);

    const allLatLngs = [];
    inputs.forEach((input, index) => {
      const hasPlottablePositions = input.activityData.records.some((record) =>
        global.FillFromSurrogateBlocks.hasPosition(record),
      );
      if (!hasPlottablePositions) {
        return;
      }

      const positions = input.activityData.records
        .filter((record) => global.FillFromSurrogateBlocks.hasPosition(record))
        .map((record) => [record.position[0], record.position[1]]);
      const layer = L.polyline(positions, { color: colours[index % colours.length], weight: 4 }).addTo(map);
      layers.push(layer);
      allLatLngs.push(...layer.getLatLngs());
    });

    fitMapToBounds(map, allLatLngs);
  }

  function renderBlockMarkers(map, markerLayers, blocks, locationField, colour) {
    clearMarkerList(map, markerLayers);

    for (const block of blocks) {
      const position = block[locationField];
      if (!position || position[0] == null || position[1] == null) {
        continue;
      }

      const marker = L.marker([position[0], position[1]], {
        icon: createNumberedIcon(block.blockNumber, colour),
      }).addTo(map);
      markerLayers.push(marker);
    }
  }

  function renderOutputMap(state) {
    clearLayerList(state.maps.output, state.maps.outputSegmentLayers);
    clearMarkerList(state.maps.output, state.maps.outputMarkerLayers);

    const segments = global.FillFromSurrogateOutput.buildOutputMapSegments(state.blocks);
    const allLatLngs = [];

    for (const segment of segments) {
      const polyline = L.polyline(segment.points, {
        color: SOURCE_COLOURS[segment.colourKey],
        weight: 5,
        opacity: segment.kind === "connector" ? 0.85 : 1,
        dashArray: segment.kind === "connector" ? "6 8" : null,
      }).addTo(state.maps.output);
      state.maps.outputSegmentLayers.push(polyline);
      allLatLngs.push(...polyline.getLatLngs());
    }

    renderBlockMarkers(
      state.maps.output,
      state.maps.outputMarkerLayers,
      state.blocks.filter((block) => block.currentSelection !== "none"),
      "selectedStartLocation",
      SOURCE_COLOURS.none,
    );

    const markerLatLngs = state.maps.outputMarkerLayers.map((marker) => marker.getLatLng());
    fitMapToBounds(state.maps.output, [...allLatLngs, ...markerLatLngs]);
  }

  function getBlockDistanceMetres(block) {
    if (block.currentSelection === "base") {
      return block.baseDistanceMetres;
    }
    if (block.currentSelection === "donor") {
      return block.donorDistanceMetres;
    }
    if (block.baseAvailable) {
      return block.baseDistanceMetres;
    }
    if (block.donorAvailable) {
      return block.donorDistanceMetres;
    }
    return 0;
  }

  function getBlockTintStyle(selection) {
    const colour = SOURCE_COLOURS[selection] || SOURCE_COLOURS.none;
    return `background:${colour}18;border-color:${colour}66;`;
  }

  function createChoiceSquare(block, source, isAvailable, state) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `choice-square${block.currentSelection === source ? " choice-square-active" : ""}`;
    button.style.setProperty("--choice-colour", SOURCE_COLOURS[source]);
    button.title = source;
    button.textContent = "";
    if (!isAvailable) {
      button.disabled = true;
    }
    button.addEventListener("click", () => {
      if (!isAvailable) {
        return;
      }
      block.currentSelection = source;
      block.userOverridden = source !== block.defaultSelection;
      global.FillFromSurrogateState.recalculateOutputOnly(state);
      renderAll(state);
    });
    return button;
  }

  function renderBlockList(state) {
    const blockList = document.getElementById("block-list");
    blockList.textContent = "";

    if (!state.blocks.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.textContent = "Upload at least one base or donor TCX file to build blocks.";
      blockList.appendChild(emptyState);
      return;
    }

    state.blocks.forEach((block, index) => {
      const row = document.createElement("article");
      row.className = "block-row";
      row.setAttribute("style", getBlockTintStyle(block.currentSelection));

      const number = document.createElement("div");
      number.className = "block-number";
      number.textContent = `${block.blockNumber}`;

      const elapsed = document.createElement("div");
      elapsed.className = "block-metric";
      elapsed.innerHTML = `<span>Start</span><strong>${formatElapsedSeconds(block.startElapsedSeconds)}</strong>`;

      const elapsedEnd = document.createElement("div");
      elapsedEnd.className = "block-metric";
      elapsedEnd.innerHTML = `<span>End</span><strong>${formatElapsedSeconds(block.endElapsedSeconds)}</strong>`;

      const distance = document.createElement("div");
      distance.className = "block-metric";
      distance.innerHTML = `<span>Distance</span><strong>${formatDistanceMetres(getBlockDistanceMetres(block))}</strong>`;

      const choices = document.createElement("div");
      choices.className = "choice-squares";
      if (block.baseAvailable) {
        choices.appendChild(createChoiceSquare(block, "base", true, state));
      }
      if (block.donorAvailable) {
        choices.appendChild(createChoiceSquare(block, "donor", true, state));
      }
      choices.appendChild(createChoiceSquare(block, "none", true, state));

      row.appendChild(number);
      row.appendChild(elapsed);
      row.appendChild(elapsedEnd);
      row.appendChild(distance);
      row.appendChild(choices);
      blockList.appendChild(row);
    });
  }

  function firstAndLastPositions(activityData) {
    if (!activityData || !activityData.records.length) {
      return { startTime: null, endTime: null, startLocation: null, endLocation: null };
    }

    const first = activityData.records[0];
    const last = activityData.records[activityData.records.length - 1];
    return {
      startTime: first.timestamp,
      endTime: last.timestamp,
      startLocation: first.position,
      endLocation: last.position,
    };
  }

  function renderOutputSummary(state) {
    const summary = document.getElementById("output-summary");
    summary.textContent = "";

    if (!state.outputActivity || !state.outputActivity.records.length) {
      summary.innerHTML = "<p>No output is currently selected.</p>";
      document.getElementById("download-button").disabled = true;
      return;
    }

    document.getElementById("download-button").disabled = false;
    const outputMeta = firstAndLastPositions(state.outputActivity);
    const items = [
      ["Start time", formatDateTime(outputMeta.startTime)],
      ["End time", formatDateTime(outputMeta.endTime)],
      ["Start location", formatLocation(outputMeta.startLocation)],
      ["End location", formatLocation(outputMeta.endLocation)],
      ["Trackpoints", `${state.outputActivity.records.length}`],
    ];

    const list = document.createElement("div");
    list.className = "summary-grid";
    items.forEach(([label, value]) => {
      const cell = document.createElement("div");
      cell.className = "summary-cell";
      cell.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      list.appendChild(cell);
    });

    summary.appendChild(list);
  }

  function makeStatsRow(label, activityData) {
    const row = document.createElement("tr");
    const stats = activityData ? formatSummaryStats(global.calculateSummaryStats(activityData)) : null;
    const cells = [
      label,
      stats ? stats.totalTime : "n/a",
      stats ? stats.totalDistance : "n/a",
      stats ? stats.averageSpeed : "n/a",
      stats ? stats.totalElevationGained : "n/a",
      stats ? stats.averageHR : "n/a",
      stats ? stats.averagePower : "n/a",
      stats ? stats.totalCalories : "n/a",
    ];

    cells.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    return row;
  }

  function renderSummaryTable(state) {
    const tableBody = document.getElementById("summary-stats-body");
    tableBody.textContent = "";

    state.baseInputs.forEach((input) => {
      tableBody.appendChild(makeStatsRow(`Base: ${input.name}`, input.activityData));
    });

    state.donorInputs.forEach((input) => {
      tableBody.appendChild(makeStatsRow(`Donor: ${input.name}`, input.activityData));
    });

    tableBody.appendChild(makeStatsRow("Output", state.outputActivity));
  }

  function renderMaps(state) {
    plotActivitiesOnMap(state.maps.base, state.maps.baseLayers, state.baseInputs, SOURCE_COLOURS.baseFiles);
    plotActivitiesOnMap(
      state.maps.donor,
      state.maps.donorLayers,
      state.donorInputs,
      SOURCE_COLOURS.donorFiles,
    );
    renderBlockMarkers(
      state.maps.base,
      state.maps.baseMarkerLayers,
      state.blocks,
      "baseStartLocation",
      SOURCE_COLOURS.base,
    );
    renderBlockMarkers(
      state.maps.donor,
      state.maps.donorMarkerLayers,
      state.blocks,
      "donorStartLocation",
      SOURCE_COLOURS.donor,
    );
    renderOutputMap(state);
  }

  function renderAll(state) {
    renderBlockList(state);
    renderOutputSummary(state);
    renderSummaryTable(state);
    renderMaps(state);
  }

  function updateStatus(message, isError) {
    const status = document.getElementById("page-status");
    status.textContent = message;
    status.className = isError ? "status status-error" : "status";
  }

  async function handleUpload(state, sourceKind, fileList) {
    try {
      updateStatus(`Loading ${sourceKind} TCX file(s)...`, false);
      const parsedInputs = await parseFiles(fileList, sourceKind);
      state[`${sourceKind}Inputs`] = parsedInputs;
      global.FillFromSurrogateState.recalculateDerivedState(state);
      renderAll(state);
      updateStatus(`Loaded ${state.baseInputs.length} base file(s) and ${state.donorInputs.length} donor file(s).`, false);
    } catch (error) {
      console.error(error);
      updateStatus(`Failed to load ${sourceKind} file(s): ${error.message}`, true);
    }
  }

  function bindUploadControls(state) {
    document.getElementById("base-file-input").addEventListener("change", (event) => {
      handleUpload(state, "base", event.target.files);
    });

    document.getElementById("donor-file-input").addEventListener("change", (event) => {
      handleUpload(state, "donor", event.target.files);
    });
  }

  function bindDownloadButton(state) {
    document.getElementById("download-button").addEventListener("click", () => {
      if (!state.outputActivity) {
        return;
      }

      global.FillFromSurrogateOutput.downloadTcx(
        state.outputActivity,
        global.FillFromSurrogateOutput.buildOutputFileName(state.baseInputs),
      );
    });
  }

  function initialisePage() {
    const state = global.FillFromSurrogateState.createInitialState();
    state.maps.base = createMap("base-map");
    state.maps.donor = createMap("donor-map");
    state.maps.output = createMap("output-map");

    bindUploadControls(state);
    bindDownloadButton(state);
    renderAll(state);
  }

  global.FillFromSurrogateUi = {
    initialisePage,
    formatSummaryStats,
    formatLocation,
    formatDateTime,
  };
})(globalThis);
