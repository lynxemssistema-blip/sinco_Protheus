
import fs
import os

file_path = r'c:\Users\adm\Desktop\MetalFisa Anty\server\routes\production.js'

try:
    # Try reading with utf-8
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    print("Successfully read as utf-8")
except UnicodeDecodeError:
    print("Failed to read as utf-8, trying latin-1")
    try:
        with open(file_path, 'r', encoding='latin-1') as f:
            content = f.read()
        print("Successfully read as latin-1")
    except Exception as e:
        print(f"Failed to read: {e}")
        exit(1)

# Now write back as standard utf-8 without BOM
try:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully wrote back as utf-8")
except Exception as e:
    print(f"Failed to write: {e}")
