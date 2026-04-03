
import sys

def check_balance(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        brace_stack = []
        paren_stack = []
        lines = content.split('\n')
        
        for i, line in enumerate(lines, 1):
            for char_idx, char in enumerate(line, 1):
                if char == '{':
                    brace_stack.append((i, char_idx))
                elif char == '}':
                    if not brace_stack:
                        print(f"ERROR: Extra closing BRACE '}}' at Line {i}, Col {char_idx}")
                    else:
                        brace_stack.pop()
                elif char == '(':
                    paren_stack.append((i, char_idx))
                elif char == ')':
                    if not paren_stack:
                        print(f"ERROR: Extra closing PAREN ')' at Line {i}, Col {char_idx}")
                    else:
                        paren_stack.pop()
        
        if brace_stack:
            for b in brace_stack:
                print(f"ERROR: Unclosed BRACE '{{' from Line {b[0]}, Col {b[1]}")
        if paren_stack:
            for p in paren_stack:
                print(f"ERROR: Unclosed PAREN '(' from Line {p[0]}, Col {p[1]}")
        
        if not brace_stack and not paren_stack:
            print("SUCCESS: All braces and parentheses are perfectly balanced!")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    check_balance(sys.argv[1])
