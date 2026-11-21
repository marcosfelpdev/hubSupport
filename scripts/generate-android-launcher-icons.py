import os
from PIL import Image, ImageDraw, ImageChops

def generate_icons():
    # Source image
    src_icon_path = os.path.abspath('public/relix-icon.png')
    assert os.path.exists(src_icon_path), f"Source icon not found: {src_icon_path}"
    
    src_img = Image.open(src_icon_path).convert('RGBA')
    print(f"Loaded source image: {src_icon_path} ({src_img.size})")

    # Target Android res directory
    target_res_dirs = [
        os.path.abspath('../hubsupport-phone-finder-android/app/src/main/res'),
        'C:/Users/mfana/projetos/hubsupport-phone-finder-android/app/src/main/res',
    ]
    res_dir = next((d for d in target_res_dirs if os.path.exists(d)), None)
    assert res_dir, "Android res directory not found"
    print(f"Target Android res directory: {res_dir}")

    densities = [
        ('mipmap-mdpi', 48),
        ('mipmap-hdpi', 72),
        ('mipmap-xhdpi', 96),
        ('mipmap-xxhdpi', 144),
        ('mipmap-xxxhdpi', 192),
    ]

    for folder_name, size in densities:
        folder_path = os.path.join(res_dir, folder_name)
        os.makedirs(folder_path, exist_ok=True)

        # 1. Standard launcher icon (squircle / rounded rectangle from brand icon)
        launcher_img = src_img.resize((size, size), Image.Resampling.LANCZOS)
        launcher_path = os.path.join(folder_path, 'ic_launcher.png')
        launcher_img.save(launcher_path, format='PNG', optimize=True)
        print(f"Generated {launcher_path} ({size}x{size}, {os.path.getsize(launcher_path)} bytes)")

        # 2. Round launcher icon (circular alpha mask)
        # Create 4x supersampled circular mask for clean antialiasing
        scale = 4
        ss_size = size * scale
        mask_ss = Image.new('L', (ss_size, ss_size), 0)
        draw = ImageDraw.Draw(mask_ss)
        # Circle filling the canvas from (0, 0) to (ss_size - 1, ss_size - 1)
        draw.ellipse((0, 0, ss_size - 1, ss_size - 1), fill=255)
        # Downscale mask to target size with LANCZOS for smooth edge antialiasing
        mask = mask_ss.resize((size, size), Image.Resampling.LANCZOS)

        round_img = launcher_img.copy()
        # Combine existing alpha with circular mask
        existing_alpha = round_img.getchannel('A')
        combined_alpha = ImageChops.multiply(existing_alpha, mask)
        round_img.putalpha(combined_alpha)

        round_path = os.path.join(folder_path, 'ic_launcher_round.png')
        round_img.save(round_path, format='PNG', optimize=True)
        print(f"Generated {round_path} ({size}x{size}, {os.path.getsize(round_path)} bytes)")

    print("\nAll 10 Android launcher icons generated successfully!")

if __name__ == '__main__':
    generate_icons()
