import os
import sys
from PIL import Image

path = os.path.expandvars(sys.argv[1])
img = Image.open(path).convert("RGB")
px = img.resize((64, 36))
data = list(px.get_flattened_data()) if hasattr(px, "get_flattened_data") else list(px.getdata())
lum = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in data]
print("avg luma:", round(sum(lum) / len(lum), 1))
print("min/max:", round(min(lum)), round(max(lum)))
dark = sum(1 for l in lum if l < 30)
mid = sum(1 for l in lum if 30 <= l < 120)
br = sum(1 for l in lum if l >= 120)
print("dark/mid/bright %:", round(dark / len(lum) * 100), round(mid / len(lum) * 100), round(br / len(lum) * 100))
