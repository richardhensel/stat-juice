# GPX Combiner Requirements

## Purpose

Create a Python 3 script that combines multiple GPX files from different sources into one output GPX file.

The script is intended to use one or more **base** GPX files as the primary data source, and one or more **donor** GPX files to fill gaps where the base files do not have trackpoint coverage.

The output should use the same broad GPX format as the supplied sample file: GPX 1.1 with a single combined track and track segment.

## Inputs

The script must accept:

- One or more base GPX files.
- One or more donor GPX files.

Only these two input groups should be required command-line arguments.

Example minimal usage:

```bash
python3 combine_gpx.py \
  --base base1.gpx base2.gpx \
  --donor donor1.gpx donor2.gpx
```

## Output

The script must produce:

- One combined GPX file.
- Human-readable reporting describing what the script did.

The default output path should be:

```text
combined.gpx
```

The output should contain relevant metadata, including:

- GPX creator/version information.
- Generation time in metadata.
- A track name.
- A track type where one can reasonably be inferred from the input files.

## Reporting Requirements

The script must provide human-readable output describing the result of the merge process.

This reporting may be written to standard output.

At minimum, the script must report summary information for the final output:

- Output start time.
- Output end time.
- Output start location.
- Output end location.

Locations should be reported using latitude and longitude from the selected output trackpoints.

The script must also report information for each constructed block.

For each block, the script must report:

- Block start time.
- Block end time.
- Block start location, where one can be determined from trackpoints in or adjacent to that block.
- Block end location, where one can be determined from trackpoints in or adjacent to that block.
- Whether base data is available in that block.
- Whether donor data is available in that block.
- Which source was selected for that block: base, donor, or none.
- Why that source was selected.

If no source was selected for a block, the script must report why no source was chosen.

Examples of reasons include:

- Base coverage exists in the block, so base data was preferred.
- Donor data was used because base coverage was absent and donor data was eligible.
- Donor data was rejected because the donor block entry proximity rule failed.
- No source was selected because neither base nor donor data was available in the block.

## Output Time Bounds

The output must only include points within a configured start and end time.

By default:

- Output starts at the earliest timestamp found in the base files.
- Output ends at the latest timestamp found in the base files.

The script should also support configurable bound sources:

```text
base
 donor
 any
```

For example:

- `--start-bound-source base` means start at the earliest base point.
- `--start-bound-source donor` means start at the earliest donor point.
- `--start-bound-source any` means start at the earliest point from either source type.

Equivalent options should exist for the end bound.

Defaults:

```text
--start-bound-source base
--end-bound-source base
```

## Coverage Rules

A file has coverage for a time period if one of its trackpoints is close enough to that time period.

The script should estimate the expected trackpoint interval for each file, using the median interval between adjacent trackpoints.

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

## Block Construction

Merging should operate on timeline blocks rather than on individual trackpoints.

A block is a contiguous time range inside the configured output bounds during which:

- base coverage presence/absence does not change
- donor coverage presence/absence does not change
- the within-radius relationship between the latest known base position and the latest known donor position does not change

Blocks must be constructed as follows:

1. Clip all base and donor coverage intervals to the configured output time bounds.
2. Collect every point in time where either base coverage or donor coverage starts or ends.
3. Also identify any point in time where the relationship between the latest known base position and the latest known donor position transitions from outside the configured radius to inside the configured radius.
4. Split the timeline at each such point.
5. Treat each resulting contiguous time range as a block.

For this purpose:

- the latest known base position means the most recent base trackpoint at or before that time
- the latest known donor position means the most recent donor trackpoint at or before that time

This means:

- If either base or donor begins a gap in coverage, both are broken at that point.
- If either base or donor regains coverage, both are broken at that point.
- If the latest known base position and latest known donor position transition from outside the configured radius to inside the configured radius, both are broken at that point.
- This split can occur even if base coverage is no longer current at that time, provided the donor passes a point where the latest known base and donor positions become within the configured radius.
- A block must not be broken merely because donor crosses some earlier part of base's path if the latest known base position and latest known donor position at that time are not within the configured radius.
- Blocks are therefore synchronised across both source types.
- A block must be added all together or not at all according to the merge rules.

## Merge Rules

The combined output must follow these rules:

1. Include only trackpoints inside the configured output time bounds.
2. For each block, if base coverage exists in that block, use base data for that block.
3. A donor block is only eligible if base coverage does not exist in that block.
4. When the donor block entry rule is enabled, a donor block may only be used if its selection would switch the output from base data to donor data and the first donor trackpoint in that block is within the configured radius of the most recent base trackpoint before that block in time.
5. The donor block entry rule is not required when continuing from one donor block into another donor block with no intervening selected base block.
6. If a donor block fails the donor block entry rule when switching from base to donor, that donor block must be skipped entirely.
7. If a block has neither eligible base data nor eligible donor data, output no trackpoints for that block.
8. Base files always have priority over donor files.
9. If multiple base files contribute trackpoints in the same block, earlier files listed on the command line have priority for duplicate timestamps.
10. If multiple donor files contribute trackpoints in the same block, earlier files listed on the command line have priority.
11. Exact duplicate timestamps should be deduplicated according to priority.

These merge decisions must be reflected in the reporting output for each block.

## Donor Block Entry Rules

Switching from base data to a donor block must support an additional proximity check.

By default, this check is enabled.

When enabled:

- A donor block may only be checked against this rule when its selection would switch the output from base data to donor data.
- If the output is already continuing through donor blocks, this rule does not need to be re-applied for each subsequent donor block.
- When the rule does apply, a donor block may only be used if its first donor trackpoint is within a configurable radius of the most recent base trackpoint before that donor block in time.
- Distance should be calculated from latitude/longitude in metres.
- If the first donor trackpoint in a candidate donor block is outside this radius during a base-to-donor transition, that donor block must be skipped entirely.
- If there is no preceding base trackpoint to compare against, this proximity check should not block donor usage.

Default:

```text
donor switch radius: 100 metres
donor switch proximity check: enabled
```

The command line should allow:

- Configuring the donor switch radius in metres.
- Disabling this donor switch proximity check.

Example default:

```text
--donor-switch-radius-metres 100
```

## Donor Metadata Requirements

Donor metadata handling must be configurable.

Supported modes:

```text
safe
position-only
preserve
```

Default:

```text
--donor-metadata safe
```

### Safe Mode

By default, donor points should retain only useful non-personal route/environment data:

- Latitude.
- Longitude.
- Time.
- Elevation.
- Speed, where recognised.
- Temperature, where recognised.

The script should remove personal or sensitive performance data such as:

- Heart rate.
- Cadence.
- Power.
- Respiration.
- Calories.
- Unknown/private extension data.
- Device or sensor identifiers.


### Preserve Mode

Donor points should be copied exactly, including all original metadata and extensions.

## Base Metadata Requirements

Base trackpoints should be preserved exactly by default.

Base data is assumed to be the primary trusted source, so base output should retain all fields present in the original base files, including extensions.

## Implementation Constraints

- Use Python 3.
- Minimise dependencies.
- Prefer the Python standard library only.
- Flatten multiple tracks and segments into one chronological output track segment.
- Preserve valid GPX 1.1 output.
- Handle malformed or incomplete input with clear errors or warnings.
