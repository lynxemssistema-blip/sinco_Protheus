import urllib.request
import json

print("=" * 60)
print("TESTE RAPIDO DO AGENT")
print("=" * 60)

base_url = "http://localhost:8080/api/solidedge"

# Teste 1: Status
print("\n1. Testando /status...")
try:
    with urllib.request.urlopen(f"{base_url}/status", timeout=5) as response:
        data = json.loads(response.read().decode())
        print(f"   Status Code: {response.status}")
        print(f"   Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
except urllib.error.HTTPError as e:
    print(f"   HTTP Error: {e.code}")
    print(f"   Response: {e.read().decode()}")
except Exception as e:
    print(f"   ERRO: {e}")

# Teste 2: Documents  
print("\n2. Testando /documents...")
try:
    with urllib.request.urlopen(f"{base_url}/documents", timeout=5) as response:
        data = json.loads(response.read().decode())
        print(f"   Status Code: {response.status}")
        print(f"   Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
except urllib.error.HTTPError as e:
    print(f"   HTTP Error: {e.code}")
    print(f"   Response: {e.read().decode()}")
except Exception as e:
    print(f"   ERRO: {e}")

# Teste 3: Active Document
print("\n3. Testando /active-document...")
try:
    with urllib.request.urlopen(f"{base_url}/active-document", timeout=5) as response:
        data = json.loads(response.read().decode())
        print(f"   Status Code: {response.status}")
        print(f"   Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
except urllib.error.HTTPError as e:
    print(f"   HTTP Error: {e.code}")
    print(f"   Response: {e.read().decode()}")
except Exception as e:
    print(f"   ERRO: {e}")

print("\n" + "=" * 60)
print("TESTE CONCLUIDO")
print("=" * 60)
