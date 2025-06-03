// --- Keyboard Shortcuts ---
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (isDrawingMode) {
      exitDrawMode(false);
      updateUIState();
    } else if (selectedDetectionIndex !== -1) {
      clearSelection();
      renderSvg();
      updateUIState();
    }
  }
  // Check if focus is NOT on textLabelInput before deleting
  if (
    (event.key === "Delete" || event.key === "Backspace") &&
    document.activeElement !== textLabelInput
  ) {
    if (selectedDetectionIndex !== -1) {
      deleteSelectedBox();
    }
  }
});


function handleLabelInputKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    updateSelectedBoxLabel(); // Save current label

    if (
      selectedDetectionIndex !== -1 &&
      currentImageObject &&
      currentImageObject.detections &&
      currentImageObject.detections.length > 0
    ) {
      const numDetections = currentImageObject.detections.length;
      let nextBoxIndex = (selectedDetectionIndex + 1) % numDetections;
      selectBox(nextBoxIndex); // selectBox will focus the input
      // textLabelInput.select(); // Optional: auto-select text
    }
  }
}
