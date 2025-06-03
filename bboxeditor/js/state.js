// All global state variables will be defined here and exported.
// Other modules will import these and can modify them.

export let jsonData = []; // Array of image data objects from JSON
export let availableImages = []; // Array of {name, dataUrl, naturalWidth, naturalHeight} from loaded image files
export let currentImageIndex = -1; // Index in jsonData for the currently displayed image (if JSON loaded)
export let currentImageObject = null; // The object from jsonData or a temporary one for the current image
export let originalImageWidth = 0;
export let originalImageHeight = 0;
export let zoomLevel = 1.0;

export let currentDrawShape = "quadrilateral"; // 'quadrilateral' or 'rectangle'
export let isDrawingMode = false;
export let newBoxPoints = []; // Array of {x, y} points for the new box being drawn
export let selectedDetectionIndex = -1;
export let isDraggingVertex = false;
export let draggedBoxIndex = -1;
export let draggedVertexOrder = -1;
// dragStartCoords was defined but not used much, can be omitted or added if needed for specific logic.

// We need functions to update some of these if we want to encapsulate,
// but for direct porting, direct export/import and modification is simpler.
// For example, to change currentDrawShape:
// import { currentDrawShape } from './state.js';
// currentDrawShape = 'newShape'; // This won't work for imported primitives.
// Instead, modules will import and reassign the 'let' variables.

// To allow other modules to modify these:
export function setJsonData(data) { jsonData = data; }
export function setAvailableImages(data) { availableImages = data; }
export function setCurrentImageIndex(index) { currentImageIndex = index; }
export function setCurrentImageObject(obj) { currentImageObject = obj; }
export function setOriginalImageDimensions(width, height) {
  originalImageWidth = width;
  originalImageHeight = height;
}
export function setZoomLevel(level) { zoomLevel = level; }
export function setCurrentDrawShape(shape) { currentDrawShape = shape; }
export function setIsDrawingMode(mode) { isDrawingMode = mode; }
export function setNewBoxPoints(points) { newBoxPoints = points; }
export function setSelectedDetectionIndex(index) { selectedDetectionIndex = index; }
export function setIsDraggingVertex(dragging) { isDraggingVertex = dragging; }
export function setDraggedBoxIndex(index) { draggedBoxIndex = index; }
export function setDraggedVertexOrder(order) { draggedVertexOrder = order; }