# GPX Combiner Implementation Plan

## Overview

Implement a standalone Python 3 script named `combine_gpx.py` that combines multiple GPX files into one GPX output.

The script should use base GPX files as the authoritative source where they have coverage, and donor GPX files to fill periods where the base files lack coverage.

The script should use only the Python standard library.

Recommended modules:

```python
argparse
copy
datetime
statistics
xml.etree.ElementTree
```

The output should be a GPX 1.1 file with one track and one track segment containing the selected points in chronological order.

## Command-line Interface

Only the two input file groups should be required:

```bash
python3 combine_gpx.py \
  --base base1.gpx base2.gpx \
  --donor donor1.gpx donor2.gpx
```

All other arguments should have defaults.

Recommended arguments:

```python
parser.add_argument(
    "--base",
    nargs="+",
    required=True,
    help="One or more base GPX files",
)

parser.add_argument(
    "--donor",
    nargs="+",
    required=True,
    help="One or more donor GPX files",
)

parser.add_argument(
    "--output",
    default="combined.gpx",
    help="Output GPX file path; default: combined.gpx",
)

parser.add_argument(
    "--gap-factor",
    type=float,
    default=3.0,
    help="Coverage threshold multiplier; default: 3.0",
)

parser.add_argument(
    "--min-gap-seconds",
    type=float,
    default=5.0,
    help="Minimum coverage threshold; default: 5 seconds",
)

parser.add_argument(
    "--max-gap-seconds",
    type=float,
    default=30.0,
    help="Maximum coverage threshold; default: 30 seconds",
)

parser.add_argument(
    "--output-name",
    default="Combined GPX",
    help="Track name for output GPX; default: Combined GPX",
)

parser.add_argument(
    "--start-bound-source",
    choices=["base", "donor", "any"],
    default="base",
    help="Source used to determine output start time; default: base",
)

parser.add_argument(
    "--end-bound-source",
    choices=["base", "donor", "any"],
    default="base",
    help="Source used to determine output end time; default: base",
)

parser.add_argument(
    "--donor-metadata",
    choices=["safe", "position-only", "preserve"],
    default="safe",
    help=(
        "How to write donor metadata. "
        "safe keeps lat/lon/time/ele/speed/temp; "
        "position-only keeps lat/lon/time; "
        "preserve copies donor points exactly. "
        "Default: safe"
    ),
)

parser.add_argument(
    "--donor-switch-radius-metres",
    type=float,
    default=10.0,
    help="Maximum distance from the last base point to enter a donor block; default: 10 metres",
)

parser.add_argument(
    "--no-donor-switch-proximity-check",
    action="store_true",
    help="Disable the donor block entry proximity check",
)
```

## Core Data Model

Represent each parsed GPX file as a structure containing:

```text
path
source kind: base or donor
priority based on command-line order
trackpoints
estimated interval
coverage threshold
coverage intervals
first track name, if present
first track type, if present
```

Represent each trackpoint as:

```text
time
source kind: base or donor
source file path
file priority
original XML element
```

The original XML element should be retained so that base points and preserved donor points can be copied exactly.

Represent each constructed merge block as:

```text
start time
end time
base coverage present: yes or no
donor coverage present: yes or no
base points inside the block
donor points inside the block
```

The merge decision should be made per block, not per point.

## XML Namespace Handling

The script should register the GPX and extension namespaces used in the output.

Useful constants:

```python
GPX_NS = "http://www.topografix.com/GPX/1/1"
GPXTPX_NS = "http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"
```

Register namespaces so the output uses conventional prefixes where possible:

```python
ET.register_namespace("", GPX_NS)
ET.register_namespace("gpxtpx", GPXTPX_NS)
ET.register_namespace("xsi", XSI_NS)
```

Use namespace-aware tag creation, for example:

```python
ET.Element(f"{{{GPX_NS}}}trkpt")
```

## Input Parsing

For each input file:

1. Parse XML using `xml.etree.ElementTree`.
2. Find all trackpoint elements using namespace-aware search.
3. Extract the timestamp from the child `<time>` element.
4. Parse timestamps as timezone-aware UTC datetimes.
5. Ignore trackpoints with missing or invalid timestamps, with a warning.
6. Preserve the original `<trkpt>` XML element.
7. Sort trackpoints chronologically.
8. Record the first available track name and track type.

The timestamp parser should support:

```text
2026-05-19T19:58:29Z
2026-05-19T19:58:29+10:00
```

Internally, all timestamps should be normalised to UTC.

## Determining Output Bounds

Implement a helper like:

```python
def determine_bound(bound_type, source, base_points, donor_points):
    if source == "base":
        points = base_points
    elif source == "donor":
        points = donor_points
    elif source == "any":
        points = base_points + donor_points
    else:
        raise ValueError("Invalid bound source")

    if not points:
        raise ValueError(
            f"{bound_type} bound source is {source}, "
            "but no timed trackpoints were found"
        )

    if bound_type == "start":
        return min(p.time for p in points)

    if bound_type == "end":
        return max(p.time for p in points)
```

Defaults:

```text
start bound source: base
end bound source: base
```

If the calculated start is later than the calculated end, the script should stop with a clear error.

## Estimating Coverage

For each parsed file, estimate the normal recording interval using the median gap between adjacent trackpoint timestamps.

Algorithm:

1. Sort trackpoints by time.
2. Calculate positive adjacent gaps.
3. Ignore very large gaps that likely represent pauses or recording dropouts.
4. Use the median of the remaining gaps.
5. If no useful gaps exist, fall back to the minimum gap setting.

Then calculate:

```text
coverage threshold = median interval × gap factor
```

Clamp this value between:

```text
min gap seconds
max gap seconds
```

Defaults:

```text
gap factor: 3.0
min gap seconds: 5
max gap seconds: 30
```

## Building Coverage Intervals

For each trackpoint at time `T`, create an interval:

```text
[T - threshold, T + threshold]
```

For each file:

1. Build intervals around all points.
2. Sort intervals by start time.
3. Merge overlapping or touching intervals.

Also create a merged base coverage interval list from all base files.

Also create a merged donor coverage interval list from all donor files.

## Interval Helpers

Implement helpers for:

- Merging intervals.
- Checking whether a timestamp is inside any interval.
- Subtracting one set of intervals from another.
- Clipping intervals to the output bounds.

These helpers should also support construction of shared merge blocks from base and donor coverage boundaries.

## Block Construction

Construct shared timeline blocks after coverage has been calculated.

Recommended algorithm:

1. Clip merged base coverage and merged donor coverage to the output bounds.
2. Collect every coverage start and end time from both source types.
3. Sort these boundary times.
4. Create contiguous blocks between each adjacent pair of boundary times.
5. For each block, record whether base coverage exists and whether donor coverage exists inside that block.
6. Assign trackpoints from each source into the blocks whose time ranges contain them.

This produces synchronised block boundaries for both source types:

- If either base or donor begins a gap in coverage, both are broken at that point.
- If either base or donor regains coverage, both are broken at that point.
- A block is later accepted or rejected as a whole.

## Proximity Helpers

Implement helpers for:

- Finding the most recent base trackpoint before a block.
- Finding the first donor trackpoint inside a donor block.
- Calculating great-circle distance between two latitude/longitude pairs in metres.

The standard library is sufficient here; a simple haversine implementation is adequate.

## Trackpoint Selection Algorithm

Recommended algorithm:

1. Parse base files.
2. Parse donor files.
3. Flatten all base points and donor points.
4. Ensure at least one base point exists.
5. Determine output start and end using configured bound sources.
6. Discard points outside the output bounds.
7. Estimate coverage threshold for each file.
8. Build coverage intervals for each file.
9. Merge all base coverage intervals into a single base coverage union.
10. Merge all donor coverage intervals into a single donor coverage union.
11. Build shared timeline blocks from base and donor coverage boundaries.
12. For each block:
    - If base coverage exists in the block, select base points from that block.
    - Otherwise, if donor coverage exists in the block, treat the donor points in that block as a candidate donor block.
    - If donor block entry proximity checking is enabled:
      compare the first donor point in the block against the most recent base point before the block.
    - If the donor block passes the proximity rule, select donor points from that block.
    - If the donor block fails the proximity rule, select nothing from that block.
13. Deduplicate selected points by exact timestamp.
14. Sort selected points by timestamp.
15. Write the output GPX.

Base points always beat donor points. Earlier files listed on the command line beat later files within the same source type.

Because blocks are synchronised across both coverage types, donor blocks are accepted or rejected as whole blocks rather than entered partially.

## Deduplication

Deduplicate exact timestamp matches.

Priority order:

1. Base before donor.
2. Earlier base file before later base file.
3. Earlier donor file before later donor file.

Conceptually:

```python
def point_priority(point):
    return (
        0 if point.source_kind == "base" else 1,
        point.file_priority,
    )
```

For each timestamp, keep the point with the lowest priority tuple.

Do not deduplicate merely-near timestamps in the first version.

## Donor Metadata Modes

### Preserve Mode

For donor points with `--donor-metadata preserve`, copy the original element exactly:

```python
copy.deepcopy(point.element)
```

### Position-only Mode

For donor points with `--donor-metadata position-only`, build a new trackpoint containing only:

- `lat`
- `lon`
- `time`

Example output:

```xml
<trkpt lat="-27.123456" lon="153.123456">
  <time>2026-05-19T20:01:32Z</time>
</trkpt>
```

### Safe Mode

Safe mode is the default.

For donor points with `--donor-metadata safe`, build a new trackpoint containing only:

- `lat`
- `lon`
- `ele`, where present.
- `time`.
- Recognised speed, where present.
- Recognised temperature, where present.

Safe mode should be allow-list based, not block-list based. Build a new XML element rather than copying the original and deleting fields.

Recognised temperature fields can include:

```text
atemp
temp
temperature
gpxtpx:atemp
```

Recognised speed fields can include:

```text
speed
gpxtpx:speed
gpxdata:speed
```

Remove all other donor metadata by default, including:

- Heart rate.
- Cadence.
- Power.
- Respiration.
- Calories.
- Unknown extensions.
- Sensor identifiers.
- Device-specific private data.

## Creating Output Trackpoints

When writing each selected point:

- If the point is from a base file, copy it exactly.
- If the point is from a donor file and donor metadata mode is `preserve`, copy it exactly.
- If the point is from a donor file and donor metadata mode is `position-only`, build a minimal new element.
- If the point is from a donor file and donor metadata mode is `safe`, build a new element containing only allowed fields.

Base points should always retain their original metadata.

## Output GPX Construction

Create a new GPX root:

```xml
<gpx creator="combine_gpx.py" version="1.1"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
```

Add metadata:

```xml
<metadata>
  <time>current UTC generation time</time>
</metadata>
```

Add one track:

```xml
<trk>
  <name>Combined GPX</name>
  <type>cycling</type>
  <trkseg>
    ...selected points...
  </trkseg>
</trk>
```

Track name:

```text
from --output-name, default "Combined GPX"
```

Track type:

```text
first base file's track type if present;
otherwise first donor file's track type if present;
otherwise omit
```

Use `ET.indent()` where available to produce readable XML.

## Main Pseudocode

```python
args = parse_args()

base_parsed = parse_files(args.base, source_kind="base")
donor_parsed = parse_files(args.donor, source_kind="donor")

base_points = flatten_points(base_parsed)
donor_points = flatten_points(donor_parsed)

if not base_points:
    error("No timed trackpoints found in base files")

if not donor_points:
    warn("No timed trackpoints found in donor files")

start = determine_bound(
    bound_type="start",
    source=args.start_bound_source,
    base_points=base_points,
    donor_points=donor_points,
)

end = determine_bound(
    bound_type="end",
    source=args.end_bound_source,
    base_points=base_points,
    donor_points=donor_points,
)

if start > end:
    error("Output start time is later than output end time")

for parsed_file in base_parsed + donor_parsed:
    parsed_file.points = [
        p for p in parsed_file.points
        if start <= p.time <= end
    ]

    parsed_file.expected_interval = estimate_expected_interval(
        parsed_file.points
    )

    parsed_file.coverage_threshold = calculate_threshold(
        parsed_file.expected_interval,
        gap_factor=args.gap_factor,
        min_gap_seconds=args.min_gap_seconds,
        max_gap_seconds=args.max_gap_seconds,
    )

    parsed_file.coverage_intervals = build_coverage_intervals(
        parsed_file.points,
        parsed_file.coverage_threshold,
    )

base_coverage = merge_intervals(
    intervals from all base files
)

donor_coverage = merge_intervals(
    intervals from all donor files
)

blocks = build_blocks(
    base_coverage=base_coverage,
    donor_coverage=donor_coverage,
    start=start,
    end=end,
)

assign_points_to_blocks(blocks, base_parsed, donor_parsed)

selected = []

for block in blocks:
    if block.has_base_coverage:
        selected.extend(block.base_points)
        continue

    if not block.has_donor_coverage:
        continue

    if not block.donor_points:
        continue

    if not args.no_donor_switch_proximity_check:
        last_base_point = find_last_base_point_before_block(
            block,
            base_parsed,
        )
        first_donor_point = block.donor_points[0]

        if last_base_point is not None:
            distance_metres = haversine_metres(
                last_base_point,
                first_donor_point,
            )
            if distance_metres > args.donor_switch_radius_metres:
                continue

    selected.extend(block.donor_points)

selected = dedupe_and_sort(selected)

write_gpx(
    selected,
    output_path=args.output,
    output_name=args.output_name,
    donor_metadata_mode=args.donor_metadata,
)
```

## Validation and Error Handling

The script should handle:

```text
No base points:
    error

No donor points:
    warning, unless donor is requested as a start or end bound source

Requested bound source has no points:
    error

Start bound later than end bound:
    error

Malformed XML:
    error with file path

Trackpoints with missing or invalid time:
    warning and skip point

Multiple tracks or segments:
    flatten into one chronological output segment

Duplicate timestamps:
    keep highest-priority point
```

## Recommended First Version Scope

The first version should implement:

- Standard library only.
- Required arguments: `--base` and `--donor` only.
- Default output path: `combined.gpx`.
- GPX 1.1 output.
- Flattened single output track segment.
- UTC timestamp parsing and normalisation.
- Configurable start and end bound sources.
- Default bounds from base files.
- Median-interval coverage estimation.
- Shared base and donor coverage unions.
- Synchronised block construction from all coverage boundary changes.
- Block-level selection rather than point-by-point donor filling.
- Base coverage suppressing donor blocks.
- Donor blocks filling base gaps only.
- Default-enabled donor block entry proximity checking.
- Configurable donor switch radius in metres.
- Command-line option to disable donor block proximity checking.
- Command-line order priority.
- Exact timestamp deduplication.
- Base points copied exactly.
- Donor safe metadata mode by default.
- Donor safe metadata keeping lat, lon, time, elevation, speed and temperature.
- Donor safe metadata removing heart rate, cadence, power and unknown/private extensions.
- Optional position-only donor mode.
- Optional full donor preserve mode.
