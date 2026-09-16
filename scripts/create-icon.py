from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
image = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((10, 10, 246, 246), radius=55, fill='#536fbd')
draw.line([(66, 140), (66, 74), (158, 74)], fill='white', width=19, joint='curve')
draw.line([(102, 184), (194, 184), (194, 94)], fill='white', width=19, joint='curve')
for x,y in [(66,140),(66,74),(158,74),(102,184),(194,184),(194,94)]:
    draw.ellipse((x-9,y-9,x+9,y+9),fill='white')
draw.ellipse((56,166,92,202),fill='#ffd49a')
image.save(root / 'desktop' / 'thumbnail.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
