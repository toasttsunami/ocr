import os
import glob
import json
import numpy

for file in glob.glob('*.json'):
    # print(file)
    output = os.path.splitext(file)[0] + '.txt'
    # print(output)
    with open(file, 'r') as f:
        data = json.load(f)
    # print(data[0])
    # print(data[0]['detections'][0]) -> {'bounding_box': [[51, 69], [91, 69], [91, 113], [51, 113]], 'text': '2.', 'confidence': 0.4496023071008623}
    with open(output, 'w') as f:
        for box in data[0]['detections']:
            pts = [idx for row in box['bounding_box'] for idx in row]
            f.write(','.join(map(str, pts)))
            f.write(',' + box['text'] + '\n')


    # print(objs)

    

# output_dir = "output/"
# for file in glob.glob("CD/*.jpg"):
#     # img = os.path.splittext(file)
#     # print(file)
#     with Image.open(file) as im:
#         gray_im = im.convert("L")
#         inv_gray_img = impos.invert(gray_im)
#         # print(inv_gray_img.histogram())
#         threshold = 128
#         inv_gray_img = inv_gray_img.point( lambda p : 255 if p > threshold else 0)
#         inv_gray_img.save(output_dir + os.path.basename(file))
#         # inv_gray_img.show()
#     # break