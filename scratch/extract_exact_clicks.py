import json
import codecs

path = r"C:\Users\lynx\.gemini\antigravity-ide\brain\727d61fe-6d2e-4746-8bbd-ee07dabc8923\.system_generated\logs\transcript_full.jsonl"
out_path = r"c:\Users\lynx\Documents\MetalFisa Anty\scratch\extracted.txt"

with open(path, 'r', encoding='utf-8', errors='ignore') as f, codecs.open(out_path, 'w', encoding='utf-8') as out:
    for idx, line in enumerate(f, 1):
        if "btnDxf_Click" in line or "btnGerarPdf_Click" in line:
            pos = 0
            while True:
                pos = line.find("btnDxf_Click", pos)
                if pos == -1:
                    break
                start = max(0, pos - 200)
                end = min(len(line), pos + 1000)
                out.write(f"MATCH btnDxf_Click AT LINE {idx}:\n{line[start:end]}\n\n")
                pos += 1
                
            pos = 0
            while True:
                pos = line.find("btnGerarPdf_Click", pos)
                if pos == -1:
                    break
                start = max(0, pos - 200)
                end = min(len(line), pos + 1000)
                out.write(f"MATCH btnGerarPdf_Click AT LINE {idx}:\n{line[start:end]}\n\n")
                pos += 1

print("SUCCESS: Matches written to scratch/extracted.txt!")
