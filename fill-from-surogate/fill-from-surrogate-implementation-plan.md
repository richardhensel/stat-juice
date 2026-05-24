# Fill From Surrogate Implementation Plan

## Overview

Implement a new StatJuice webpage for filling an output TCX from a combination of:

- one or more base TCX files
- one or more donor TCX files

The feature should be fully client-side and should reuse the existing StatJuice JavaScript utilities where practical.

The implementation should be split into:

- a new page for the user interface
- new JavaScript modules for block construction, block selection, and output generation
- reuse of existing JavaScript modules for TCX parsing, geometry calculations, map plotting, and summary statistics

## Proposed Files

### New Page

Create a new page:

```text
fill-from-surogate/index.html
```

This page should be linked from the main StatJuice navigation and from `index.html`.

### New JavaScript Files

Recommended new files under `scripts/`:

```text
scripts/fill_from_surrogate_blocks.js
scripts/fill_from_surrogate_state.js
scripts/fill_from_surrogate_output.js
scripts/fill_from_surrogate_ui.js
```

These files should keep the feature modular and testable.

### Existing JavaScript to Reuse

Use the following existing scripts where possible:

```text
scripts/tcx_utils.js
scripts/geometry_utils.js
scripts/plotting_utils.js
```

Current useful existing functionality:

- `processTcxXml()` in `tcx_utils.js` for parsing TCX into activity structures
- `calculateSummaryStats()` in `tcx_utils.js` for input/output summary statistics
- TCX serialisation helpers already present in `tcx_utils.js`
- `haversineDistance()` in `geometry_utils.js` for radius checks
- `plotPolylineOnMap()` and `clearPolylineFromMap()` in `plotting_utils.js` for the three maps

## Page Structure

The page should be laid out as two main columns with a 50/50 split.

Recommended layout rule:

- left column takes half the available width
- right column takes half the available width

### Left Column

The left column should contain:

- upload controls for base TCX files
- upload controls for donor TCX files
- a scrollable block list

The upload section should be kept as flat and compact as possible.

Recommended implementation:

- place base and donor upload controls in a compact horizontal or two-row layout
- avoid tall card-style panels if the same controls can be shown clearly in a flatter arrangement
- keep the upload controls visually lightweight so most of the left column height is available for blocks

Each block row should contain:

- block index
- block start elapsed time from the start of the first block
- block end elapsed time from the start of the first block
- total distance represented by the block
- compact selectable controls for `base`, `donor`, and `none`

This column should scroll independently from the right column.

Recommended implementation for block rows:

- use a flat horizontal layout rather than a tall stacked card
- keep the per-block summary to a single compact line or compact two-line arrangement
- render source choice with up to three small square buttons
- only show the `base` square if base data is available in that block
- only show the `donor` square if donor data is available in that block
- always show the `none` square
- clicking a square updates the block selection immediately
- tint the entire row background according to the current selection

Recommended colour rules:

- base-selected block row uses the base colour
- donor-selected block row uses the donor colour
- none-selected block row uses a neutral grey colour

### Right Column

The right column should contain:

- top map: base activities
- middle map: donor activities
- bottom map: current proposed output
- output summary section
- summary statistics table below the maps
- download button

The summary statistics table should show:

- one row per base input
- one row per donor input
- one row for the current proposed output

## High-Level Runtime Flow

Recommended page flow:

1. User uploads base TCX files.
2. User uploads donor TCX files.
3. Files are parsed into in-memory activity objects.
4. Coverage intervals are calculated for each file.
5. Shared timeline blocks are constructed.
6. Default source selection is computed for each block.
7. The block list is rendered.
8. The three maps are rendered.
9. Summary statistics are rendered for inputs and output.
10. User changes block selections as desired.
11. Output activity is regenerated from current selections after each change.
12. User downloads the current output TCX.

## Data Model

### Parsed Activity

Reuse the existing parsed TCX activity structure from `tcx_utils.js`, which already provides:

- `records`
- `laps`
- `activity`

The feature should treat these as the canonical input objects.

### Source Wrapper

Wrap each uploaded file in a structure like:

```text
id
name
source kind: base or donor
activity data
expected interval
coverage threshold
coverage intervals
priority
```

### Merge Block

Represent each block as:

```text
id
start time
end time
start elapsed seconds from first block
end elapsed seconds from first block
block distance
block start location
base coverage present
donor coverage present
base points in block
donor points in block
default selected source
current selected source
default decision reason
user overridden: yes/no
block number
```

### Page State

Keep a single in-memory state object containing:

```text
base inputs
donor inputs
blocks
current output activity
map layers
summary stats
```

This state should be the single source of truth for rendering.

## Block Construction Plan

Block construction should be implemented in `scripts/fill_from_surrogate_blocks.js`.

### Core Responsibilities

- flatten base and donor records
- determine coverage intervals for each input
- build merged base coverage
- build merged donor coverage
- identify outside-to-inside proximity transition times
- construct synchronised blocks
- discard any candidate time range where neither base nor donor coverage exists
- assign points into blocks

### Core Helper Functions

Recommended helpers:

```text
estimateExpectedIntervalSeconds(records)
calculateThresholdSeconds(expectedInterval, gapFactor, minGapSeconds, maxGapSeconds)
buildCoverageIntervals(records, thresholdSeconds)
mergeIntervals(intervals)
clipIntervals(intervals, overallTimelineStart, overallTimelineEnd)
collectTransitionBoundaryTimes(baseRecords, donorRecords, radiusMetres)
buildBlocks(baseCoverage, donorCoverage, baseRecords, donorRecords, radiusMetres)
assignPointsToBlocks(blocks, records, sourceKind)
```

### Overall Timeline

Because output bounds are no longer configured directly, block construction should use the overall loaded timeline.

Recommended rule:

- start at the earliest timestamp found in any loaded base or donor input
- end at the latest timestamp found in any loaded base or donor input

### Transition Boundary Detection

The requirements say a block split must happen whenever the latest known base position and latest known donor position transition from outside the configured radius to inside it.

Recommended implementation:

1. Create a sorted list of all record timestamps from base and donor inputs.
2. Walk these events in chronological order.
3. Keep track of:
   - latest known base record at or before current time
   - latest known donor record at or before current time
4. Use `haversineDistance()` from `geometry_utils.js`.
5. Whenever the state changes from outside-radius to inside-radius, record a block boundary at that event time.

This logic should not use historical path intersections; it should only use the latest known positions at that time.

### Coverage Filter

After the timeline has been split at all relevant boundaries:

- evaluate each candidate time range for merged base coverage and merged donor coverage
- discard any candidate range where neither base nor donor coverage exists
- only the remaining covered ranges become blocks in the UI and output-selection flow

This means timeline gaps with no coverage from either input should not produce placeholder blocks.

## Default Block Selection Plan

Default selection should be implemented after blocks are constructed.

Recommended function:

```text
applyDefaultBlockSelections(blocks, options)
```

It should:

- assign a default source for every block
- assign a default reason for every block
- preserve enough information for the UI to explain the default choice

### Default Rules

Implement the current rules from the requirements:

- default to base where base coverage exists
- default to donor where base coverage is absent and donor passes donor-entry rules
- default to `none` where no eligible source exists
- treat donor entry proximity as a default rule only
- only apply donor entry proximity when switching from selected base to selected donor
- do not re-apply donor entry proximity when continuing through donor blocks with no intervening selected base block

### User Overrides

User overrides should not rebuild the blocks.

Instead:

- blocks remain fixed
- only `current selected source` changes
- output activity and output map/statistics are regenerated from the current selections

## Output Activity Generation Plan

Output generation should be implemented in `scripts/fill_from_surrogate_output.js`.

Recommended responsibilities:

- collect the records from each block according to `current selected source`
- combine them into a single output activity
- deduplicate exact timestamp collisions according to source priority rules
- preserve or safely strip donor-derived fields as required
- serialise the final activity back to TCX XML
- preserve enough block provenance to drive coloured output-map rendering

Recommended helpers:

```text
buildOutputRecordsFromBlocks(blocks)
dedupeRecords(records)
buildOutputActivity(baseInputs, donorInputs, selectedRecords)
buildOutputMapSegments(blocks)
serializeActivityToTcx(activity)
downloadTcx(activity, filename)
```

### Output Map Segment Plan

The output map should not be rendered as a single colour polyline.

Recommended implementation:

- build output-map segments from the currently selected blocks
- colour segments from base-selected blocks with the base colour
- colour segments from donor-selected blocks with the donor colour
- when two selected blocks are separated by a jump or gap, draw the joining segment in the grey none colour
- when a block is set to `none`, omit its own trackpoints from the output but still allow the output map to show grey joins where needed between neighbouring selected blocks

### Donor Data Handling

The requirements leave room for a safe-surrogate donor policy.

Plan for two stages:

1. First implementation:
   - preserve the existing parsed record structure
   - carry enough fields for valid output generation
2. Later refinement:
   - explicitly remove donor-derived personal metrics if required

## UI Rendering Plan

UI rendering should be implemented in `scripts/fill_from_surrogate_ui.js`.

Recommended responsibilities:

- wire upload controls
- render block rows
- render output summary
- render summary statistics table
- render and refresh maps
- wire selection controls
- wire download button

Recommended functions:

```text
renderPage(state)
renderBlockList(state)
renderBlockRow(block, index)
renderBlockChoiceSquares(block)
renderSummaryStatsTable(state)
renderOutputSummary(state)
renderMaps(state)
bindUploadControls(state)
bindBlockSelectionHandlers(state)
bindDownloadButton(state)
```

### Block Row UI Plan

Recommended block-row behaviour:

- render elapsed start time, elapsed end time, and block distance in a compact flat layout
- render availability and selection through the same square-button control group
- use square fill/border treatment to show current selection clearly
- update the whole row tint immediately when the user changes selection
- avoid long explanatory text inside each block row so many blocks can fit on screen

## Summary Statistics Plan

The requirements explicitly call for summary stats for each input and the output.

Use the existing `calculateSummaryStats()` function from `tcx_utils.js`.

Recommended implementation:

- call it for every base input
- call it for every donor input
- call it for the current output activity whenever selections change

Add a small formatting helper in the new UI script or a shared helper:

```text
formatSummaryStats(stats)
```

This should likely follow the style already used in `fill-gaps.html` and `join.html`.

## Map Plan

Use Leaflet in the same style as the existing StatJuice pages.

Recommended layout:

- three independent map instances
- one for base inputs
- one for donor inputs
- one for output

Recommended rendering behaviour:

- base map shows all base activities, with one layer per uploaded file
- donor map shows all donor activities, with one layer per uploaded file
- output map shows the current selected output split into coloured source segments

Recommended marker behaviour:

- compute a start point for each block where plottable coordinates are available
- render a numbered dot marker for each block start point
- use the same block number across the base, donor, and output maps
- only show a marker on a given map when that map has a plottable location for that block
- keep the marker styling compact so it helps orientation without obscuring the route

Reuse:

- `plotPolylineOnMap()`
- `clearPolylineFromMap()`

If needed, extend `plotting_utils.js` with small helpers for:

- plotting multiple activities on one map
- using stable colours for multiple uploaded files
- plotting multiple coloured output segments on one map
- plotting numbered block-start markers

## Suggested HTML Skeleton

Recommended top-level structure for the new page:

```html
<body>
  <header>...</header>
  <main class="page-layout">
    <section class="left-column">
      <div class="upload-panel">...</div>
      <div class="block-list-panel">...</div>
    </section>
    <section class="right-column">
      <div class="map-panel base-map">...</div>
      <div class="map-panel donor-map">...</div>
      <div class="map-panel output-map">...</div>
      <div class="output-summary">...</div>
      <div class="summary-stats-table">...</div>
      <div class="download-panel">...</div>
    </section>
  </main>
</body>
```

## Testing Plan

Testing should be split into logic tests and browser/manual verification.

### JavaScript Logic Tests

Add new tests under `tests/` for the pure logic parts where practical.

Recommended test areas:

- coverage interval construction
- block boundary construction
- filtering out uncovered timeline gaps so they do not become blocks
- outside-to-inside transition detection
- default block selection
- donor entry proximity rule behaviour
- donor continuation without re-check
- output generation from mixed `base` / `donor` / `none` block selections
- exact timestamp deduplication

These should avoid DOM dependencies where possible.

### Manual Browser Tests

Recommended manual checks:

1. Upload multiple base and donor TCX files successfully.
2. Confirm block list is generated.
3. Confirm all three maps render.
4. Confirm the left and right columns split the page evenly.
5. Confirm the upload section is compact and does not dominate the left-column height.
6. Confirm block rows are compact and can stack densely.
7. Confirm summary stats appear for each input and the output.
8. Change blocks between `base`, `donor`, and `none` and confirm:
   - the selected square updates
   - the whole block row changes to the correct colour
   - output map updates
   - output summary updates
   - summary stats update
9. Confirm output-map segments use base colour, donor colour, and grey jump segments as expected.
10. Confirm numbered block-start markers appear consistently across maps.
11. Download output multiple times without clearing state.
12. Refresh with a case where donor comes within radius later in time and confirm a block split occurs there.
13. Confirm uncovered timeline gaps between activities do not appear as selectable blocks.

## Delivery Order

Recommended implementation order:

1. Create the page shell and navigation link.
2. Reuse upload and parsing flow from existing TCX pages.
3. Implement pure block-construction helpers.
4. Implement default block-selection helpers.
5. Render the block list.
6. Implement compact block-row controls and row-colour behaviour.
7. Generate the output activity from current selections.
8. Add the three maps.
9. Add coloured output-map segments and numbered block markers.
10. Add summary stats table and output summary.
11. Add download flow.
12. Add tests and perform manual verification.
