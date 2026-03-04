import urllib.request
import json

print("Testando nova versao do agent (sem Flask)...")

try:
    with urllib.request.urlopen("http://localhost:8080/api/solidedge/status", timeout=3) as response:
        data = json.loads(response.read().decode())
        print("\n✅ SUCESSO!")
        print(json.dumps(data, indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
    print(f"\n❌ HTTP Error: {e.code}")
    print(e.read().decode())
except Exception as e:
    print(f"\n❌ Erro: {e}")
    print("\nAgent pode nao estar rodando ainda.")
    print("Aguarde alguns segundos e tente novamente.")
