import json
import codecs

path = r"C:\Users\lynx\.gemini\antigravity-ide\brain\727d61fe-6d2e-4746-8bbd-ee07dabc8923\.system_generated\logs\transcript_full.jsonl"
out_path = r"c:\Users\lynx\Documents\MetalFisa Anty\scratch\tool_calls.txt"

with open(path, 'r', encoding='utf-8', errors='ignore') as f, codecs.open(out_path, 'w', encoding='utf-8') as out:
    for idx, line in enumerate(f, 1):
        if "btnDxf_Click" in line or "btnGerarPdf_Click" in line:
            try:
                obj = json.loads(line)
                # Check tool_calls
                tcs = obj.get("tool_calls", [])
                if not tcs and "PLANNER_RESPONSE" in line:
                    # Let's search inside the outer object too
                    tcs = obj.get("tool_calls", [])
                
                for tc in tcs:
                    args = tc.get("args", {})
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except:
                            pass
                    if isinstance(args, dict):
                        rep = args.get("ReplacementContent", "") or args.get("CodeContent", "")
                        if "btnDxf_Click" in rep or "btnGerarPdf_Click" in rep:
                            out.write(f"=== STEP {obj.get('step_index')} (Line {idx}) - {tc.get('name')} ===\n")
                            out.write(rep)
                            out.write("\n==================================================\n\n")
            except Exception as e:
                pass

print("SUCCESS: Tool calls written to scratch/tool_calls.txt!")
