(function (global) {
  "use strict";

  function createInitialState() {
    return {
      config: Object.assign({}, global.FillFromSurrogateBlocks.DEFAULT_CONFIG),
      baseInputs: [],
      donorInputs: [],
      blocks: [],
      outputActivity: null,
      maps: {
        base: null,
        donor: null,
        output: null,
        baseLayers: [],
        donorLayers: [],
        outputSegmentLayers: [],
        baseMarkerLayers: [],
        donorMarkerLayers: [],
        outputMarkerLayers: [],
      },
    };
  }

  function recalculateDerivedState(state) {
    const blocks = global.FillFromSurrogateBlocks.buildBlocks(
      state.baseInputs,
      state.donorInputs,
      state.config,
    );
    global.FillFromSurrogateBlocks.applyDefaultBlockSelections(
      blocks,
      state.baseInputs,
      state.config,
    );

    state.blocks = blocks;
    return recalculateOutputOnly(state);
  }

  function recalculateOutputOnly(state) {
    state.outputActivity = global.FillFromSurrogateOutput.buildOutputActivity(
      state.baseInputs,
      state.donorInputs,
      state.blocks,
    );
    for (const block of state.blocks) {
      if (block.currentSelection === "base") {
        block.selectedStartLocation = block.baseStartLocation;
      } else if (block.currentSelection === "donor") {
        block.selectedStartLocation = block.donorStartLocation;
      } else {
        block.selectedStartLocation = null;
      }
    }
    return state;
  }

  global.FillFromSurrogateState = {
    createInitialState,
    recalculateDerivedState,
    recalculateOutputOnly,
  };
})(globalThis);
