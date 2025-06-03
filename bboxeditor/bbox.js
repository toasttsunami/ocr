function updateCoordinatesDisplay(boundingBox) {
  coordinatesDisplay.innerHTML = "";
  if (!boundingBox) return;
  boundingBox.forEach((point, i) => {
    const p = document.createElement("p");
    p.textContent = `P${i + 1}: (${Math.round(point[0])}, ${Math.round(
      point[1]
    )})`;
    coordinatesDisplay.appendChild(p);
  });
}

function deleteSelectedBox() {
  if (
    selectedDetectionIndex !== -1 &&
    currentImageObject &&
    currentImageObject.detections
  ) {
    currentImageObject.detections.splice(selectedDetectionIndex, 1);
    clearSelection();
    renderSvg();
    updateUIState();
  }
}

// --- Selection and Editing ---
function selectBox(index) {
  if (
    !currentImageObject ||
    !currentImageObject.detections ||
    index < 0 ||
    index >= currentImageObject.detections.length
  ) {
    clearSelection();
    return;
  }
  selectedDetectionIndex = index;
  const detection = currentImageObject.detections[index];
  textLabelInput.value = detection.text || "";
  confidenceDisplay.textContent =
    detection.confidence !== undefined
      ? detection.confidence.toFixed(2)
      : "N/A";
  updateCoordinatesDisplay(detection.bounding_box);
  selectionControls.classList.remove("hidden");
  renderSvg();
  textLabelInput.focus(); // Focus input on selection
}

function clearSelection() {
  selectedDetectionIndex = -1;
  textLabelInput.value = "";
  confidenceDisplay.textContent = "";
  coordinatesDisplay.innerHTML = "";
  selectionControls.classList.add("hidden");
}

function updateSelectedBoxLabel() {
  if (
    selectedDetectionIndex !== -1 &&
    currentImageObject &&
    currentImageObject.detections[selectedDetectionIndex]
  ) {
    currentImageObject.detections[selectedDetectionIndex].text =
      textLabelInput.value;
    renderSvg(); // Re-render to update text on SVG
  }
}
