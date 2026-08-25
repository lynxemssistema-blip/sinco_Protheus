import json
import codecs

path = r"C:\Users\lynx\.gemini\antigravity-ide\brain\727d61fe-6d2e-4746-8bbd-ee07dabc8923\.system_generated\logs\transcript_full.jsonl"
out_path = r"c:\Users\lynx\Documents\MetalFisa Anty\scratch\extracted_full.txt"

with open(path, 'r', encoding='utf-8', errors='ignore') as f, codecs.open(out_path, 'w', encoding='utf-8') as out:
    for idx, line in enumerate(f, 1):
        if "btnDxf_Click" in line and "MessageBoxButtons.YesNoCancel" in line:
            obj = json.loads(line)
            # Find the content which holds the full model response
            content = obj.get("content", "")
            out.write(f"=== FULL MODEL CONTENT FOR STEP {obj.get('step_index')} ===\n")
            out.write(content)
            out.write("\n==================================================\n\n")

print("SUCCESS: Full content written to scratch/extracted_full.txt!")
