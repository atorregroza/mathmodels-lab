from PIL import Image, ImageDraw, ImageFont
import math
import os

# Canvas
W, H = 1200, 400
img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Colors
INK = (18, 23, 35, 255)
GRAPH = (34, 197, 160, 255)
SIGNAL = (255, 107, 53, 255)
SIGNAL_75 = (255, 107, 53, 191)

# Icon dimensions
icon_size = 300
icon_x, icon_y = 40, 50
rx = 75

# Rounded rectangle
draw.rounded_rectangle(
    (icon_x, icon_y, icon_x + icon_size, icon_y + icon_size),
    radius=rx, fill=INK
)

# M-curve: cubic bezier helper
def cubic_bezier(p0, p1, p2, p3, steps=100):
    points = []
    for i in range(steps + 1):
        t = i / steps
        x = (1-t)**3*p0[0] + 3*(1-t)**2*t*p1[0] + 3*(1-t)*t**2*p2[0] + t**3*p3[0]
        y = (1-t)**3*p0[1] + 3*(1-t)**2*t*p1[1] + 3*(1-t)*t**2*p2[1] + t**3*p3[1]
        points.append((x, y))
    return points

# Map SVG viewBox (48x48) to icon pixel coordinates
scale = icon_size / 48.0
ox, oy = icon_x, icon_y
def s(x, y):
    return (ox + x * scale, oy + y * scale)

# M-curve path segments
seg1 = cubic_bezier(s(8,36), s(10,36), s(14,9), s(17.5,9), 80)
seg2 = cubic_bezier(s(17.5,9), s(21,9), s(21,28), s(24,28), 80)
seg3 = cubic_bezier(s(24,28), s(27,28), s(27,9), s(30.5,9), 80)
seg4 = cubic_bezier(s(30.5,9), s(34,9), s(38,36), s(40,36), 80)
all_points = seg1 + seg2 + seg3 + seg4

# Draw thick curve with circle stamps for smooth stroke
stroke_w = 9
for p in all_points:
    draw.ellipse(
        [p[0]-stroke_w/2, p[1]-stroke_w/2, p[0]+stroke_w/2, p[1]+stroke_w/2],
        fill=GRAPH
    )

# Tangent line
tx1, tx2 = s(10.5, 9), s(24.5, 9)
draw.line([tx1, tx2], fill=SIGNAL_75, width=5)

# Round the tangent line ends
for p in [tx1, tx2]:
    draw.ellipse([p[0]-2.5, p[1]-2.5, p[0]+2.5, p[1]+2.5], fill=SIGNAL_75)

# Critical point dot
cp = s(17.5, 9)
dot_r = 12
draw.ellipse([cp[0]-dot_r, cp[1]-dot_r, cp[0]+dot_r, cp[1]+dot_r], fill=SIGNAL)

# Text: MathModels Lab
fonts_dir = r'C:\Users\Astrid\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\09451e39-8730-47a2-8817-50051544aa43\22224be3-a5f0-4dce-a251-aa15a2951563\skills\canvas-design\canvas-fonts'
try:
    font = ImageFont.truetype(os.path.join(fonts_dir, 'Outfit-Bold.ttf'), 80)
except Exception as e:
    print(f'Font error: {e}, using default')
    font = ImageFont.load_default()

text = 'MathModels Lab'
text_x = icon_x + icon_size + 50
bbox = draw.textbbox((0, 0), text, font=font)
text_h = bbox[3] - bbox[1]
text_y = icon_y + (icon_size - text_h) // 2 - bbox[1]
draw.text((text_x, text_y), text, fill=INK, font=font)

# Save
out_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'images', 'mathmodels-lab-logo.png')
os.makedirs(os.path.dirname(out_path), exist_ok=True)
img.save(out_path, 'PNG')
print(f'Logo saved: {os.path.abspath(out_path)}')
print(f'Size: {img.size}')

# Also save icon-only version (512x512)
icon_img = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
icon_draw = ImageDraw.Draw(icon_img)

iscale = 512 / 48.0
def si(x, y):
    return (x * iscale, y * iscale)

icon_draw.rounded_rectangle((0, 0, 512, 512), radius=128, fill=INK)

# M-curve on icon
iseg1 = cubic_bezier(si(8,36), si(10,36), si(14,9), si(17.5,9), 100)
iseg2 = cubic_bezier(si(17.5,9), si(21,9), si(21,28), si(24,28), 100)
iseg3 = cubic_bezier(si(24,28), si(27,28), si(27,9), si(30.5,9), 100)
iseg4 = cubic_bezier(si(30.5,9), si(34,9), si(38,36), si(40,36), 100)
iall = iseg1 + iseg2 + iseg3 + iseg4

istroke = 18
for p in iall:
    icon_draw.ellipse(
        [p[0]-istroke/2, p[1]-istroke/2, p[0]+istroke/2, p[1]+istroke/2],
        fill=GRAPH
    )

itx1, itx2 = si(10.5, 9), si(24.5, 9)
icon_draw.line([itx1, itx2], fill=SIGNAL_75, width=10)
for p in [itx1, itx2]:
    icon_draw.ellipse([p[0]-5, p[1]-5, p[0]+5, p[1]+5], fill=SIGNAL_75)

icp = si(17.5, 9)
idot_r = 24
icon_draw.ellipse([icp[0]-idot_r, icp[1]-idot_r, icp[0]+idot_r, icp[1]+idot_r], fill=SIGNAL)

icon_out = os.path.join(os.path.dirname(__file__), '..', 'public', 'images', 'mathmodels-lab-icon-512.png')
icon_img.save(icon_out, 'PNG')
print(f'Icon saved: {os.path.abspath(icon_out)}')
