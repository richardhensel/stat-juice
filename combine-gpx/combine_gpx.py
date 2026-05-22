#!/usr/bin/env python3
"""
Combine one or more base GPX files with one or more donor GPX files.

Default behaviour:
  * output starts at the earliest base trackpoint
  * output ends at the latest base trackpoint
  * base points are copied exactly
  * donor blocks fill only periods not covered by base points
  * donor block entry requires the first donor point to be near the last base
    point by default
  * donor points are written in "safe" mode by default:
      lat, lon, time, elevation, recognised speed, recognised temperature

Only --base and --donor are required. Everything else has defaults.

Example:
  python3 combine_gpx.py --base base.gpx --donor donor.gpx
"""

from __future__ import annotations

import argparse
from bisect import bisect_left
import copy
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from statistics import median
import xml.etree.ElementTree as ET


GPX_NS = "http://www.topografix.com/GPX/1/1"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"
GPXTPX_NS = "http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
GPXX_NS = "http://www.garmin.com/xmlschemas/GpxExtensions/v3"
GpxData_NS = "http://www.cluetrust.com/XML/GPXDATA/1/0"

ET.register_namespace("", GPX_NS)
ET.register_namespace("xsi", XSI_NS)
ET.register_namespace("gpxtpx", GPXTPX_NS)
ET.register_namespace("gpxx", GPXX_NS)
ET.register_namespace("gpxdata", GpxData_NS)


def qname(ns: str, name: str) -> str:
    return f"{{{ns}}}{name}"


def local_name(tag: str) -> str:
    if tag.startswith("{"):
        return tag.split("}", 1)[1]
    return tag


def parse_time(text: str) -> datetime:
    """Parse a GPX timestamp and normalise it to timezone-aware UTC."""
    if not text:
        raise ValueError("empty timestamp")

    value = text.strip()
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"

    # Python's fromisoformat handles offsets such as +10:00.
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        # GPX timestamps should normally be UTC or offset-bearing. Treat a naive
        # timestamp as UTC rather than local time to avoid machine-dependent output.
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def format_time(dt: datetime) -> str:
    """Format a UTC datetime as GPX-style ISO timestamp with Z."""
    dt = dt.astimezone(timezone.utc)
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def find_direct_child_by_local_name(element: ET.Element, name: str) -> ET.Element | None:
    for child in list(element):
        if local_name(child.tag) == name:
            return child
    return None


def find_first_descendant_by_local_names(
    element: ET.Element,
    names: set[str],
) -> ET.Element | None:
    for candidate in element.iter():
        if candidate is element:
            continue
        if local_name(candidate.tag).lower() in names:
            return candidate
    return None


@dataclass
class TrackPoint:
    time: datetime
    source_kind: str  # "base" or "donor"
    source_file: str
    file_priority: int
    element: ET.Element


@dataclass
class ParsedGpxFile:
    path: str
    source_kind: str
    priority: int
    points: list[TrackPoint] = field(default_factory=list)
    expected_interval_seconds: float = 0.0
    coverage_threshold_seconds: float = 0.0
    coverage_intervals: list[tuple[datetime, datetime]] = field(default_factory=list)
    track_type: str | None = None
    track_name: str | None = None


@dataclass
class MergeBlock:
    start: datetime
    end: datetime
    has_base_coverage: bool
    has_donor_coverage: bool
    base_points: list[TrackPoint] = field(default_factory=list)
    donor_points: list[TrackPoint] = field(default_factory=list)
    selected_source: str = "none"
    decision_reason: str = ""
    proximity_distance_metres: float | None = None


def parse_gpx_file(path: str, source_kind: str, priority: int) -> ParsedGpxFile:
    parsed = ParsedGpxFile(path=path, source_kind=source_kind, priority=priority)

    try:
        tree = ET.parse(path)
    except Exception as exc:
        raise SystemExit(f"Error: failed to parse {path!r}: {exc}") from exc

    root = tree.getroot()

    # Find first track name and type, namespace-agnostic.
    for trk in root.iter():
        if local_name(trk.tag) != "trk":
            continue
        name_el = find_direct_child_by_local_name(trk, "name")
        type_el = find_direct_child_by_local_name(trk, "type")
        if parsed.track_name is None and name_el is not None and name_el.text:
            parsed.track_name = name_el.text.strip()
        if parsed.track_type is None and type_el is not None and type_el.text:
            parsed.track_type = type_el.text.strip()
        break

    skipped_missing_time = 0
    skipped_bad_time = 0

    for trkpt in root.iter():
        if local_name(trkpt.tag) != "trkpt":
            continue

        time_el = find_direct_child_by_local_name(trkpt, "time")
        if time_el is None or not time_el.text:
            skipped_missing_time += 1
            continue

        try:
            t = parse_time(time_el.text)
        except Exception:
            skipped_bad_time += 1
            continue

        parsed.points.append(
            TrackPoint(
                time=t,
                source_kind=source_kind,
                source_file=path,
                file_priority=priority,
                element=trkpt,
            )
        )

    parsed.points.sort(key=lambda p: p.time)

    if skipped_missing_time:
        print(
            f"Warning: skipped {skipped_missing_time} trackpoint(s) with no time in {path}",
            file=sys.stderr,
        )
    if skipped_bad_time:
        print(
            f"Warning: skipped {skipped_bad_time} trackpoint(s) with invalid time in {path}",
            file=sys.stderr,
        )

    return parsed


def parse_files(paths: list[str], source_kind: str) -> list[ParsedGpxFile]:
    return [parse_gpx_file(path, source_kind, idx) for idx, path in enumerate(paths)]


def flatten_points(files: list[ParsedGpxFile]) -> list[TrackPoint]:
    return [point for parsed in files for point in parsed.points]


def determine_bound(
    bound_type: str,
    source: str,
    base_points: list[TrackPoint],
    donor_points: list[TrackPoint],
) -> datetime:
    if source == "base":
        points = base_points
    elif source == "donor":
        points = donor_points
    elif source == "any":
        points = base_points + donor_points
    else:
        raise ValueError(f"invalid bound source: {source}")

    if not points:
        raise SystemExit(
            f"Error: {bound_type} bound source is {source!r}, "
            "but no timed trackpoints were found for that source."
        )

    if bound_type == "start":
        return min(p.time for p in points)
    if bound_type == "end":
        return max(p.time for p in points)
    raise ValueError(f"invalid bound type: {bound_type}")


def estimate_expected_interval_seconds(points: list[TrackPoint]) -> float:
    if len(points) < 2:
        return 1.0

    intervals = []
    for a, b in zip(points, points[1:]):
        seconds = (b.time - a.time).total_seconds()
        # Ignore duplicated timestamps and large pauses/dropouts when estimating
        # normal recording frequency.
        if 0 < seconds <= 300:
            intervals.append(seconds)

    if not intervals:
        return 1.0

    return float(median(intervals))


def calculate_threshold_seconds(
    expected_interval_seconds: float,
    gap_factor: float,
    min_gap_seconds: float,
    max_gap_seconds: float,
) -> float:
    raw = expected_interval_seconds * gap_factor
    return max(min_gap_seconds, min(max_gap_seconds, raw))


def merge_intervals(
    intervals: list[tuple[datetime, datetime]],
) -> list[tuple[datetime, datetime]]:
    if not intervals:
        return []

    intervals = sorted(intervals, key=lambda x: x[0])
    merged: list[tuple[datetime, datetime]] = []

    cur_start, cur_end = intervals[0]
    for start, end in intervals[1:]:
        if start <= cur_end:
            if end > cur_end:
                cur_end = end
        else:
            merged.append((cur_start, cur_end))
            cur_start, cur_end = start, end

    merged.append((cur_start, cur_end))
    return merged


def build_coverage_intervals(
    points: list[TrackPoint],
    threshold_seconds: float,
) -> list[tuple[datetime, datetime]]:
    threshold = timedelta(seconds=threshold_seconds)
    return merge_intervals([(p.time - threshold, p.time + threshold) for p in points])


def clip_intervals(
    intervals: list[tuple[datetime, datetime]],
    start: datetime,
    end: datetime,
) -> list[tuple[datetime, datetime]]:
    clipped: list[tuple[datetime, datetime]] = []
    for interval_start, interval_end in intervals:
        new_start = max(interval_start, start)
        new_end = min(interval_end, end)
        if new_start <= new_end:
            clipped.append((new_start, new_end))
    return merge_intervals(clipped)


def inside_any(t: datetime, intervals: list[tuple[datetime, datetime]]) -> bool:
    # Linear scan is fine for modest GPX sizes. For very large files, this could
    # be swapped for bisect over interval starts.
    for start, end in intervals:
        if t < start:
            return False
        if start <= t <= end:
            return True
    return False


def block_probe_time(start: datetime, end: datetime) -> datetime:
    if start == end:
        return start
    return start + ((end - start) / 2)


def build_blocks(
    base_coverage: list[tuple[datetime, datetime]],
    donor_coverage: list[tuple[datetime, datetime]],
    base_points: list[TrackPoint],
    donor_points: list[TrackPoint],
    donor_switch_radius_metres: float,
    start: datetime,
    end: datetime,
) -> list[MergeBlock]:
    clipped_base = clip_intervals(base_coverage, start, end)
    clipped_donor = clip_intervals(donor_coverage, start, end)

    boundaries = {start, end}
    for interval_start, interval_end in clipped_base + clipped_donor:
        boundaries.add(interval_start)
        boundaries.add(interval_end)
    boundaries.update(
        collect_transition_boundary_times(
            base_points=base_points,
            donor_points=donor_points,
            donor_switch_radius_metres=donor_switch_radius_metres,
            start=start,
            end=end,
        )
    )

    sorted_boundaries = sorted(boundaries)
    if len(sorted_boundaries) == 1:
        probe = sorted_boundaries[0]
        return [
            MergeBlock(
                start=probe,
                end=probe,
                has_base_coverage=inside_any(probe, clipped_base),
                has_donor_coverage=inside_any(probe, clipped_donor),
            )
        ]

    blocks: list[MergeBlock] = []
    for block_start, block_end in zip(sorted_boundaries, sorted_boundaries[1:]):
        probe = block_probe_time(block_start, block_end)
        blocks.append(
            MergeBlock(
                start=block_start,
                end=block_end,
                has_base_coverage=inside_any(probe, clipped_base),
                has_donor_coverage=inside_any(probe, clipped_donor),
            )
        )

    return blocks


def point_sort_key(point: TrackPoint) -> tuple[datetime, int]:
    return (point.time, point.file_priority)


def block_contains_time(
    block: MergeBlock,
    t: datetime,
    *,
    is_last_block: bool,
) -> bool:
    if block.start == block.end:
        return t == block.start
    if is_last_block:
        return block.start <= t <= block.end
    return block.start <= t < block.end


def point_is_after_block(
    block: MergeBlock,
    t: datetime,
    *,
    is_last_block: bool,
) -> bool:
    if block.start == block.end:
        return t > block.end
    if is_last_block:
        return t > block.end
    return t >= block.end


def assign_points_to_blocks(
    blocks: list[MergeBlock],
    points: list[TrackPoint],
    destination_attr: str,
) -> None:
    if not blocks or not points:
        return

    sorted_points = sorted(points, key=point_sort_key)
    block_index = 0
    last_block_index = len(blocks) - 1

    for point in sorted_points:
        while block_index < len(blocks):
            block = blocks[block_index]
            is_last_block = block_index == last_block_index
            if point_is_after_block(block, point.time, is_last_block=is_last_block):
                block_index += 1
                continue
            if block_contains_time(block, point.time, is_last_block=is_last_block):
                getattr(block, destination_attr).append(point)
            break


def trkpt_lat_lon(point: TrackPoint) -> tuple[float, float]:
    lat_text = point.element.get("lat")
    lon_text = point.element.get("lon")
    if lat_text is None or lon_text is None:
        raise ValueError("trackpoint is missing lat/lon")
    return (float(lat_text), float(lon_text))


def haversine_metres(a: TrackPoint, b: TrackPoint) -> float:
    lat1, lon1 = trkpt_lat_lon(a)
    lat2, lon2 = trkpt_lat_lon(b)

    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    hav = sin(dlat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2) ** 2
    earth_radius_metres = 6_371_000.0
    return 2 * earth_radius_metres * asin(sqrt(hav))


def latest_positions_are_within_radius(
    base_point: TrackPoint | None,
    donor_point: TrackPoint | None,
    radius_metres: float,
) -> bool:
    if base_point is None or donor_point is None:
        return False

    try:
        distance_metres = haversine_metres(base_point, donor_point)
    except ValueError:
        return False
    return distance_metres <= radius_metres


def collect_transition_boundary_times(
    base_points: list[TrackPoint],
    donor_points: list[TrackPoint],
    donor_switch_radius_metres: float,
    start: datetime,
    end: datetime,
) -> set[datetime]:
    transition_times: set[datetime] = set()
    events = sorted(
        [point for point in base_points + donor_points if start <= point.time <= end],
        key=point_sort_key,
    )

    last_base_point = find_last_point_at_or_before_time(base_points, start)
    last_donor_point = find_last_point_at_or_before_time(donor_points, start)
    was_inside_radius = latest_positions_are_within_radius(
        last_base_point,
        last_donor_point,
        donor_switch_radius_metres,
    )

    for point in events:
        if point.source_kind == "base":
            last_base_point = point
        else:
            last_donor_point = point

        is_inside_radius = latest_positions_are_within_radius(
            last_base_point,
            last_donor_point,
            donor_switch_radius_metres,
        )
        if not was_inside_radius and is_inside_radius:
            transition_times.add(point.time)
        was_inside_radius = is_inside_radius

    return transition_times


def find_last_base_point_before_time(
    base_points: list[TrackPoint],
    block_start: datetime,
) -> TrackPoint | None:
    if not base_points:
        return None

    base_times = [point.time for point in base_points]
    idx = bisect_left(base_times, block_start) - 1
    if idx < 0:
        return None
    return base_points[idx]


def find_last_point_at_or_before_time(
    points: list[TrackPoint],
    t: datetime,
) -> TrackPoint | None:
    if not points:
        return None

    point_times = [point.time for point in points]
    idx = bisect_left(point_times, t)
    if idx < len(points) and points[idx].time == t:
        return points[idx]
    idx -= 1
    if idx < 0:
        return None
    return points[idx]


def find_first_point_at_or_after_time(
    points: list[TrackPoint],
    t: datetime,
) -> TrackPoint | None:
    if not points:
        return None

    point_times = [point.time for point in points]
    idx = bisect_left(point_times, t)
    if idx >= len(points):
        return None
    return points[idx]


def format_location(point: TrackPoint | None) -> str:
    if point is None:
        return "unknown"

    try:
        lat, lon = trkpt_lat_lon(point)
    except ValueError:
        return "unknown"
    return f"{lat:.7f}, {lon:.7f}"


def block_points_in_time_order(block: MergeBlock) -> list[TrackPoint]:
    return sorted(block.base_points + block.donor_points, key=point_sort_key)


def block_start_reference_point(
    block: MergeBlock,
    all_points: list[TrackPoint],
) -> TrackPoint | None:
    block_points = block_points_in_time_order(block)
    if block_points:
        return block_points[0]
    return find_last_point_at_or_before_time(all_points, block.start) or find_first_point_at_or_after_time(
        all_points,
        block.start,
    )


def block_end_reference_point(
    block: MergeBlock,
    all_points: list[TrackPoint],
) -> TrackPoint | None:
    block_points = block_points_in_time_order(block)
    if block_points:
        return block_points[-1]
    return find_first_point_at_or_after_time(all_points, block.end) or find_last_point_at_or_before_time(
        all_points,
        block.end,
    )


def report_output_summary(
    output_path: str,
    selected: list[TrackPoint],
    base_count: int,
    donor_count: int,
) -> None:
    print(f"Wrote {output_path}")
    print(f"Selected {len(selected)} trackpoint(s): {base_count} base, {donor_count} donor")
    if not selected:
        print("Output start: none")
        print("Output end: none")
        return

    start_point = selected[0]
    end_point = selected[-1]
    print(f"Output start: {format_time(start_point.time)} @ {format_location(start_point)}")
    print(f"Output end: {format_time(end_point.time)} @ {format_location(end_point)}")


def report_blocks(blocks: list[MergeBlock], all_points: list[TrackPoint]) -> None:
    for idx, block in enumerate(blocks, start=1):
        start_location = format_location(block_start_reference_point(block, all_points))
        end_location = format_location(block_end_reference_point(block, all_points))
        base_available = "yes" if block.has_base_coverage else "no"
        donor_available = "yes" if block.has_donor_coverage else "no"

        print(
            f"Block {idx}: {format_time(block.start)} to {format_time(block.end)}"
            f" | start {start_location}"
            f" | end {end_location}"
        )
        print(f"  Availability: base={base_available}, donor={donor_available}")
        print(f"  Chosen source: {block.selected_source}")
        print(f"  Reason: {block.decision_reason}")


def donor_transition_requires_proximity_check(last_selected_source: str | None) -> bool:
    return last_selected_source == "base"


def point_priority_tuple(point: TrackPoint) -> tuple[int, int]:
    source_rank = 0 if point.source_kind == "base" else 1
    return (source_rank, point.file_priority)


def dedupe_and_sort(points: list[TrackPoint]) -> list[TrackPoint]:
    best_by_time: dict[datetime, TrackPoint] = {}

    for point in points:
        existing = best_by_time.get(point.time)
        if existing is None or point_priority_tuple(point) < point_priority_tuple(existing):
            best_by_time[point.time] = point

    return sorted(best_by_time.values(), key=lambda p: p.time)


def clone_text_element(old: ET.Element, tag: str) -> ET.Element:
    new = ET.Element(tag)
    new.text = old.text
    return new


def make_position_only_donor_trkpt(point: TrackPoint) -> ET.Element:
    old = point.element
    new = ET.Element(qname(GPX_NS, "trkpt"))
    if old.get("lat") is not None:
        new.set("lat", old.get("lat"))
    if old.get("lon") is not None:
        new.set("lon", old.get("lon"))

    time_el = find_direct_child_by_local_name(old, "time")
    if time_el is not None:
        new_time = ET.SubElement(new, qname(GPX_NS, "time"))
        new_time.text = time_el.text

    return new


def make_safe_donor_trkpt(point: TrackPoint) -> ET.Element:
    old = point.element
    new = ET.Element(qname(GPX_NS, "trkpt"))
    if old.get("lat") is not None:
        new.set("lat", old.get("lat"))
    if old.get("lon") is not None:
        new.set("lon", old.get("lon"))

    ele_el = find_direct_child_by_local_name(old, "ele")
    if ele_el is not None and ele_el.text is not None:
        new_ele = ET.SubElement(new, qname(GPX_NS, "ele"))
        new_ele.text = ele_el.text

    time_el = find_direct_child_by_local_name(old, "time")
    if time_el is not None and time_el.text is not None:
        new_time = ET.SubElement(new, qname(GPX_NS, "time"))
        new_time.text = time_el.text

    # Allow-list only speed and temperature from extensions/direct custom fields.
    speed_el = find_first_descendant_by_local_names(old, {"speed"})
    temp_el = find_first_descendant_by_local_names(old, {"atemp", "temp", "temperature"})

    if (speed_el is not None and speed_el.text is not None) or (
        temp_el is not None and temp_el.text is not None
    ):
        extensions = ET.SubElement(new, qname(GPX_NS, "extensions"))

        if temp_el is not None and temp_el.text is not None:
            tpx = ET.SubElement(extensions, qname(GPXTPX_NS, "TrackPointExtension"))
            atemp = ET.SubElement(tpx, qname(GPXTPX_NS, "atemp"))
            atemp.text = temp_el.text

        if speed_el is not None and speed_el.text is not None:
            # GPX 1.1 has no standard trkpt speed element. Store recognised speed
            # in extensions under a simple gpxdata namespace.
            speed = ET.SubElement(extensions, qname(GpxData_NS, "speed"))
            speed.text = speed_el.text

    return new


def make_output_trkpt(point: TrackPoint, donor_metadata_mode: str) -> ET.Element:
    if point.source_kind == "base":
        return copy.deepcopy(point.element)

    if donor_metadata_mode == "preserve":
        return copy.deepcopy(point.element)
    if donor_metadata_mode == "position-only":
        return make_position_only_donor_trkpt(point)
    if donor_metadata_mode == "safe":
        return make_safe_donor_trkpt(point)

    raise ValueError(f"unknown donor metadata mode: {donor_metadata_mode}")


def first_track_type(base_files: list[ParsedGpxFile], donor_files: list[ParsedGpxFile]) -> str | None:
    for parsed in base_files + donor_files:
        if parsed.track_type:
            return parsed.track_type
    return None


def write_gpx(
    selected: list[TrackPoint],
    output_path: str,
    output_name: str,
    donor_metadata_mode: str,
    base_files: list[ParsedGpxFile],
    donor_files: list[ParsedGpxFile],
) -> None:
    root = ET.Element(
        qname(GPX_NS, "gpx"),
        {
            "creator": "combine_gpx.py",
            "version": "1.1",
            qname(XSI_NS, "schemaLocation"): (
                "http://www.topografix.com/GPX/1/1 "
                "http://www.topografix.com/GPX/1/1/gpx.xsd "
                "http://www.garmin.com/xmlschemas/GpxExtensions/v3 "
                "http://www.garmin.com/xmlschemas/GpxExtensionsv3.xsd "
                "http://www.garmin.com/xmlschemas/TrackPointExtension/v1 "
                "http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd"
            ),
        },
    )

    metadata = ET.SubElement(root, qname(GPX_NS, "metadata"))
    meta_time = ET.SubElement(metadata, qname(GPX_NS, "time"))
    meta_time.text = format_time(datetime.now(timezone.utc))

    trk = ET.SubElement(root, qname(GPX_NS, "trk"))
    name = ET.SubElement(trk, qname(GPX_NS, "name"))
    name.text = output_name

    track_type = first_track_type(base_files, donor_files)
    if track_type:
        type_el = ET.SubElement(trk, qname(GPX_NS, "type"))
        type_el.text = track_type

    trkseg = ET.SubElement(trk, qname(GPX_NS, "trkseg"))
    for point in selected:
        trkseg.append(make_output_trkpt(point, donor_metadata_mode))

    tree = ET.ElementTree(root)
    try:
        ET.indent(tree, space=" ")
    except AttributeError:
        pass

    tree.write(output_path, encoding="UTF-8", xml_declaration=True)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Combine base GPX files with donor GPX files, filling base gaps from donors."
    )
    parser.add_argument("--base", nargs="+", required=True, help="One or more base GPX files")
    parser.add_argument("--donor", nargs="+", required=True, help="One or more donor GPX files")
    parser.add_argument("--output", default="combined.gpx", help="Output GPX file path; default: combined.gpx")
    parser.add_argument("--gap-factor", type=float, default=3.0, help="Coverage threshold multiplier; default: 3.0")
    parser.add_argument("--min-gap-seconds", type=float, default=5.0, help="Minimum coverage threshold; default: 5 seconds")
    parser.add_argument("--max-gap-seconds", type=float, default=30.0, help="Maximum coverage threshold; default: 30 seconds")
    parser.add_argument("--output-name", default="Combined GPX", help="Track name for output GPX; default: Combined GPX")
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
            "How to write donor metadata. safe keeps lat/lon/time/ele/speed/temp; "
            "position-only keeps lat/lon/time; preserve copies donor points exactly. "
            "Default: safe"
        ),
    )
    parser.add_argument(
        "--donor-switch-radius-metres",
        type=float,
        default=100.0,
        help=(
            "Maximum distance from the most recent base point to enter a donor block; "
            "default: 100 metres"
        ),
    )
    parser.add_argument(
        "--no-donor-switch-proximity-check",
        action="store_true",
        help="Disable the donor block entry proximity check",
    )

    return parser.parse_args(argv)


def validate_args(args: argparse.Namespace) -> None:
    if args.gap_factor <= 0:
        raise SystemExit("Error: --gap-factor must be positive")
    if args.min_gap_seconds < 0:
        raise SystemExit("Error: --min-gap-seconds must be non-negative")
    if args.max_gap_seconds < args.min_gap_seconds:
        raise SystemExit("Error: --max-gap-seconds must be >= --min-gap-seconds")
    if args.donor_switch_radius_metres < 0:
        raise SystemExit("Error: --donor-switch-radius-metres must be non-negative")

    for path in args.base + args.donor:
        if not Path(path).is_file():
            raise SystemExit(f"Error: input file does not exist: {path}")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    validate_args(args)

    base_parsed = parse_files(args.base, source_kind="base")
    donor_parsed = parse_files(args.donor, source_kind="donor")

    base_points = flatten_points(base_parsed)
    donor_points = flatten_points(donor_parsed)
    all_base_points = sorted(base_points, key=point_sort_key)
    all_donor_points = sorted(donor_points, key=point_sort_key)

    if not base_points:
        raise SystemExit("Error: no timed trackpoints found in base files")
    if not donor_points:
        print("Warning: no timed trackpoints found in donor files", file=sys.stderr)

    start = determine_bound(
        "start",
        args.start_bound_source,
        base_points=base_points,
        donor_points=donor_points,
    )
    end = determine_bound(
        "end",
        args.end_bound_source,
        base_points=base_points,
        donor_points=donor_points,
    )

    if start > end:
        raise SystemExit(
            f"Error: output start time {format_time(start)} is later than output end time {format_time(end)}"
        )

    for parsed_file in base_parsed + donor_parsed:
        parsed_file.points = [p for p in parsed_file.points if start <= p.time <= end]
        parsed_file.expected_interval_seconds = estimate_expected_interval_seconds(parsed_file.points)
        parsed_file.coverage_threshold_seconds = calculate_threshold_seconds(
            parsed_file.expected_interval_seconds,
            gap_factor=args.gap_factor,
            min_gap_seconds=args.min_gap_seconds,
            max_gap_seconds=args.max_gap_seconds,
        )
        parsed_file.coverage_intervals = build_coverage_intervals(
            parsed_file.points,
            parsed_file.coverage_threshold_seconds,
        )

    base_coverage = merge_intervals(
        [interval for parsed in base_parsed for interval in parsed.coverage_intervals]
    )
    donor_coverage = merge_intervals(
        [interval for parsed in donor_parsed for interval in parsed.coverage_intervals]
    )

    blocks = build_blocks(
        base_coverage=base_coverage,
        donor_coverage=donor_coverage,
        base_points=all_base_points,
        donor_points=all_donor_points,
        donor_switch_radius_metres=args.donor_switch_radius_metres,
        start=start,
        end=end,
    )

    base_points = sorted(flatten_points(base_parsed), key=point_sort_key)
    donor_points = sorted(flatten_points(donor_parsed), key=point_sort_key)
    assign_points_to_blocks(blocks, base_points, "base_points")
    assign_points_to_blocks(blocks, donor_points, "donor_points")

    selected: list[TrackPoint] = []
    skipped_donor_blocks = 0
    proximity_checked_blocks = 0
    last_selected_source: str | None = None

    for block in blocks:
        if block.has_base_coverage:
            block.selected_source = "base"
            if block.base_points:
                block.decision_reason = "Base coverage exists in the block, so base data was preferred."
            else:
                block.decision_reason = (
                    "Base coverage exists in the block, so base data was preferred, "
                    "but no base trackpoints fall inside the block."
                )
            selected.extend(block.base_points)
            last_selected_source = "base"
            continue

        if not block.has_donor_coverage:
            block.selected_source = "none"
            block.decision_reason = (
                "No source was selected because neither base nor donor data was available in the block."
            )
            continue

        if not block.donor_points:
            block.selected_source = "none"
            block.decision_reason = (
                "No source was selected because donor coverage exists, but no donor trackpoints "
                "fall inside the block."
            )
            continue

        if (
            not args.no_donor_switch_proximity_check
            and donor_transition_requires_proximity_check(last_selected_source)
        ):
            proximity_checked_blocks += 1
            last_base_point = find_last_base_point_before_time(all_base_points, block.start)
            if last_base_point is not None:
                try:
                    distance_metres = haversine_metres(last_base_point, block.donor_points[0])
                    block.proximity_distance_metres = distance_metres
                except ValueError:
                    distance_metres = float("inf")
                    block.proximity_distance_metres = None

                if distance_metres > args.donor_switch_radius_metres:
                    skipped_donor_blocks += 1
                    block.selected_source = "none"
                    if block.proximity_distance_metres is None:
                        block.decision_reason = (
                            "Donor data was rejected because the donor block entry proximity rule "
                            "could not determine a valid distance."
                        )
                    else:
                        block.decision_reason = (
                            "Donor data was rejected because the donor block entry proximity rule "
                            f"failed ({block.proximity_distance_metres:.1f} m > "
                            f"{args.donor_switch_radius_metres:.1f} m)."
                        )
                    continue
                block.selected_source = "donor"
                block.decision_reason = (
                    "Donor data was used because base coverage was absent and the base-to-donor "
                    f"transition passed the proximity check ({distance_metres:.1f} m <= "
                    f"{args.donor_switch_radius_metres:.1f} m)."
                )
            else:
                block.selected_source = "donor"
                block.decision_reason = (
                    "Donor data was used because base coverage was absent and no preceding base "
                    "trackpoint existed, so the proximity check did not block donor usage."
                )
        elif not args.no_donor_switch_proximity_check and last_selected_source == "donor":
            block.selected_source = "donor"
            block.decision_reason = (
                "Donor data was used because base coverage was absent and the output was already "
                "continuing through donor blocks, so the proximity check was not re-applied."
            )
        else:
            block.selected_source = "donor"
            if args.no_donor_switch_proximity_check:
                block.decision_reason = (
                    "Donor data was used because base coverage was absent and the proximity check was disabled."
                )
            else:
                block.decision_reason = (
                    "Donor data was used because base coverage was absent and this block did not "
                    "represent a base-to-donor transition."
                )

        selected.extend(block.donor_points)
        last_selected_source = "donor"

    selected = dedupe_and_sort(selected)

    write_gpx(
        selected,
        output_path=args.output,
        output_name=args.output_name,
        donor_metadata_mode=args.donor_metadata,
        base_files=base_parsed,
        donor_files=donor_parsed,
    )

    base_count = sum(1 for p in selected if p.source_kind == "base")
    donor_count = sum(1 for p in selected if p.source_kind == "donor")

    report_output_summary(args.output, selected, base_count, donor_count)
    print(f"Output bounds: {format_time(start)} to {format_time(end)}")
    if not args.no_donor_switch_proximity_check:
        print(
            "Donor proximity check:"
            f" evaluated {proximity_checked_blocks} donor block(s),"
            f" skipped {skipped_donor_blocks}"
        )
    report_blocks(blocks, sorted(base_points + donor_points, key=point_sort_key))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
