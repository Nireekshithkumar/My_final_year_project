import os
import subprocess
import shutil

cache_dir = os.path.expanduser(r"~\AppData\Local\electron-builder\Cache\winCodeSign")
target_dir = os.path.join(cache_dir, "winCodeSign-2.6.0")

if not os.path.exists(target_dir):
    os.makedirs(target_dir, exist_ok=True)

# Find 7za executable in desktop node_modules
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
seven_zip = os.path.join(project_root, "node_modules", "7zip-bin", "win", "x64", "7za.exe")

# Find any downloaded 7z file in winCodeSign cache
found_archive = None
for f in os.listdir(cache_dir):
    if f.endswith(".7z"):
        found_archive = os.path.join(cache_dir, f)
        break

if found_archive and os.path.exists(seven_zip):
    print(f"Extracting {found_archive} to {target_dir} without symlinks (excluding darwin/)...")
    # Extract only windows / tools excluding darwin/
    cmd = [seven_zip, "x", "-y", f"-o{target_dir}", found_archive, "-xr!darwin"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    print("7za return code:", res.returncode)
    print("7za output:", res.stdout)
    if res.returncode == 0:
        print("Successfully extracted winCodeSign without darwin symlinks!")
else:
    print(f"Archive not found in {cache_dir}")
