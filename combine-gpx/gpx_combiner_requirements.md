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

The default output path should be:

```text
combined.gpx
```

The output should contain relevant metadata, including:

- GPX creator/version information.
- Generation time in metadata.
- A track name.
- A track type where one can reasonably be inferred from the input files.

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

A block is a contiguous time range inside the configured output bounds during which base coverage presence/absence and donor coverage presence/absence do not change.

Blocks must be constructed as follows:

1. Clip all base and donor coverage intervals to the configured output time bounds.
2. Collect every point in time where either base coverage or donor coverage starts or ends.
3. Split the timeline at each such point.
4. Treat each resulting contiguous time range as a block.

This means:

- If either base or donor begins a gap in coverage, both are broken at that point.
- If either base or donor regains coverage, both are broken at that point.
- Blocks are therefore synchronised across both source types.
- A block must be added all together or not at all according to the merge rules.

## Merge Rules

The combined output must follow these rules:

1. Include only trackpoints inside the configured output time bounds.
2. For each block, if base coverage exists in that block, use base data for that block.
3. A donor block is only eligible if base coverage does not exist in that block.
4. When the donor block entry rule is enabled, a donor block may only be used if the first donor trackpoint in that block is within the configured radius of the most recent base trackpoint before that block in time.
5. If a donor block fails the donor block entry rule, that donor block must be skipped entirely.
6. If a block has neither eligible base data nor eligible donor data, output no trackpoints for that block.
7. Base files always have priority over donor files.
8. If multiple base files contribute trackpoints in the same block, earlier files listed on the command line have priority for duplicate timestamps.
9. If multiple donor files contribute trackpoints in the same block, earlier files listed on the command line have priority.
10. Exact duplicate timestamps should be deduplicated according to priority.

## Donor Block Entry Rules

Switching from base data to a donor block must support an additional proximity check.

By default, this check is enabled.

When enabled:

- A donor block may only be used if its first donor trackpoint is within a configurable radius of the most recent base trackpoint before that donor block in time.
- Distance should be calculated from latitude/longitude in metres.
- If the first donor trackpoint in a candidate donor block is outside this radius, that donor block must be skipped entirely.
- If there is no preceding base trackpoint to compare against, this proximity check should not block donor usage.

Default:

```text
donor switch radius: 10 metres
donor switch proximity check: enabled
```

The command line should allow:

- Configuring the donor switch radius in metres.
- Disabling this donor switch proximity check.

Example default:

```text
--donor-switch-radius-metres 10
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

### Position-only Mode

Donor points should retain only:

- Latitude.
- Longitude.
- Time.

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
