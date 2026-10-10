import re, glob

# Check CSS files for anything that could cause horizontal overflow on mobile
print("=== Checking CSS files ===")
for path in glob.glob("src/css/*.css"):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Check for hardcoded widths without max-width or percentages
    lines = content.splitlines()
    for idx, line in enumerate(lines, 1):
        # find width: Xpx where X > 320
        match = re.search(r'(?:min-width|width)\s*:\s*(\d+)px', line)
        if match:
            val = int(match.group(1))
            if val > 300 and '@media' not in line and 'max-width' not in line:
                print(f"{path}:{idx} -> {line.strip()}")

print("=== Checking index.html & templates ===")
for path in ['index.html', 'wp-content/themes/rp-novels/header.php']:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    lines = content.splitlines()
    for idx, line in enumerate(lines, 1):
        if 'min-width' in line or ('width:' in line and 'px' in line):
            print(f"{path}:{idx} -> {line.strip()}")
