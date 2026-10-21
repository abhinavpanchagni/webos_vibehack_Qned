import os
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_fill_holes, gaussian_filter

char_dir = os.path.join('app', 'assets', 'characters')
backup_dir = os.path.join('app', 'assets', 'characters_backup')
os.makedirs(backup_dir, exist_ok=True)

files = ['steve.webp', 'rengoku.webp', 'joe.webp', 'benjamin.webp', 'hannah.webp']

print("=== Processing User Character Images into Transparent WebP Cutouts ===")

for f in files:
    src_path = os.path.join(char_dir, f)
    backup_path = os.path.join(backup_dir, f)
    
    # 1. Backup original user file if not already backed up
    if not os.path.exists(backup_path):
        import shutil
        shutil.copy2(src_path, backup_path)
        print(f"Backed up original {f} to {backup_path}")
    
    # 2. Open original
    im = Image.open(backup_path).convert('RGB')
    W, H = im.size
    arr = np.array(im, dtype=np.float32)
    max_c = np.max(arr, axis=2)
    
    # 3. Robust border flood-fill to find exterior black background
    # Dark seed threshold (background is near black <= 8)
    bg_seed = max_c <= 8.0
    labeled, num_features = label(bg_seed)
    
    # Collect all label IDs touching any image border
    border_labels = set()
    border_labels.update(labeled[0, :])     # top row
    border_labels.update(labeled[-1, :])    # bottom row
    border_labels.update(labeled[:, 0])     # left column
    border_labels.update(labeled[:, -1])    # right column
    border_labels.discard(0)                # 0 is foreground
    
    exterior_bg = np.isin(labeled, list(border_labels))
    
    # Initial character mask is non-exterior
    char_mask = ~exterior_bg
    # Fill any interior dark regions (e.g. black jackets, dark hair, eyes)
    char_mask_filled = binary_fill_holes(char_mask).astype(np.float32)
    
    # 4. Anti-aliasing on the contour boundary
    alpha = gaussian_filter(char_mask_filled, sigma=1.0)
    alpha = np.clip((alpha - 0.08) / 0.84, 0.0, 1.0)
    
    # 5. Smooth bottom feather (fade lower 50px to 0 so cutout blends seamlessly above dock)
    fade_height = 50
    fade_y_start = H - fade_height
    y_coords = np.arange(H).reshape(H, 1)
    bottom_fade_factor = np.where(
        y_coords >= fade_y_start,
        1.0 - (y_coords - fade_y_start) / float(fade_height),
        1.0
    )
    alpha = alpha * bottom_fade_factor
    
    # 6. Un-premultiply slightly along the immediate edge to eliminate dark fringe
    # Where alpha is between 0.05 and 0.95, divide RGB by alpha gently
    edge_zone = (alpha > 0.05) & (alpha < 0.95)
    scale_factor = np.ones_like(alpha)
    scale_factor[edge_zone] = np.clip(1.0 / np.maximum(alpha[edge_zone], 0.4), 1.0, 1.6)
    
    R = np.clip(arr[:, :, 0] * scale_factor, 0, 255)
    G = np.clip(arr[:, :, 1] * scale_factor, 0, 255)
    B = np.clip(arr[:, :, 2] * scale_factor, 0, 255)
    A = np.clip(alpha * 255.0, 0, 255)
    
    rgba = np.dstack([R, G, B, A]).astype(np.uint8)
    out_im = Image.fromarray(rgba, 'RGBA')
    
    # 7. Save as real, optimized WebP
    out_im.save(src_path, format='WEBP', quality=95, method=6)
    new_size = os.path.getsize(src_path)
    print(f"Processed {f:15s} -> Transparent RGBA WebP ({W}x{H}) | Size: {new_size:,} bytes")

print("All character cutout images processed successfully!")
