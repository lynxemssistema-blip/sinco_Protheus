import json
import codecs

path = r"C:\Users\lynx\.gemini\antigravity-ide\brain\727d61fe-6d2e-4746-8bbd-ee07dabc8923\.system_generated\logs\transcript_full.jsonl"
out_path = r"c:\Users\lynx\Documents\MetalFisa Anty\scratch\all_steps.txt"

with open(path, 'r', encoding='utf-8', errors='ignore') as f, codecs.open(out_path, 'w', encoding='utf-8') as out:
    for idx, line in enumerate(f, 1):
        if "btnDxf_Click" in line or "btnGerarPdf_Click" in line:
            try:
                obj = json.loads(line)
                content = obj.get("content", "")
                if content:
                    out.write(f"=== STEP {obj.get('step_index')} (Line {idx}) ===\n")
                    out.write(content)
                    out.write("\n==================================================\n\n")
            except:
                pass

print("SUCCESS: All steps written to scratch/all_steps.txt!")
