import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

chars = [
    {
        'file': 'steve.webp',
        'name': 'STEVE HARRINGTON',
        'title': 'STRANGER THINGS',
        'initials': 'SH',
        'color': (229, 9, 20),      # Electric Red
        'accent': (255, 90, 90),
        'bg_tint': (180, 10, 20)
    },
    {
        'file': 'rengoku.webp',
        'name': 'KYOJURO RENGOKU',
        'title': 'DEMON SLAYER',
        'initials': 'KR',
        'color': (255, 107, 0),     # Fiery Orange & Gold
        'accent': (255, 200, 40),
        'bg_tint': (210, 70, 0)
    },
    {
        'file': 'joe.webp',
        'name': 'JOE GOLDBERG',
        'title': 'YOU',
        'initials': 'JG',
        'color': (178, 34, 34),     # Deep Crimson
        'accent': (225, 65, 65),
        'bg_tint': (110, 15, 15)
    },
    {
        'file': 'benjamin.webp',
        'name': 'BENJAMIN BARRY',
        'title': 'HOW TO LOSE A GUY IN 10 DAYS',
        'initials': 'BB',
        'color': (212, 175, 55),    # Champagne Gold
        'accent': (250, 220, 130),
        'bg_tint': (165, 135, 35)
    },
    {
        'file': 'hannah.webp',
        'name': 'HANNAH WELLS',
        'title': 'OFF CAMPUS',
        'initials': 'HW',
        'color': (199, 21, 133),    # Rose-Purple
        'accent': (235, 100, 195),
        'bg_tint': (145, 25, 115)
    }
]

W, H = 540, 800
out_dir = os.path.join('app', 'assets', 'characters')
os.makedirs(out_dir, exist_ok=True)

for c in chars:
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    
    # 1. Subtle soft body silhouette cutout shape
    head_cx, head_cy, head_r = W // 2, 250, 95
    torso_top_w = 260
    torso_bottom_w = 460
    torso_y1 = 320
    torso_y2 = H
    
    # Draw silhouette on a mask
    mask = Image.new('L', (W, H), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.ellipse([head_cx - head_r, head_cy - head_r, head_cx + head_r, head_cy + head_r], fill=255)
    
    torso_pts = [
        (W // 2 - torso_top_w // 2, torso_y1),
        (W // 2 + torso_top_w // 2, torso_y1),
        (W // 2 + torso_bottom_w // 2, torso_y2),
        (W // 2 - torso_bottom_w // 2, torso_y2)
    ]
    m_draw.polygon(torso_pts, fill=255)
    m_draw.ellipse([W//2 - 145, torso_y1 - 40, W//2 + 145, torso_y1 + 100], fill=255)
    
    # 2. Shaded body with character theme colors
    body = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(body)
    
    for y in range(H):
        t = y / H
        alpha = int(215 * (1.0 - 0.25 * t))
        col = (
            int(c['bg_tint'][0] * (1 - 0.35 * t)),
            int(c['bg_tint'][1] * (1 - 0.35 * t)),
            int(c['bg_tint'][2] * (1 - 0.35 * t)),
            alpha
        )
        b_draw.line([(0, y), (W, y)], fill=col)
    
    body.putalpha(mask)
    im.paste(body, (0, 0), body)
    
    # 3. Glowing contour rim on silhouette
    rim_mask = mask.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(3))
    rim = Image.new('RGBA', (W, H), c['accent'] + (0,))
    rim_alpha = np.array(rim_mask, dtype=np.float32)
    rim_alpha = np.clip(rim_alpha * 2.2, 0, 255).astype(np.uint8)
    rim.putalpha(Image.fromarray(rim_alpha))
    im.paste(rim, (0, 0), rim)
    
    # 4. Monogram emblem on chest
    badge_cy = 430
    badge_r = 75
    draw.ellipse([W//2 - badge_r, badge_cy - badge_r, W//2 + badge_r, badge_cy + badge_r],
                 fill=(18, 18, 24, 215), outline=c['accent'] + (240,), width=3)
    
    try:
        f_init = ImageFont.truetype('app/fonts/outfit.ttf', 52)
        f_name = ImageFont.truetype('app/fonts/outfit.ttf', 24)
        f_sub = ImageFont.truetype('app/fonts/outfit.ttf', 16)
    except:
        f_init = ImageFont.load_default()
        f_name = ImageFont.load_default()
        f_sub = ImageFont.load_default()
    
    bbox = draw.textbbox((0, 0), c['initials'], font=f_init)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((W//2 - tw//2, badge_cy - th//2 - 6), c['initials'], fill=(255, 255, 255, 250), font=f_init)
    
    # Character name banner below badge
    name_y = 540
    bbox_n = draw.textbbox((0, 0), c['name'], font=f_name)
    nw = bbox_n[2] - bbox_n[0]
    draw.text((W//2 - nw//2, name_y), c['name'], fill=(255, 255, 255, 245), font=f_name)
    
    # Title banner below name
    title_y = 578
    bbox_t = draw.textbbox((0, 0), c['title'], font=f_sub)
    ttw = bbox_t[2] - bbox_t[0]
    draw.text((W//2 - ttw//2, title_y), c['title'], fill=c['accent'] + (230,), font=f_sub)
    
    # Bottom fade to transparent
    fade_start = 650
    for y in range(fade_start, H):
        factor = 1.0 - (y - fade_start) / (H - fade_start)
        for x in range(W):
            pix = im.getpixel((x, y))
            if pix[3] > 0:
                im.putpixel((x, y), (pix[0], pix[1], pix[2], int(pix[3] * factor)))
    
    out_path = os.path.join(out_dir, c['file'])
    im.save(out_path, format='WEBP', quality=95)
    print("Saved placeholder:", out_path)
