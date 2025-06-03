// --- Save Data ---
function downloadJsonData() {
  let dataToSave = [];
  if (jsonData.length > 0) {
    // Ensure currentImageObject's state is reflected in jsonData if it's from there
    if (
      currentImageObject &&
      currentImageIndex !== -1 &&
      jsonData[currentImageIndex]
    ) {
      jsonData[currentImageIndex] = JSON.parse(
        JSON.stringify(currentImageObject)
      ); // Deep copy to be safe
    }
    dataToSave = jsonData;
  } else if (
    currentImageObject &&
    currentImageObject.detections &&
    currentImageObject.detections.length > 0
  ) {
    // No initial JSON, but annotations made on a loaded image
    dataToSave = [JSON.parse(JSON.stringify(currentImageObject))];
  } else {
    showMessage(
      "Save JSON",
      "No data to save. Load JSON or annotate an image."
    );
    return;
  }

  if (dataToSave.length === 0) {
    // Should be caught by above, but as a safeguard
    showMessage("Save JSON", "No annotations to save.");
    return;
  }

  const jsonString = JSON.stringify(dataToSave, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Try to use current image filename for default, or a generic one
  let defaultFilename = "annotations.json";
  if (currentImageObject && currentImageObject.image_filename) {
    defaultFilename =
      currentImageObject.image_filename.split(".").slice(0, -1).join(".") +
      "_annotations.json";
  } else if (jsonData.length > 0 && jsonData[0] && jsonData[0].image_filename) {
    defaultFilename =
      jsonData[0].image_filename.split(".").slice(0, -1).join(".") +
      "_annotations.json";
  }

  const userFilename = prompt("Enter filename for JSON:", defaultFilename);
  if (userFilename === null) {
    // User cancelled prompt
    URL.revokeObjectURL(url);
    return;
  }
  a.download = userFilename || defaultFilename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showMessage("JSON Saved", `Data saved to ${a.download}`);
}
