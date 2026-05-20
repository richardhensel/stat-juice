#!/usr/bin/env python3
"""Tests for combine_gpx.py."""

from __future__ import annotations

import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


GPX_NS = "http://www.topografix.com/GPX/1/1"
GPX = {"gpx": GPX_NS}

PROJECT_DIR = Path(__file__).resolve().parent
SCRIPT_PATH = PROJECT_DIR / "combine_gpx.py"


def make_gpx(track_name: str, points: list[dict[str, object]]) -> str:
    trkpts = []
    for point in points:
        extensions = point.get("extensions", "")
        trkpts.append(
            f"""
   <trkpt lat="{point['lat']}" lon="{point['lon']}">
    <ele>{point.get('ele', '10')}</ele>
    <time>{point['time']}</time>
{extensions}
   </trkpt>""".rstrip()
        )

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="{GPX_NS}" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" version="1.1" creator="test">
 <trk>
  <name>{track_name}</name>
  <type>cycling</type>
  <trkseg>
{chr(10).join(trkpts)}
  </trkseg>
 </trk>
</gpx>
"""


def output_trackpoint_times(path: Path) -> list[str]:
    root = ET.parse(path).getroot()
    return [trkpt.findtext("gpx:time", namespaces=GPX) for trkpt in root.findall(".//gpx:trkpt", GPX)]


def find_trackpoint(path: Path, timestamp: str) -> ET.Element:
    root = ET.parse(path).getroot()
    for trkpt in root.findall(".//gpx:trkpt", GPX):
        if trkpt.findtext("gpx:time", namespaces=GPX) == timestamp:
            return trkpt
    raise AssertionError(f"Trackpoint {timestamp} not found in {path}")


def descendant_local_names(element: ET.Element) -> set[str]:
    names: set[str] = set()
    for child in element.iter():
        if child is element:
            continue
        tag = child.tag
        if tag.startswith("{"):
            tag = tag.split("}", 1)[1]
        names.add(tag)
    return names


class CombineGpxTests(unittest.TestCase):
    maxDiff = None

    def run_script(
        self,
        *,
        base_points: list[dict[str, object]],
        donor_points: list[dict[str, object]],
        extra_args: list[str] | None = None,
    ) -> tuple[subprocess.CompletedProcess[str], Path]:
        tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(tmpdir.cleanup)

        tmp_path = Path(tmpdir.name)
        base_path = tmp_path / "base.gpx"
        donor_path = tmp_path / "donor.gpx"
        output_path = tmp_path / "combined.gpx"

        base_path.write_text(make_gpx("Base Ride", base_points), encoding="utf-8")
        donor_path.write_text(make_gpx("Donor Ride", donor_points), encoding="utf-8")

        cmd = [
            "python3",
            str(SCRIPT_PATH),
            "--base",
            str(base_path),
            "--donor",
            str(donor_path),
            "--output",
            str(output_path),
            "--gap-factor",
            "1",
            "--min-gap-seconds",
            "0.5",
            "--max-gap-seconds",
            "0.5",
        ]
        if extra_args:
            cmd.extend(extra_args)

        completed = subprocess.run(cmd, capture_output=True, text=True, check=False)
        self.assertEqual(
            completed.returncode,
            0,
            msg=f"combine_gpx.py failed\nstdout:\n{completed.stdout}\nstderr:\n{completed.stderr}",
        )
        self.assertTrue(output_path.exists())
        return completed, output_path

    @staticmethod
    def base_points() -> list[dict[str, object]]:
        return [
            {"lat": "0.0000000", "lon": "0.0000000", "time": "2026-01-01T00:00:00Z"},
            {"lat": "0.0000000", "lon": "0.0000000", "time": "2026-01-01T00:00:02Z"},
            {"lat": "0.0000000", "lon": "0.0000000", "time": "2026-01-01T00:00:20Z"},
            {"lat": "0.0000000", "lon": "0.0000000", "time": "2026-01-01T00:00:22Z"},
        ]

    @staticmethod
    def donor_points(lon: str) -> list[dict[str, object]]:
        donor_extensions = """
    <extensions>
     <power>250</power>
     <gpxtpx:TrackPointExtension>
      <gpxtpx:atemp>17</gpxtpx:atemp>
      <gpxtpx:hr>140</gpxtpx:hr>
      <gpxtpx:cad>90</gpxtpx:cad>
     </gpxtpx:TrackPointExtension>
    </extensions>"""
        return [
            {"lat": "0.0000000", "lon": lon, "time": "2026-01-01T00:00:10Z", "extensions": donor_extensions},
            {"lat": "0.0000000", "lon": lon, "time": "2026-01-01T00:00:11Z", "extensions": donor_extensions},
        ]

    def test_near_donor_block_is_selected_by_default(self) -> None:
        completed, output_path = self.run_script(
            base_points=self.base_points(),
            donor_points=self.donor_points("0.0000100"),
        )

        self.assertIn("Selected 6 trackpoint(s): 4 base, 2 donor", completed.stdout)
        self.assertIn("Donor proximity check: evaluated 1 donor block(s), skipped 0", completed.stdout)
        self.assertEqual(
            output_trackpoint_times(output_path),
            [
                "2026-01-01T00:00:00Z",
                "2026-01-01T00:00:02Z",
                "2026-01-01T00:00:10Z",
                "2026-01-01T00:00:11Z",
                "2026-01-01T00:00:20Z",
                "2026-01-01T00:00:22Z",
            ],
        )

        donor_point = find_trackpoint(output_path, "2026-01-01T00:00:10Z")
        donor_names = descendant_local_names(donor_point)
        self.assertIn("atemp", donor_names)
        self.assertNotIn("power", donor_names)
        self.assertNotIn("hr", donor_names)
        self.assertNotIn("cad", donor_names)

    def test_far_donor_block_is_skipped_by_default(self) -> None:
        completed, output_path = self.run_script(
            base_points=self.base_points(),
            donor_points=self.donor_points("0.0010000"),
        )

        self.assertIn("Selected 4 trackpoint(s): 4 base, 0 donor", completed.stdout)
        self.assertIn("Donor proximity check: evaluated 1 donor block(s), skipped 1", completed.stdout)
        self.assertEqual(
            output_trackpoint_times(output_path),
            [
                "2026-01-01T00:00:00Z",
                "2026-01-01T00:00:02Z",
                "2026-01-01T00:00:20Z",
                "2026-01-01T00:00:22Z",
            ],
        )

    def test_far_donor_block_can_be_allowed_with_larger_radius(self) -> None:
        completed, output_path = self.run_script(
            base_points=self.base_points(),
            donor_points=self.donor_points("0.0010000"),
            extra_args=["--donor-switch-radius-metres", "200"],
        )

        self.assertIn("Selected 6 trackpoint(s): 4 base, 2 donor", completed.stdout)
        self.assertIn("Donor proximity check: evaluated 1 donor block(s), skipped 0", completed.stdout)
        self.assertIn("2026-01-01T00:00:10Z", output_trackpoint_times(output_path))

    def test_far_donor_block_can_bypass_proximity_check(self) -> None:
        completed, output_path = self.run_script(
            base_points=self.base_points(),
            donor_points=self.donor_points("0.0010000"),
            extra_args=["--no-donor-switch-proximity-check"],
        )

        self.assertIn("Selected 6 trackpoint(s): 4 base, 2 donor", completed.stdout)
        self.assertNotIn("Donor proximity check:", completed.stdout)
        self.assertIn("2026-01-01T00:00:10Z", output_trackpoint_times(output_path))


if __name__ == "__main__":
    unittest.main()
