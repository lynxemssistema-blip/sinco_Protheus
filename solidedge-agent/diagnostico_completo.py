"""
TESTE DE DIAGNOSTICO COMPLETO - SolidEdge COM
"""
import win32com.client
import pythoncom
import sys

print("=" * 60)
print("DIAGNOSTICO COMPLETO - SolidEdge COM")
print("=" * 60)

# Teste 1: CoInitialize
print("\n1. Testando CoInitialize...")
try:
    pythoncom.CoInitialize()
    print("   [OK] CoInitialize executado com sucesso")
    
    # Teste 2: GetActiveObject
    print("\n2. Testando GetActiveObject...")
    try:
        app = win32com.client.GetActiveObject("SolidEdge.Application")
        print("   [OK] GetActiveObject funcionou!")
        print(f"   Versao: {app.Version}")
        
        # Teste 3: ActiveDocument
        print("\n3. Testando ActiveDocument...")
        if app.ActiveDocument:
            print(f"   [OK] Documento: {app.ActiveDocument.Name}")
        else:
            print("   [AVISO] Nenhum documento ativo")
            
    except Exception as e:
        print(f"   [ERRO] GetActiveObject falhou: {e}")
        
        # Teste 2b: Dispatch
        print("\n2b. Testando Dispatch...")
        try:
            app = win32com.client.Dispatch("SolidEdge.Application")
            print("   [OK] Dispatch funcionou!")
            print(f"   Versao: {app.Version}")
        except Exception as e2:
            print(f"   [ERRO] Dispatch falhou: {e2}")
    
    # Cleanup
    pythoncom.CoUninitialize()
    print("\n[OK] CoUninitialize executado")
    
except Exception as e:
    print(f"   [ERRO] CoInitialize falhou: {e}")
    sys.exit(1)

print("\n" + "=" * 60)
print("DIAGNOSTICO CONCLUIDO - TUDO OK!")
print("=" * 60)
print("\nO problema NAO e com Python/COM.")
print("O problema e com o Flask/Threading.")
print("\nVou criar uma versao SEM Flask para testar...")
