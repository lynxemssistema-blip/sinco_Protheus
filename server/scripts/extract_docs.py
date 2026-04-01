# server/scripts/extract_docs.py
import os
import json
import re
import win32com.client

def extract_data_from_doc(filepath, word_app):
    doc = word_app.Documents.Open(filepath, ReadOnly=True)
    text = doc.Range().Text
    doc.Close()
    
    # Defaults
    cargo = {"denominacao": os.path.basename(filepath).replace('.doc', '').strip(), "codigo_interno": "", "cbo": "", "atividades": []}
    
    try:
        lines = [line.strip() for line in text.split('\r') if line.strip()]
        
        # VERY basic heuristic parser for typical SGQ Cargos Document
        for i, line in enumerate(lines):
            # Extract CBO
            if "CBO:" in line:
                m = re.search(r'CBO:\s*([\d-]+)', line)
                if m:
                    cargo["cbo"] = m.group(1)
            
            # Extract Codigo
            if "CÓDIGO:" in line or "CODIGO:" in line or "CDIGO:" in line:
                m = re.search(r'C[ÓO]DIGO:\s*([A-Za-z0-9_-]+)', line)
                if m:
                    cargo["codigo_interno"] = m.group(1)
                    
            # Extract Activities (looking for numbered lines like '01', '02')
            if re.match(r'^\d{2}\s+', line):
                activity = re.sub(r'^\d{2}\s+', '', line).strip()
                cargo["atividades"].append(activity)

    except Exception as e:
        print(f"Error parsing {filepath}: {e}")
        
    return cargo

def main():
    folder = r"C:\Users\adm\Desktop\MetalFisa Anty\Cargo e Funções"
    output_file = r"C:\Users\adm\Desktop\MetalFisa Anty\server\scripts\cargos.json"
    
    if not os.path.exists(folder):
        print("Folder not found.")
        return

    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    
    cargos = []
    
    files = [f for f in os.listdir(folder) if f.lower().endswith('.doc')]
    
    for i, file in enumerate(files):
        filepath = os.path.join(folder, file)
        print(f"Processing {i+1}/{len(files)}: {file}")
        data = extract_data_from_doc(filepath, word)
        cargos.append(data)
        
    word.Quit()
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(cargos, f, ensure_ascii=False, indent=2)
        
    print(f"Extraction complete. Saved {len(cargos)} records to {output_file}")

if __name__ == "__main__":
    main()
