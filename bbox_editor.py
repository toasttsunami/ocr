import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image, ImageTk, ImageDraw
import json
import os
import platform # For mouse wheel binding

class BoundingBoxEditor:
    def __init__(self, master):
        self.master = master
        master.title("Bounding Box and Text Editor with Zoom/Pan")

        self.json_data = None
        self.current_image_index = 0
        self.image_path_prefix = ""

        self.original_pil_image = None # Loaded from file, never changed by zoom
        self.display_pil_image = None  # original_pil_image scaled by zoom_level
        self.tk_image = None           # ImageTk object for canvas
        self.image_on_canvas_id = None # ID of the image item on canvas

        self.drawn_objects = []
        self.selected_detection_index = None
        self.selected_vertex_index = None
        self.is_dragging_vertex = False

        # Zoom and Pan state
        self.zoom_level = 1.0
        self.zoom_step = 1.1 # Zoom factor per step
        self.min_zoom = 0.1
        self.max_zoom = 5.0

        self.pan_button_pressed = False # For changing cursor during pan


        # --- UI Elements ---
        # Frame for Controls
        self.controls_frame = tk.Frame(master)
        self.controls_frame.pack(side=tk.TOP, fill=tk.X, pady=5)

        self.load_button = tk.Button(self.controls_frame, text="Load JSON", command=self.load_json_file)
        self.load_button.pack(side=tk.LEFT, padx=5)
        self.prev_button = tk.Button(self.controls_frame, text="<< Previous", command=self.prev_image, state=tk.DISABLED)
        self.prev_button.pack(side=tk.LEFT, padx=5)
        self.next_button = tk.Button(self.controls_frame, text="Next >>", command=self.next_image, state=tk.DISABLED)
        self.next_button.pack(side=tk.LEFT, padx=5)
        self.save_button = tk.Button(self.controls_frame, text="Save JSON", command=self.save_json_file, state=tk.DISABLED)
        self.save_button.pack(side=tk.LEFT, padx=5)
        self.reset_zoom_button = tk.Button(self.controls_frame, text="Reset View", command=self.reset_view, state=tk.DISABLED)
        self.reset_zoom_button.pack(side=tk.LEFT, padx=5)


        # Main PanedWindow for resizable layout
        self.paned_window = tk.PanedWindow(master, orient=tk.HORIZONTAL, sashrelief=tk.RAISED)
        self.paned_window.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Frame for Canvas and Scrollbars
        self.canvas_frame = tk.Frame(self.paned_window)
        self.paned_window.add(self.canvas_frame, stretch="always")

        self.vbar = tk.Scrollbar(self.canvas_frame, orient=tk.VERTICAL)
        self.hbar = tk.Scrollbar(self.canvas_frame, orient=tk.HORIZONTAL)
        self.vbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.hbar.pack(side=tk.BOTTOM, fill=tk.X)

        self.canvas = tk.Canvas(self.canvas_frame, bg="lightgray",
                                xscrollcommand=self.hbar.set,
                                yscrollcommand=self.vbar.set)
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self.hbar.config(command=self.canvas.xview)
        self.vbar.config(command=self.canvas.yview)

        # Frame for Editing Text
        self.edit_frame = tk.Frame(self.paned_window, width=250) # Give it an initial width
        self.edit_frame.pack_propagate(False)
        self.paned_window.add(self.edit_frame)
        self.paned_window.sash_place(0, 600, 0) # Initial sash position


        self.text_label = tk.Label(self.edit_frame, text="Predicted Text:")
        self.text_label.pack(pady=(10, 5), padx=5, anchor=tk.W)
        self.text_var = tk.StringVar()
        self.text_entry = tk.Entry(self.edit_frame, textvariable=self.text_var, width=35)
        self.text_entry.pack(fill=tk.X, padx=5)
        self.text_entry.bind("<KeyRelease>", self.update_detection_text)

        self.confidence_label = tk.Label(self.edit_frame, text="Confidence:")
        self.confidence_label.pack(pady=(10, 0), padx=5, anchor=tk.W)
        self.confidence_value_label = tk.Label(self.edit_frame, text="-")
        self.confidence_value_label.pack(padx=5, anchor=tk.W)

        self.filename_label = tk.Label(self.edit_frame, text="Image: -", wraplength=230, justify=tk.LEFT)
        self.filename_label.pack(pady=(20,0), padx=5, anchor=tk.W)

        self.zoom_label = tk.Label(self.edit_frame, text="Zoom: 100%")
        self.zoom_label.pack(pady=(10,0), padx=5, anchor=tk.W)


        self.status_bar = tk.Label(master, text="Load a JSON file to begin.", bd=1, relief=tk.SUNKEN, anchor=tk.W)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)

        # Event Bindings for Canvas
        self.canvas.bind("<ButtonPress-1>", self.on_canvas_press)
        self.canvas.bind("<B1-Motion>", self.on_canvas_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_canvas_release)

        # Panning with Middle Mouse Button
        self.canvas.bind("<ButtonPress-2>", self.on_middle_press) # Or ButtonPress-3 on some systems
        self.canvas.bind("<B2-Motion>", self.on_middle_motion)
        self.canvas.bind("<ButtonRelease-2>", self.on_middle_release)
        if platform.system() == "Darwin": # macOS might use Button-3 for middle if not configured
            self.canvas.bind("<ButtonPress-3>", self.on_middle_press)
            self.canvas.bind("<B3-Motion>", self.on_middle_motion)
            self.canvas.bind("<ButtonRelease-3>", self.on_middle_release)


        # Zooming with Mouse Wheel
        # Cross-platform mouse wheel binding
        if platform.system() == "Linux":
            self.canvas.bind("<Button-4>", lambda event: self.on_mouse_wheel(event, "up"))
            self.canvas.bind("<Button-5>", lambda event: self.on_mouse_wheel(event, "down"))
        else: # Windows, macOS
            self.canvas.bind("<MouseWheel>", self.on_mouse_wheel)


    def update_status(self, message):
        self.status_bar.config(text=message)

    def load_json_file(self):
        filepath = filedialog.askopenfilename(
            title="Open JSON File",
            filetypes=(("JSON files", "*.json"), ("All files", "*.*"))
        )
        if not filepath: return
        try:
            with open(filepath, 'r') as f: self.json_data = json.load(f)
            if not self.json_data or not isinstance(self.json_data, list):
                messagebox.showerror("Error", "Invalid JSON. Expected a list.")
                self.json_data = None; return

            if self.json_data and self.json_data[0].get("image_path"):
                first_image_path = self.json_data[0]["image_path"]
                if os.path.isabs(first_image_path): self.image_path_prefix = ""
                else: self.image_path_prefix = os.path.dirname(filepath) # Assume relative to JSON
            self.current_image_index = 0
            self.load_current_image_data()
            self.update_button_states()
            self.save_button.config(state=tk.NORMAL)
            self.reset_zoom_button.config(state=tk.NORMAL)
            self.update_status(f"Loaded {os.path.basename(filepath)}")
        except Exception as e:
            messagebox.showerror("Error Loading JSON", str(e)); self.json_data = None

    def get_image_path(self, image_entry):
        img_path = image_entry.get("image_path", image_entry.get("image_filename"))
        if not img_path: return None
        if os.path.isabs(img_path): return img_path
        # Try path relative to JSON file's directory
        json_relative_path = os.path.join(self.image_path_prefix, img_path)
        if os.path.exists(json_relative_path): return json_relative_path
        # Fallback: try to find 'custom_images' if it's in the path, and go from there
        # This part might need adjustment based on typical user structures
        if "custom_images" in img_path:
            parts = img_path.split("custom_images" + os.sep)
            if len(parts) > 1:
                sub_path = "custom_images" + os.sep + parts[1]
                # Search upwards from json_path_prefix for a directory containing sub_path's first component
                test_prefix = self.image_path_prefix
                for _ in range(3): # Check up to 3 levels up
                    potential_path = os.path.join(test_prefix, sub_path)
                    if os.path.exists(potential_path): return potential_path
                    test_prefix = os.path.dirname(test_prefix)
        return img_path # Return original if still not found, will likely fail open

    def load_current_image_data(self):
        if not self.json_data or not (0 <= self.current_image_index < len(self.json_data)):
            self.clear_canvas_completely(); self.filename_label.config(text="Image: -")
            self.update_status("No image data."); return

        image_entry = self.json_data[self.current_image_index]
        full_image_path = self.get_image_path(image_entry)

        if not full_image_path or not os.path.exists(full_image_path):
            messagebox.showerror("Error", f"Image not found: {full_image_path}")
            self.clear_canvas_completely()
            self.filename_label.config(text=f"Image: {image_entry.get('image_filename', 'N/A')} (Not Found)")
            self.update_status(f"Error: Image not found at '{full_image_path}'"); return

        try:
            self.original_pil_image = Image.open(full_image_path)
            self.filename_label.config(text=f"Image: {image_entry.get('image_filename', os.path.basename(full_image_path))}")
            self.reset_view() # This will call _update_display
            self.update_status(f"Displaying: {image_entry.get('image_filename', os.path.basename(full_image_path))} ({self.current_image_index + 1}/{len(self.json_data)})")
        except Exception as e:
            messagebox.showerror("Error Loading Image", f"Could not load {full_image_path}: {e}")
            self.clear_canvas_completely()
            self.filename_label.config(text=f"Image: {image_entry.get('image_filename', 'N/A')} (Error)")
            self.update_status(f"Error loading image: {e}")

    def reset_view(self):
        if not self.original_pil_image: return
        self.zoom_level = 1.0
        self._update_display_and_scroll(center_x_img=None, center_y_img=None) # None will center it
        # Center the view on the image if possible
        self.canvas.xview_moveto(0)
        self.canvas.yview_moveto(0)
        self.update_zoom_label()


    def _update_display_and_scroll(self, center_x_img=None, center_y_img=None):
        """
        Updates the displayed image based on zoom_level and attempts to keep
        center_x_img, center_y_img (original image coordinates) at the center of the canvas view.
        If center_x/y_img is None, it usually implies a reset or fresh load.
        """
        if not self.original_pil_image:
            self.clear_canvas_completely()
            return

        old_canvas_width = self.display_pil_image.width if self.display_pil_image else 0
        old_canvas_height = self.display_pil_image.height if self.display_pil_image else 0

        # 1. Calculate new scaled image dimensions
        new_w = int(self.original_pil_image.width * self.zoom_level)
        new_h = int(self.original_pil_image.height * self.zoom_level)

        # Prevent zero or negative dimensions if zooming out too much
        new_w = max(1, new_w)
        new_h = max(1, new_h)

        # 2. Resize image (use NEAREST for speed, LANCZOS for quality)
        # For very frequent zooming, this is the bottleneck.
        # More advanced techniques might involve tiling or GPU acceleration.
        self.display_pil_image = self.original_pil_image.resize((new_w, new_h), Image.Resampling.NEAREST)
        self.tk_image = ImageTk.PhotoImage(self.display_pil_image)

        # 3. Update or create the image on canvas
        if self.image_on_canvas_id:
            self.canvas.itemconfig(self.image_on_canvas_id, image=self.tk_image)
        else:
            self.image_on_canvas_id = self.canvas.create_image(0, 0, anchor=tk.NW, image=self.tk_image)

        # 4. Update scrollregion to match the new scaled image size
        self.canvas.config(scrollregion=(0, 0, new_w, new_h))

        # 5. Redraw detections
        self.draw_all_detections()
        self.update_edit_fields_for_selection() # Ensure selected text is correct

        # 6. Adjust scroll view to keep the target point centered (or at mouse for zoom)
        if center_x_img is not None and center_y_img is not None:
            # Target canvas coordinates for the image point
            target_canvas_x = center_x_img * self.zoom_level
            target_canvas_y = center_y_img * self.zoom_level

            # Get current canvas viewport width/height (approximate)
            view_w = self.canvas.winfo_width()
            view_h = self.canvas.winfo_height()

            # New top-left for the view
            new_view_x = target_canvas_x - (view_w / 2)
            new_view_y = target_canvas_y - (view_h / 2)

            # Convert to fractions for xview_moveto/yview_moveto
            if new_w > 0: self.canvas.xview_moveto(new_view_x / new_w)
            if new_h > 0: self.canvas.yview_moveto(new_view_y / new_h)

        self.update_zoom_label()


    def clear_canvas_completely(self):
        self.canvas.delete("all")
        self.original_pil_image = None
        self.display_pil_image = None
        self.tk_image = None
        self.image_on_canvas_id = None
        self.drawn_objects = []
        self.selected_detection_index = None
        self.selected_vertex_index = None
        self.text_var.set("")
        self.confidence_value_label.config(text="-")


    def draw_all_detections(self):
        # Clear previous detections drawings
        for item_id in self.drawn_objects:
            self.canvas.delete(item_id)
        self.drawn_objects = []

        if not self.original_pil_image or not self.json_data: return

        image_entry = self.json_data[self.current_image_index]
        detections = image_entry.get("detections", [])

        for i, det in enumerate(detections):
            # Original image coordinates
            original_bbox = det["bounding_box"]

            # Scale coordinates for display
            scaled_bbox_points = []
            for ox, oy in original_bbox:
                scaled_x = ox * self.zoom_level
                scaled_y = oy * self.zoom_level
                scaled_bbox_points.extend([scaled_x, scaled_y])

            color = "blue" if self.selected_detection_index == i else "red"
            fill_color = "yellow" if self.selected_detection_index == i else "green"
            vertex_radius = 4 # Fixed pixel radius for grab handles

            poly_id = self.canvas.create_polygon(scaled_bbox_points, outline=color, fill="", width=2, tags=(f"bbox_poly_{i}", "detection_item"))
            self.drawn_objects.append(poly_id)

            for j, (ox, oy) in enumerate(original_bbox):
                scaled_vx, scaled_vy = ox * self.zoom_level, oy * self.zoom_level
                v_id = self.canvas.create_oval(
                    scaled_vx - vertex_radius, scaled_vy - vertex_radius,
                    scaled_vx + vertex_radius, scaled_vy + vertex_radius,
                    fill=fill_color, outline=color, tags=(f"bbox_vertex_{i}_{j}", "detection_item")
                )
                self.drawn_objects.append(v_id)


    def on_canvas_press(self, event):
        self.is_dragging_vertex = False
        # Convert window coordinates to canvas scrollable area coordinates
        canvas_x = self.canvas.canvasx(event.x)
        canvas_y = self.canvas.canvasy(event.y)

        # Find clicked item
        # Increase tolerance slightly due to potential rounding with zoom
        items = self.canvas.find_overlapping(canvas_x - 5, canvas_y - 5, canvas_x + 5, canvas_y + 5)

        # Prioritize vertex selection
        for item_id in reversed(items): # Check topmost items first
            tags = self.canvas.gettags(item_id)
            for tag in tags:
                if tag.startswith("bbox_vertex_"):
                    parts = tag.split("_")
                    det_idx = int(parts[2])
                    vertex_idx = int(parts[3])

                    self.selected_detection_index = det_idx
                    self.selected_vertex_index = vertex_idx
                    self.is_dragging_vertex = True
                    self.update_edit_fields_for_selection()
                    self.draw_all_detections() # Redraw to highlight
                    self.update_status(f"Selected vertex {vertex_idx} of detection {det_idx}.")
                    return

        # If no vertex, check for polygon selection
        for item_id in reversed(items):
            tags = self.canvas.gettags(item_id)
            for tag in tags:
                if tag.startswith("bbox_poly_"):
                    det_idx = int(tag.split("_")[2])
                    self.selected_detection_index = det_idx
                    self.selected_vertex_index = None # No specific vertex
                    self.update_edit_fields_for_selection()
                    self.draw_all_detections() # Redraw to highlight
                    self.update_status(f"Selected detection {det_idx}.")
                    return

        # Deselect if clicked on empty space
        self.selected_detection_index = None
        self.selected_vertex_index = None
        self.update_edit_fields_for_selection()
        self.draw_all_detections() # Redraw to remove old highlight
        self.update_status("Canvas clicked. No detection selected.")


    def on_canvas_drag(self, event):
        if not self.is_dragging_vertex or self.selected_detection_index is None or \
           self.selected_vertex_index is None or not self.original_pil_image:
            return

        # Convert window coordinates to canvas scrollable area coordinates
        canvas_x = self.canvas.canvasx(event.x)
        canvas_y = self.canvas.canvasy(event.y)

        # Convert canvas/scaled coordinates back to original image coordinates
        original_img_x = canvas_x / self.zoom_level
        original_img_y = canvas_y / self.zoom_level

        # Clamp to original image boundaries
        img_w = self.original_pil_image.width
        img_h = self.original_pil_image.height
        original_img_x = max(0, min(original_img_x, img_w))
        original_img_y = max(0, min(original_img_y, img_h))

        # Update the original coordinate in json_data
        detection = self.json_data[self.current_image_index]["detections"][self.selected_detection_index]
        detection["bounding_box"][self.selected_vertex_index] = [original_img_x, original_img_y]

        self.draw_all_detections() # Redraw with new vertex position
        self.update_status(f"Dragging vertex to original: ({original_img_x:.1f}, {original_img_y:.1f})")


    def on_canvas_release(self, event):
        self.is_dragging_vertex = False
        if self.selected_detection_index is not None:
             self.update_status(f"Finished editing detection {self.selected_detection_index}.")


    def update_edit_fields_for_selection(self):
        if self.selected_detection_index is not None and self.json_data:
            try:
                image_entry = self.json_data[self.current_image_index]
                detection = image_entry["detections"][self.selected_detection_index]
                self.text_var.set(detection.get("text", ""))
                self.confidence_value_label.config(text=str(detection.get("confidence", "-")))
            except IndexError:
                 self.text_var.set("")
                 self.confidence_value_label.config(text="- (Error: Index out of bounds)")
                 self.selected_detection_index = None # Deselect if error
        else:
            self.text_var.set("")
            self.confidence_value_label.config(text="-")

    def update_detection_text(self, event=None):
        if self.selected_detection_index is not None and self.json_data:
            new_text = self.text_var.get()
            try:
                self.json_data[self.current_image_index]["detections"][self.selected_detection_index]["text"] = new_text
                self.update_status(f"Updated text for detection {self.selected_detection_index}.")
            except IndexError:
                self.update_status("Error: Could not update text for out-of-bounds detection.")


    def next_image(self):
        if self.json_data and self.current_image_index < len(self.json_data) - 1:
            self.current_image_index += 1
            self.load_current_image_data()
        self.update_button_states()

    def prev_image(self):
        if self.json_data and self.current_image_index > 0:
            self.current_image_index -= 1
            self.load_current_image_data()
        self.update_button_states()

    def update_button_states(self):
        if not self.json_data or not self.original_pil_image :
            self.prev_button.config(state=tk.DISABLED)
            self.next_button.config(state=tk.DISABLED)
            self.reset_zoom_button.config(state=tk.DISABLED)
            return

        self.prev_button.config(state=tk.NORMAL if self.current_image_index > 0 else tk.DISABLED)
        self.next_button.config(state=tk.NORMAL if self.current_image_index < len(self.json_data) - 1 else tk.DISABLED)
        self.reset_zoom_button.config(state=tk.NORMAL if self.original_pil_image else tk.DISABLED)

    def save_json_file(self):
        if not self.json_data: messagebox.showwarning("No Data", "No data to save."); return
        filepath = filedialog.asksaveasfilename(defaultextension=".json", filetypes=(("JSON files", "*.json"), ("All files", "*.*")), title="Save JSON As")
        if not filepath: return
        try:
            with open(filepath, 'w') as f: json.dump(self.json_data, f, indent=4)
            messagebox.showinfo("Success", f"Data saved to {filepath}")
            self.update_status(f"Saved data to {os.path.basename(filepath)}.")
        except Exception as e: messagebox.showerror("Error Saving JSON", str(e))

    # --- Zoom and Pan Methods ---
    def on_mouse_wheel(self, event, direction=None):
        if not self.original_pil_image: return

        # Determine zoom direction
        if platform.system() == "Linux": # For Button-4 and Button-5 events
            delta = 1 if direction == "up" else -1
        elif platform.system() == "Darwin": # macOS
             delta = event.delta
        else: # Windows
            delta = event.delta / 120 # Usually 120 per tick

        # Mouse position on canvas (scrollable area)
        canvas_x = self.canvas.canvasx(event.x)
        canvas_y = self.canvas.canvasy(event.y)

        # Corresponding point in original image coordinates
        img_x_at_cursor = canvas_x / self.zoom_level
        img_y_at_cursor = canvas_y / self.zoom_level

        # Calculate new zoom level
        if delta > 0: # Zoom in
            new_zoom_level = self.zoom_level * self.zoom_step
        else: # Zoom out
            new_zoom_level = self.zoom_level / self.zoom_step

        self.zoom_level = max(self.min_zoom, min(new_zoom_level, self.max_zoom))

        self._update_display_and_scroll(center_x_img=img_x_at_cursor, center_y_img=img_y_at_cursor)

        # After display update, we need to make sure the point that was under the cursor
        # is STILL under the cursor. The _update_display_and_scroll tries to center it,
        # but for mouse-cursor-centered zoom, we need more precision.

        new_canvas_x_for_img_coord = img_x_at_cursor * self.zoom_level
        new_canvas_y_for_img_coord = img_y_at_cursor * self.zoom_level

        # Scroll so that this new_canvas_x/y_for_img_coord is at event.x/y window coordinate
        scroll_to_x_view = new_canvas_x_for_img_coord - event.x # event.x is relative to canvas widget
        scroll_to_y_view = new_canvas_y_for_img_coord - event.y

        if self.display_pil_image.width > 0:
            self.canvas.xview_moveto(scroll_to_x_view / self.display_pil_image.width)
        if self.display_pil_image.height > 0:
            self.canvas.yview_moveto(scroll_to_y_view / self.display_pil_image.height)

        self.update_zoom_label()


    def update_zoom_label(self):
        self.zoom_label.config(text=f"Zoom: {self.zoom_level*100:.0f}%")


    def on_middle_press(self, event):
        if not self.original_pil_image: return
        self.canvas.scan_mark(event.x, event.y)
        self.pan_button_pressed = True
        self.canvas.config(cursor="fleur") # Change cursor to indicate panning

    def on_middle_motion(self, event):
        if not self.original_pil_image or not self.pan_button_pressed: return
        self.canvas.scan_dragto(event.x, event.y, gain=1)

    def on_middle_release(self, event):
        if not self.original_pil_image: return
        self.pan_button_pressed = False
        self.canvas.config(cursor="cross") # Reset to default cross cursor


if __name__ == '__main__':
    root = tk.Tk()
    app = BoundingBoxEditor(root)
    root.geometry("1200x800") # Initial window size
    root.mainloop()