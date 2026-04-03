
import sys

def check_levels(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    level = 0
    for i, line in enumerate(lines, 1):
        # We need to consider that multiple braces can be in one line
        # Simple count for start/end of line for brevity
        for char in line:
            if char == '{': level += 1
            elif char == '}': level -= 1
        
        # Check specific suspect lines
        if i in [28, 34, 289, 291, 294, 336, 1310, 1311, 1312]:
            print(f"Line {i} (Level {level}): {line.strip()}")

check_levels(sys.argv[1])
