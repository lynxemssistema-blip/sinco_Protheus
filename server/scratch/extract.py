import json

out = []
with open('C:/Users/lynx/.gemini/antigravity-ide/brain/686e2433-54f0-4cc0-8fa8-a77e851947f6/.system_generated/logs/transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        try:
            obj = json.loads(line)
            if 'tool_calls' in obj:
                for call in obj['tool_calls']:
                    if call['name'] in ('default_api:replace_file_content', 'default_api:multi_replace_file_content', 'default_api:write_to_file'):
                        args = call.get('args', {})
                        if args.get('TargetFile', '').endswith('pcpRefinado.js'):
                            if 'estrutura-pedido' in str(args):
                                out.append(str(args))
        except Exception:
            pass

with open('c:/Users/lynx/Documents/MetalFisa Anty/server/scratch/extracted_tools.txt', 'w', encoding='utf-8') as f:
    f.write('\n\n---\n\n'.join(out))
