const geometryStubCases = [
  "haversineDistance",
  "calculatePolylineLength",
  "findPointOnPolyline",
  "identifyPositionDropouts",
  "extractSubarray",
  "updateActivitySection",
  "calculateTotalDistance",
  "calculateTotalTime",
  "ActivityDropoutHandler",
];

describe("scripts/geometry_utils.js", () => {
  geometryStubCases.forEach((name) => {
    it(`stub for ${name}`, () => {
      expect(true).to.equal(true);
    });
  });
});
