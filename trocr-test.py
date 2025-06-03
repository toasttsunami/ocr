from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel, AutoProcessor
import torch
input_img = "./output/CD-02.jpg"
image = Image.open(input_img).convert("RGB")

processor = AutoProcessor.from_pretrained("microsoft/trocr-base-handwritten")
model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")

pixel_values = processor(images=image, return_tensors="pt").pixel_values

# print(pixel_values.unique())

generated_ids = model.generate(pixel_values)
generated_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
print(generated_ids)
