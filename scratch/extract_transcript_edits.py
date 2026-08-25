with open(r"C:\Users\lynx\.gemini\antigravity-ide\brain\727d61fe-6d2e-4746-8bbd-ee07dabc8923\.system_generated\logs\transcript_full.jsonl", 'r', encoding='utf-8', errors='ignore') as f:
    for idx, line in enumerate(f, 1):
        if "ExportarPorGrid(" in line:
            # Let's find occurrences of ExportarPorGrid( in the line
            pos = 0
            while True:
                pos = line.find("ExportarPorGrid(", pos)
                if pos == -1:
                    break
                # Print around the occurrence
                start = max(0, pos - 150)
                end = min(len(line), pos + 250)
                print(f"MATCH AT LINE {idx}:\n... {line[start:end]} ...\n")
                pos += 1
