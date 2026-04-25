mocha.run((failures) => {
  const statusElement = document.getElementById("status");
  const status = failures === 0 ? "PASS" : `FAIL:${failures}`;

  statusElement.textContent = status;
  document.body.setAttribute("data-test-status", status);
});
