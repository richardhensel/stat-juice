# Fill From Surrogate Requirements

## Purpose

Create a StatJuice webpage that combines multiple TCX files from different sources into one output TCX file.

The page is intended to use one or more **base** TCX files as the primary data source, and one or more **donor** TCX files as surrogate data that can be used to fill portions of the output.

## Product Integration

This feature must be implemented as a webpage linked with the rest of the StatJuice features.

It should fit the same navigation style as the existing StatJuice pages such as `index.html`, `fill-gaps.html`, and `join.html`.

The page should be placed and linked so that users can discover it from the main StatJuice feature navigation.

## Implementation Constraints

- TCX parsing and TCX modification must be implemented in JavaScript.
- JavaScript logic should be added in new or existing files under the repo `scripts` folder.
- Existing TCX parsing utilities should be reused where practical.
- The feature should continue the current statically hosted webpage model used by the rest of StatJuice.
- The page should work fully client-side in the browser.

## Inputs

The webpage must support:

- Uploading one or more base TCX files
- Uploading one or more donor TCX files

The user must be presented with separate controls for:

- multiple base TCX files
- multiple donor TCX files

Files should be loaded using the existing TCX parsing scripts, with new JavaScript logic added for block construction, block selection, and output generation.

## Output

The feature must produce:

- one generated output TCX file
- human-readable on-page reporting of block construction and selection
- summary statistics for each input and for the proposed output

The user must be able to download the generated output TCX at any time.

Downloading must not clear the loaded files, block selections, maps, or current working state.

The user must be able to continue editing selections and download again as many times as they want.

## Block Construction

Block construction is a separate process from block selection.

The page must first determine the coverage structure across the loaded files, then construct blocks, and only after that apply default block-selection rules.

A file has coverage for a time period if one of its trackpoints is close enough to that time period.

The page should estimate the expected trackpoint interval for each file using the median interval between adjacent trackpoints.

A coverage threshold should then be calculated as:

```text
median interval × gap factor
```

With defaults:

```text
gap factor: 3.0
minimum coverage threshold: 5 seconds
maximum coverage threshold: 30 seconds
```

Each trackpoint should create a coverage interval around itself. These intervals should be merged to determine where each file has coverage.

Base coverage should then be treated as the merged union of all base-file coverage intervals.

Donor coverage should then be treated as the merged union of all donor-file coverage intervals.

Block construction should operate on timeline blocks rather than on individual trackpoints.

A block is a contiguous time range inside the overall loaded timeline during which:

- base coverage presence/absence does not change
- donor coverage presence/absence does not change
- the within-radius relationship between the latest known base position and the latest known donor position does not change

Blocks must be constructed as follows:

1. Determine the overall timeline covered by the loaded files.
2. Collect every point in time where either base coverage or donor coverage starts or ends.
3. Also identify any point in time where the relationship between the latest known base position and the latest known donor position transitions from outside the configured radius to inside the configured radius.
4. Split the timeline at each such point.
5. Discard any resulting contiguous time range for which neither base coverage nor donor coverage exists.
6. Treat each remaining contiguous time range as a block.

For this purpose:

- the latest known base position means the most recent base trackpoint at or before that time
- the latest known donor position means the most recent donor trackpoint at or before that time

This means:

- if either base or donor begins a gap in coverage, both are broken at that point
- if either base or donor regains coverage, both are broken at that point
- if the latest known base position and latest known donor position transition from outside the configured radius to inside the configured radius, both are broken at that point
- this split can occur even if base coverage is no longer current at that time, provided the donor passes a point where the latest known base and donor positions become within the configured radius
- a block must not be broken merely because donor crosses some earlier part of base's path if the latest known base position and latest known donor position at that time are not within the configured radius
- if neither base coverage nor donor coverage exists for a time period, that period must not produce a block at all
- blocks are therefore synchronised across both source types
- a block is the unit on which default selection and user override later operate

## Default Block Selection Rules

After blocks have been constructed, the page must determine a default selected source for each block.

These are default rules only.

For every block, the user must be able to choose one of:

- base
- donor
- none

This includes blocks where both base and donor are available.

The default selection may be overridden by the user in the interface.

The default proposed output must follow these rules:

1. For each block, if base coverage exists in that block, base data should be the default selected source for that block.
2. A donor block is only eligible by default if base coverage does not exist in that block.
3. When the donor block entry rule is enabled, a donor block may only be used by default if its selection would switch the output from base data to donor data and the first donor trackpoint in that block is within the configured radius of the most recent base trackpoint before that block in time.
4. The donor block entry rule is not required when continuing from one donor block into another donor block with no intervening selected base block.
5. If a donor block fails the donor block entry rule when switching from base to donor, that donor block must not be selected by default.
6. If a block has neither eligible base data nor eligible donor data, the default selection should be none.
7. Base files always have priority over donor files for default selection.
8. If multiple base files contribute trackpoints in the same block, earlier files listed by the user have priority for duplicate timestamps.
9. If multiple donor files contribute trackpoints in the same block, earlier files listed by the user have priority.
10. Exact duplicate timestamps should be deduplicated according to priority.

These default decisions must be reflected in the initial selected square state and initial block colouring for each block.

## Donor Block Entry Rules

Switching from base data to a donor block must support an additional proximity check.

By default, this check is enabled.

When enabled:

- a donor block may only be checked against this rule when its selection would switch the output from base data to donor data
- if the output is already continuing through donor blocks, this rule does not need to be re-applied for each subsequent donor block
- when the rule does apply, a donor block may only be used if its first donor trackpoint is within a configurable radius of the most recent base trackpoint before that donor block in time
- distance should be calculated from latitude/longitude in metres
- if the first donor trackpoint in a candidate donor block is outside this radius during a base-to-donor transition, that donor block must not be selected by default
- if there is no preceding base trackpoint to compare against, this proximity check should not block donor usage

Default:

```text
donor switch radius: 100 metres
donor switch proximity check: enabled
```

## User Experience

The page must be divided into two columns.

The column split must occur at the halfway point of the available page width.

Equal horizontal space must be allocated to:

- the block-selection column
- the maps and output-summary column

### Left Column

The left column must contain rows representing each constructed block.

This column must be separately scrollable if there are too many blocks to show on one page.

The file-input section in this column must also be laid out as flat and compact as possible so that it does not consume unnecessary vertical space before the block list.

The upload controls should therefore avoid tall card-style layouts where a flatter arrangement can present the same controls clearly.

The per-block summary must be laid out flat and compact so that many block rows can be stacked without consuming excessive vertical space.

Each block row should show only:

- block start time, expressed as elapsed time since the start of the first block
- block end time, expressed as elapsed time since the start of the first block
- total distance represented by that block

The row must not use a tall stacked summary layout for per-block metadata.

For every block, the user must be able to set the selected source to `base`, `donor`, or `none` as allowed by the available data for that block.

If both base and donor are available for a block, the user must be able to switch between `base`, `donor`, and `none`.

If only one of `base` or `donor` is available, the user must still be able to choose `none`.

Because blocks are not created for periods where neither input has coverage, the interface does not need to show rows for completely empty timeline gaps.

Availability and selection must be represented with the same UI control.

Each block row must show up to three small square options:

- one square for `base`
- one square for `donor`
- one square for `none`

These square options must follow these rules:

- only show a `base` square if base is available in that block
- only show a `donor` square if donor is available in that block
- always show the `none` square
- each square must be coloured to match its source option
- clicking a square must set the selection for that block to that option

The current block selection must be reflected in the colour of the whole block row:

- if `base` is selected, the whole block row uses the base colour
- if `donor` is selected, the whole block row uses the donor colour
- if `none` is selected, the whole block row uses a grey none colour

### Right Column

The right column must contain three maps:

1. top map: a plot of the base activities
2. middle map: a plot of the donor activities
3. bottom map: a plot of the proposed output given the current block selections

These maps should update as files are loaded and as block selections change.

The output map must reflect the selected source of each block through line colour.

For the output map:

- output segments sourced from base-selected blocks must use the base colour
- output segments sourced from donor-selected blocks must use the donor colour
- if there is a jump or gap between two selected blocks, the joining line must use the grey none colour

The maps must also show the start point of each block as a numbered marker.

These numbered start-point markers must follow these rules:

- each block start point should be shown as a dot containing that block's number
- the numbering must be consistent across all maps
- where a block has a plottable start location on a given map, that map should show the corresponding numbered marker
- the markers should help the user visually match the block list with the plotted activities and output

Below the three maps there must be a summary statistics table.

This table should present summary statistics for:

- each base input
- each donor input
- the current proposed output

The implementation should reuse the existing StatJuice script for generating summary statistics where practical.

These values must be derived from the currently selected blocks, including any blocks the user has set to `none`.

## Interaction Flow

The intended flow is:

1. the user uploads one or more base TCX files
2. the user uploads one or more donor TCX files
3. the page parses the files using the existing TCX parsing scripts
4. the page constructs blocks using new JavaScript block-building logic
5. the page determines a default selection for each block
6. the page renders the block list and the three maps
7. the user optionally changes the selected source for any block to `base`, `donor`, or `none` where allowed by the available data
8. the page updates the proposed output preview based on the current block selections
9. the user clicks download to generate and download the current output TCX
10. the user may continue editing selections and downloading again without resetting the page

## TCX Data Handling

The page must parse TCX trackpoints and preserve the fields needed for:

- timing
- position
- elevation
- standard activity structure
- selected output data streams

The first version should preserve base TCX trackpoints exactly where practical.

For donor TCX trackpoints, the implementation should support a safe-surrogate approach:

- route and timing information should be preserved
- personalised performance metrics such as heart rate, cadence, and power should be removable from donor-derived output where required by the product decision

The exact donor metadata retention policy should be documented in the implementation once the target TCX output structure is finalised.

## Download Behaviour

The page must present a visible download button.

When pressed, it must:

- generate an output TCX from the currently selected blocks
- trigger a browser download of that file

Downloading must not:

- clear uploaded files
- clear computed blocks
- clear current user selections
- reset the page state

## Testing Expectations

The implementation should be structured so that the core JavaScript logic for:

- TCX parsing helpers
- coverage calculation
- block construction
- default block selection
- output TCX generation

can be tested independently of the DOM where practical.
