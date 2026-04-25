const tcxStubCases = [
  "processTcxXml",
  "calculateSummaryStats",
  "appendActivitiesSimple",
  "createTcxFile",
];

describe("scripts/tcx_utils.js", () => {
  tcxStubCases.forEach((name) => {
    it(`stub for ${name}`, () => {
      expect(true).to.equal(true);
    });
  });
});
