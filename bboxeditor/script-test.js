// --- Global State Variables ---
let jsonData = []; // Array of image data objects from JSON
let availableImages = []; // Array of {name, dataUrl, naturalWidth, naturalHeight} from loaded image files
let currentImageIndex = -1; // Index in jsonData for the currently displayed image (if JSON loaded)
let currentImageObject = null; // The object from jsonData or a temporary one for the current image
let originalImageWidth = 0;
let originalImageHeight = 0;
let zoomLevel = 1.0;
const MIN_ZOOM = 0.1;
const MAX_ZOOM_FACTOR = 5.0; // Max zoom relative to original size
const ZOOM_STEP = 0.1;

let currentDrawShape = "quadrilateral"; // 'quadrilateral' or 'rectangle'
let isDrawingMode = false;
let newBoxPoints = []; // Array of {x, y} points for the new box being drawn
let selectedDetectionIndex = -1;
let isDraggingVertex = false;
let draggedBoxIndex = -1;
let draggedVertexOrder = -1;
let dragStartCoords = { x: 0, y: 0 };

// --- DOM Elements ---
let jsonFileInput,
  imageFileInput,
  imageDisplay,
  svgOverlay,
  imageNameDisplay,
  zoomInButton,
  zoomOutButton,
  zoomResetButton,
  zoomLevelDisplay,
  boxTypeSelect,
  drawModeButton,
  drawModeStatus,
  textLabelInput,
  confidenceDisplay,
  coordinatesDisplay,
  prevImageButton,
  nextImageButton,
  imageViewport,
  imageContainer,
  selectionControls,
  deleteBoxButton,
  saveJsonButton,
  messageModal,
  messageModalTitle,
  messageModalText,
  messageModalClose;

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  // Assign DOM elements
  jsonFileInput = document.getElementById("jsonFile");
  imageFileInput = document.getElementById("imageFile");
  imageDisplay = document.getElementById("imageDisplay");
  svgOverlay = document.getElementById("svgOverlay");
  imageNameDisplay = document.getElementById("imageNameDisplay");
  zoomInButton = document.getElementById("zoomInButton");
  zoomOutButton = document.getElementById("zoomOutButton");
  zoomResetButton = document.getElementById("zoomResetButton");
  zoomLevelDisplay = document.getElementById("zoomLevelDisplay");
  boxTypeSelect = document.getElementById("boxTypeSelect");
  drawModeButton = document.getElementById("drawModeButton");
  drawModeStatus = document.getElementById("drawModeStatus");
  textLabelInput = document.getElementById("textLabelInput");
  confidenceDisplay = document.getElementById("confidenceDisplay");
  coordinatesDisplay = document.getElementById("coordinatesDisplay");
  prevImageButton = document.getElementById("prevImageButton");
  nextImageButton = document.getElementById("nextImageButton");
  imageViewport = document.getElementById("imageViewport");
  imageContainer = document.getElementById("imageContainer");
  selectionControls = document.getElementById("selectionControls");
  deleteBoxButton = document.getElementById("deleteBoxButton");
  saveJsonButton = document.getElementById("saveJsonButton");
  messageModal = document.getElementById("messageModal");
  messageModalTitle = document.getElementById("messageModalTitle");
  messageModalText = document.getElementById("messageModalText");
  messageModalClose = document.getElementById("messageModalClose");

  // Attach event listeners
  jsonFileInput.addEventListener("change", handleJsonUpload);
  imageFileInput.addEventListener("change", handleImageUpload);
  zoomInButton.addEventListener("click", () => applyZoom(true));
  zoomOutButton.addEventListener("click", () => applyZoom(false));
  zoomResetButton.addEventListener("click", resetZoom);

  boxTypeSelect.addEventListener("change", (e) => {
    currentDrawShape = e.target.value;
    newBoxPoints = []; // Reset points if shape type changes during drawing
    if (isDrawingMode) renderSvg(); // Update visual cues if already in drawing mode
    updateDrawModeStatusText();
  });
  drawModeButton.addEventListener("click", toggleDrawMode);

  svgOverlay.addEventListener("click", handleSvgClick);
  svgOverlay.addEventListener("mousemove", handleSvgMouseMove);
  svgOverlay.addEventListener("mousedown", handleSvgMouseDown);
  svgOverlay.addEventListener("mouseup", handleSvgMouseUp);
  svgOverlay.addEventListener("mouseleave", handleSvgMouseLeave);

  textLabelInput.addEventListener("keydown", handleLabelInputKeydown);
  prevImageButton.addEventListener("click", () => navigateJsonEntry(-1));
  nextImageButton.addEventListener("click", () => navigateJsonEntry(1));
  deleteBoxButton.addEventListener("click", deleteSelectedBox);
  saveJsonButton.addEventListener("click", downloadJsonData);

  messageModalClose.addEventListener("click", () =>
    messageModal.classList.add("hidden")
  );

  updateDrawModeStatusText(); // Initial status text update
  updateUIState();
  drawModeStatus.classList.add("hidden");
});

// --- Message Modal ---
function showMessage(title, text) {
  messageModalTitle.textContent = title;
  messageModalText.textContent = text;
  messageModal.classList.remove("hidden");
}

// --- File Handling ---
function handleJsonUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsedData = JSON.parse(e.target.result);
        if (Array.isArray(parsedData)) {
          jsonData = parsedData;
          currentImageIndex = -1; // Reset
          currentImageObject = null;
          if (jsonData.length > 0) {
            showMessage(
              "JSON Loaded",
              `JSON data loaded with ${jsonData.length} entries. Navigating to the first entry.`
            );
            navigateJsonEntry(0, true); // Attempt to load the first image from JSON
          } else {
            showMessage("JSON Loaded", "JSON data loaded, but it's empty.");
            resetImageDisplayToPlaceholder();
          }
          updateNavigationButtons();
        } else {
          showMessage("JSON Error", "Invalid JSON format. Expected an array.");
        }
      } catch (error) {
        showMessage("JSON Error", `Error parsing JSON file: ${error.message}`);
        console.error("Error parsing JSON:", error);
      }
      updateUIState();
    };
    reader.readAsText(file);
  }
}

function handleImageUpload(event) {
  const files = event.target.files;
  if (files.length === 0) return;

  availableImages = []; // Clear previous batch
  let promises = [];
  imageNameDisplay.textContent = "Loading images...";

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    promises.push(
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e_reader) => {
          const img = new Image();
          img.onload = () => {
            availableImages.push({
              name: file.name,
              dataUrl: e_reader.target.result,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
            });
            resolve();
          };
          img.onerror = () => {
            console.warn(`Could not get dimensions for image: ${file.name}`);
            // Still add it, but without dimensions initially, or handle error
            availableImages.push({
              name: file.name,
              dataUrl: e_reader.target.result,
              naturalWidth: 0, // Indicate failure or use a default
              naturalHeight: 0,
            });
            resolve(); // Resolve anyway so Promise.all completes
          };
          img.src = e_reader.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })
    );
  }

  Promise.all(promises)
    .then(() => {
      showMessage(
        "Images Loaded",
        `${availableImages.length} image(s) processed and stored.`
      );
      if (availableImages.length > 0) {
        if (currentImageIndex !== -1 && jsonData.length > 0) {
          // If JSON is loaded and an index is set, try to refresh that image
          displayImageFromSource(jsonData[currentImageIndex].image_filename);
        } else if (jsonData.length === 0) {
          // No JSON loaded, display the first image from the batch
          displayImageFromSource(availableImages[0].name, true);
        } else {
          // JSON loaded, but no specific image was active, or current image not in new batch
          imageNameDisplay.textContent =
            "Images loaded. Select from JSON or load JSON.";
          resetImageDisplayToPlaceholder(); // Or try to load jsonData[0] if it exists
        }
      } else {
        imageNameDisplay.textContent = "No images loaded or processed.";
      }
      updateUIState();
    })
    .catch((error) => {
      showMessage(
        "Image Loading Error",
        `Error processing image files: ${error.message}`
      );
      console.error("Error loading images:", error);
      imageNameDisplay.textContent = "Error loading images.";
    });
}

// Displays an image if its 'filename' is found in 'availableImages'
// if 'isNewImageNoJson' is true, it creates a temporary currentImageObject
function displayImageFromSource(filename, isNewImageNoJson = false) {
  const imageToDisplay = availableImages.find((img) => img.name === filename);

  if (imageToDisplay) {
    imageDisplay.src = imageToDisplay.dataUrl;
    imageDisplay.dataset.originalName = imageToDisplay.name; // For reference
    originalImageWidth = imageToDisplay.naturalWidth;
    originalImageHeight = imageToDisplay.naturalHeight;

    if (originalImageWidth === 0 && originalImageHeight === 0) {
      showMessage(
        "Image Error",
        `Image "${filename}" loaded but dimensions are zero. It might be corrupted or not a valid image.`
      );
      resetImageDisplayToPlaceholder();
      return;
    }

    imageContainer.style.width = `${originalImageWidth}px`;
    imageContainer.style.height = `${originalImageHeight}px`;
    svgOverlay.setAttribute(
      "viewBox",
      `0 0 ${originalImageWidth} ${originalImageHeight}`
    );
    svgOverlay.style.width = `${originalImageWidth}px`;
    svgOverlay.style.height = `${originalImageHeight}px`;

    resetZoom();

    if (isNewImageNoJson && jsonData.length === 0) {
      // Only if no JSON is active
      currentImageObject = {
        image_filename: filename,
        image_path: `local/${filename}`, // Placeholder path
        detections: [],
      };
      currentImageIndex = -1; // Explicitly not from jsonData
      imageNameDisplay.textContent = filename + " (New Annotation)";
    } else if (currentImageObject) {
      // Image corresponds to an existing currentImageObject from JSON
      imageNameDisplay.textContent = currentImageObject.image_filename;
    } else {
      // This case should ideally be handled by ensuring currentImageObject is set before calling
      imageNameDisplay.textContent = filename;
    }

    clearSelection();
    renderSvg();
  } else {
    // Image not found in availableImages
    resetImageDisplayToPlaceholder();
    imageNameDisplay.textContent = `Expected: ${filename} (Not in loaded batch)`;
    if (currentImageObject && currentImageObject.image_filename === filename) {
      // Keep currentImageObject but clear visual representation
      clearSvg();
    } else if (!isNewImageNoJson) {
      // If we were trying to load an image for a JSON entry and it's not available
      currentImageObject = null; // No valid image to annotate
    }
    showMessage(
      "Image Not Found",
      `Image "${filename}" is not in the currently loaded batch of images. Please load it.`
    );
  }
  updateUIState();
  updateNavigationButtons();
}

function resetImageDisplayToPlaceholder() {
  imageDisplay.src =
    "https://placehold.co/800x600/e2e8f0/94a3b8?text=Load+Image(s)";
  delete imageDisplay.dataset.originalName;
  imageNameDisplay.textContent = "No Image Loaded";
  originalImageWidth = 0;
  originalImageHeight = 0;
  imageContainer.style.width = `auto`;
  imageContainer.style.height = `auto`;
  svgOverlay.innerHTML = "";
  // currentImageObject might still be valid if JSON points to an unloaded image
  // but visual elements should be cleared
  clearSelection();
  updateUIState();
}

// --- Navigation (through jsonData entries) ---
function navigateJsonEntry(direction, absoluteIndex = false) {
  if (jsonData.length === 0) {
    showMessage("Navigation Error", "No JSON data loaded to navigate.");
    return;
  }
  let newIndex;
  if (absoluteIndex) {
    newIndex = direction; // direction is used as the target index
  } else {
    newIndex = currentImageIndex + direction;
  }

  if (newIndex >= 0 && newIndex < jsonData.length) {
    currentImageIndex = newIndex;
    currentImageObject = jsonData[currentImageIndex];
    displayImageFromSource(currentImageObject.image_filename); // This will handle rendering
  } else {
    // Index out of bounds, do nothing or show message
    if (newIndex < 0)
      showMessage("Navigation", "Already at the first image entry.");
    if (newIndex >= jsonData.length)
      showMessage("Navigation", "Already at the last image entry.");
  }
  updateNavigationButtons();
}

function updateNavigationButtons() {
  const canNavigate = jsonData.length > 0;
  prevImageButton.disabled = !canNavigate || currentImageIndex <= 0;
  nextImageButton.disabled =
    !canNavigate || currentImageIndex >= jsonData.length - 1;
}

// --- Zoom Functionality ---
function applyZoom(zoomIn) {
  if (!originalImageWidth || !originalImageHeight) return;

  if (zoomIn) {
    zoomLevel = Math.min(MAX_ZOOM_FACTOR, zoomLevel + ZOOM_STEP);
  } else {
    zoomLevel = Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP);
  }
  imageContainer.style.transform = `scale(${zoomLevel})`;
  zoomLevelDisplay.textContent = `Zoom: ${Math.round(zoomLevel * 100)}%`;
  renderSvg(); // Re-render to adjust handle sizes and text offsets if needed
}

function resetZoom() {
  if (!originalImageWidth || !originalImageHeight) {
    imageContainer.style.transform = `scale(1)`;
    zoomLevelDisplay.textContent = `Zoom: 100%`;
    zoomLevel = 1.0;
    return;
  }
  const viewportWidth = imageViewport.clientWidth;
  const viewportHeight = imageViewport.clientHeight;

  const scaleX = viewportWidth / originalImageWidth;
  const scaleY = viewportHeight / originalImageHeight;
  zoomLevel = Math.min(scaleX, scaleY, 1.0);
  if (zoomLevel < MIN_ZOOM) zoomLevel = MIN_ZOOM;

  imageContainer.style.transform = `scale(${zoomLevel})`;
  zoomLevelDisplay.textContent = `Zoom: ${Math.round(zoomLevel * 100)}%`;
  renderSvg(); // Re-render for handle sizes
}

// --- SVG Drawing and Interaction ---
function clearSvg() {
  svgOverlay.innerHTML = "";
}

function renderSvg() {
  clearSvg();
  if (
    !currentImageObject ||
    !currentImageObject.detections ||
    !originalImageWidth
  )
    return;

  currentImageObject.detections.forEach((detection, index) => {
    const polygon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon"
    );
    const pointsStr = detection.bounding_box
      .map((p) => `${p[0]},${p[1]}`)
      .join(" ");
    polygon.setAttribute("points", pointsStr);
    polygon.classList.add("bounding-box-polygon");
    if (index === selectedDetectionIndex) {
      polygon.classList.add("selected");
    }
    polygon.dataset.index = index;
    svgOverlay.appendChild(polygon);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const avgX = detection.bounding_box.reduce((sum, p) => sum + p[0], 0) / 4;
    const minY = Math.min(...detection.bounding_box.map((p) => p[1]));
    text.setAttribute("x", avgX);
    text.setAttribute("y", minY - 5 / zoomLevel); // Scaled offset

    text.textContent = detection.text || "No Label";
    text.classList.add("bounding-box-text");
    text.style.fontSize = `${10 / zoomLevel}px`; // Keep apparent size constant
    text.style.strokeWidth = `${2 / zoomLevel}px`;
    text.dataset.index = index;
    svgOverlay.appendChild(text);

    if (index === selectedDetectionIndex) {
      detection.bounding_box.forEach((point, vertexOrder) => {
        const circle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        circle.setAttribute("cx", point[0]);
        circle.setAttribute("cy", point[1]);
        circle.setAttribute("r", 5 / zoomLevel);
        circle.classList.add("vertex-handle");
        circle.dataset.boxIndex = index;
        circle.dataset.vertexOrder = vertexOrder;
        svgOverlay.appendChild(circle);
      });
    }
  });

  // Render temporary drawing elements (lines for quad, or first point for rect)
  if (isDrawingMode && newBoxPoints.length > 0) {
    if (currentDrawShape === "quadrilateral") {
      for (let i = 0; i < newBoxPoints.length - 1; i++) {
        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        line.setAttribute("x1", newBoxPoints[i].x);
        line.setAttribute("y1", newBoxPoints[i].y);
        line.setAttribute("x2", newBoxPoints[i + 1].x);
        line.setAttribute("y2", newBoxPoints[i + 1].y);
        line.classList.add("new-box-line");
        svgOverlay.appendChild(line);
      }
    } else if (currentDrawShape === "rectangle" && newBoxPoints.length === 1) {
      // Draw a marker for the first point of the rectangle
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      circle.setAttribute("cx", newBoxPoints[0].x);
      circle.setAttribute("cy", newBoxPoints[0].y);
      circle.setAttribute("r", 3 / zoomLevel);
      circle.classList.add("new-box-line"); // Use similar styling
      circle.style.fill = "rgba(0, 255, 0, 0.5)";
      svgOverlay.appendChild(circle);
    }
  }
}

function getMousePositionOnImage(event) {
  const svgRect = svgOverlay.getBoundingClientRect();
  const viewportX = event.clientX - svgRect.left;
  const viewportY = event.clientY - svgRect.top;
  const imageX = viewportX / zoomLevel;
  const imageY = viewportY / zoomLevel;

  return {
    x: Math.max(0, Math.min(imageX, originalImageWidth)),
    y: Math.max(0, Math.min(imageY, originalImageHeight)),
  }; // Clamp to image bounds
}

function handleSvgClick(event) {
  if (!currentImageObject || !originalImageWidth) return;

  const { x, y } = getMousePositionOnImage(event);

  if (isDrawingMode) {
    newBoxPoints.push({ x, y });
    if (currentDrawShape === "quadrilateral") {
      if (newBoxPoints.length === 4) {
        const newDetection = {
          bounding_box: newBoxPoints.map((p) => [
            Math.round(p.x),
            Math.round(p.y),
          ]),
          text: "New Label",
          confidence: 1.0,
        };
        if (!currentImageObject.detections) currentImageObject.detections = [];
        currentImageObject.detections.push(newDetection);
        selectedDetectionIndex = currentImageObject.detections.length - 1;
        exitDrawMode(true); // Exit and select new box
      }
    } else if (currentDrawShape === "rectangle") {
      if (newBoxPoints.length === 2) {
        const p1 = newBoxPoints[0];
        const p2 = newBoxPoints[1];
        const x1 = Math.min(p1.x, p2.x);
        const y1 = Math.min(p1.y, p2.y);
        const x2 = Math.max(p1.x, p2.x);
        const y2 = Math.max(p1.y, p2.y);
        const newDetection = {
          bounding_box: [
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2],
          ].map((p) => [Math.round(p[0]), Math.round(p[1])]),
          text: "New Label",
          confidence: 1.0,
        };
        if (!currentImageObject.detections) currentImageObject.detections = [];
        currentImageObject.detections.push(newDetection);
        selectedDetectionIndex = currentImageObject.detections.length - 1;
        exitDrawMode(true); // Exit and select new box
      }
    }
    renderSvg(); // Update visual feedback for points clicked
    updateUIState();
  } else {
    // Not drawing, try to select
    const target = event.target;
    if (target.classList.contains("bounding-box-polygon")) {
      selectBox(parseInt(target.dataset.index));
    } else if (!target.classList.contains("vertex-handle")) {
      // Avoid deselect if clicking handle
      clearSelection();
      renderSvg();
      updateUIState();
    }
  }
}

function handleSvgMouseDown(event) {
  if (isDrawingMode || !currentImageObject) return;
  const target = event.target;
  if (target.classList.contains("vertex-handle")) {
    isDraggingVertex = true;
    draggedBoxIndex = parseInt(target.dataset.boxIndex);
    draggedVertexOrder = parseInt(target.dataset.vertexOrder);
    // dragStartCoords are not strictly needed if we directly use mouse position
    svgOverlay.style.cursor = "grabbing";
    event.stopPropagation();
  }
}

function handleSvgMouseMove(event) {
  if (!currentImageObject || !originalImageWidth) return;
  const { x, y } = getMousePositionOnImage(event);

  // Clear previous temporary drawing elements (like line to cursor or rect preview)
  const tempElements = svgOverlay.querySelectorAll(".temp-draw-element");
  tempElements.forEach((el) => el.remove());

  if (isDraggingVertex && draggedBoxIndex !== -1 && draggedVertexOrder !== -1) {
    currentImageObject.detections[draggedBoxIndex].bounding_box[
      draggedVertexOrder
    ] = [Math.round(x), Math.round(y)];
    renderSvg();
    updateCoordinatesDisplay(
      currentImageObject.detections[draggedBoxIndex].bounding_box
    );
  } else if (isDrawingMode && newBoxPoints.length > 0) {
    if (currentDrawShape === "quadrilateral" && newBoxPoints.length < 4) {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      const lastPoint = newBoxPoints[newBoxPoints.length - 1];
      line.setAttribute("x1", lastPoint.x);
      line.setAttribute("y1", lastPoint.y);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
      line.classList.add("new-box-line", "temp-draw-element");
      svgOverlay.appendChild(line);
    } else if (currentDrawShape === "rectangle" && newBoxPoints.length === 1) {
      const p1 = newBoxPoints[0];
      const tempRect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );
      tempRect.setAttribute("x", Math.min(p1.x, x));
      tempRect.setAttribute("y", Math.min(p1.y, y));
      tempRect.setAttribute("width", Math.abs(x - p1.x));
      tempRect.setAttribute("height", Math.abs(y - p1.y));
      tempRect.classList.add("new-box-rect", "temp-draw-element"); // new-box-rect for specific styling if needed
      svgOverlay.appendChild(tempRect);
    }
  }
}

function handleSvgMouseUp(event) {
  if (isDraggingVertex) {
    isDraggingVertex = false;
    draggedBoxIndex = -1;
    draggedVertexOrder = -1;
    svgOverlay.style.cursor = isDrawingMode ? "copy" : "crosshair";
    renderSvg();
  }
}

function handleSvgMouseLeave(event) {
  if (isDraggingVertex) {
    // Commit change if dragging vertex and mouse leaves
    isDraggingVertex = false;
    draggedBoxIndex = -1;
    draggedVertexOrder = -1;
    svgOverlay.style.cursor = isDrawingMode ? "copy" : "crosshair";
    renderSvg();
  }
  // Clear temporary drawing elements on mouse leave
  const tempElements = svgOverlay.querySelectorAll(".temp-draw-element");
  tempElements.forEach((el) => el.remove());
}





// --- Drawing Mode ---
function updateDrawModeStatusText() {
  if (currentDrawShape === "quadrilateral") {
    drawModeStatus.textContent =
      "Click 4 points on the image to draw a quadrilateral box.";
  } else if (currentDrawShape === "rectangle") {
    drawModeStatus.textContent = "Click 2 points for rectangle corners.";
  }
}

function toggleDrawMode() {
  isDrawingMode = !isDrawingMode;
  if (isDrawingMode) {
    enterDrawMode();
  } else {
    exitDrawMode(false);
  }
  updateUIState();
}

function enterDrawMode() {
  isDrawingMode = true;
  newBoxPoints = [];
  clearSelection();
  renderSvg();
  drawModeButton.textContent = "Cancel Drawing (ESC)";
  drawModeButton.classList.replace("bg-green-500", "bg-yellow-500");
  drawModeButton.classList.replace("hover:bg-green-600", "hover:bg-yellow-600");
  drawModeStatus.classList.remove("hidden");
  updateDrawModeStatusText(); // Ensure correct text for current shape
  svgOverlay.style.cursor = "copy";
  document.body.style.cursor = "copy";
}

function exitDrawMode(boxJustCreatedAndSelected = false) {
  isDrawingMode = false;
  newBoxPoints = [];
  drawModeButton.textContent = "Start Drawing Box";
  drawModeButton.classList.replace("bg-yellow-500", "bg-green-500");
  drawModeButton.classList.replace("hover:bg-yellow-600", "hover:bg-green-600");
  drawModeStatus.classList.add("hidden");
  svgOverlay.style.cursor = "crosshair";
  document.body.style.cursor = "default";

  if (!boxJustCreatedAndSelected) {
    clearSelection(); // Don't clear if a new box was just made and selected
  }
  renderSvg(); // Clean up any drawing artifacts and re-render selection state
  updateUIState();
}

// --- UI State Management ---
function updateUIState() {
  const imageFileLoadedForDisplay = !!originalImageWidth; // True if an image is actually rendered
  const jsonLogicallyLoaded = jsonData.length > 0;
  const boxSelected = selectedDetectionIndex !== -1;

  zoomInButton.disabled = !imageFileLoadedForDisplay;
  zoomOutButton.disabled = !imageFileLoadedForDisplay;
  zoomResetButton.disabled = !imageFileLoadedForDisplay;

  // Draw mode can be enabled if an image is loaded and we have a currentImageObject to add detections to
  drawModeButton.disabled = !imageFileLoadedForDisplay || !currentImageObject;
  boxTypeSelect.disabled = isDrawingMode; // Don't change type mid-draw

  if (
    boxSelected &&
    currentImageObject &&
    currentImageObject.detections[selectedDetectionIndex]
  ) {
    selectionControls.classList.remove("hidden");
  } else {
    selectionControls.classList.add("hidden");
  }

  // Enable save if JSON was loaded OR if there's a current image object with annotations (even if no initial JSON)
  const hasAnnotationsToSave =
    currentImageObject &&
    currentImageObject.detections &&
    currentImageObject.detections.length > 0;
  saveJsonButton.disabled = !jsonLogicallyLoaded && !hasAnnotationsToSave;
}