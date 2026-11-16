import sys, os
from PIL import Image
p = sys.argv[1]
im = Image.open(p).convert('RGB')
w, h = im.size
small = im.resize((80, 40))
chars = ' .:-=+*#%@'
vals = list(small.getdata())
lum = [0.299*r + 0.587*g + 0.114*b for r, g, b in vals]
avg = sum(lum) / len(lum)
dark = sum(1 for v in lum if v < 24) / len(lum)
print(os.path.basename(p), f'{w}x{h}', 'luma:', round(avg, 1), 'dark%:', round(dark * 100))
for y in range(40):
    row = ''
    for x in range(80):
        v = lum[y * 80 + x]
        row += chars[min(9, int(v / 256 * 10))]
    print(row)
