
import sys

def find_duplicates(filename, search_str):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    for i, line in enumerate(lines, 1):
        if search_str in line:
            print(f"Match at Line {i}: {line.strip()}")

find_duplicates(sys.argv[1], sys.argv[2])
