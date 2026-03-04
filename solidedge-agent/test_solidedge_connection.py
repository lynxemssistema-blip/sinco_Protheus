import win32com.client
import sys

print("=" * 60)
print("TESTE DE CONEXAO COM SOLIDEDGE")
print("=" * 60)

try:
    print("\n1. Tentando conectar ao SolidEdge...")
    app = win32com.client.Dispatch("SolidEdge.Application")
    print("   [OK] Conexao estabelecida!")
    
    print("\n2. Verificando versao...")
    if hasattr(app, 'Version'):
        print(f"   Versao: {app.Version}")
    else:
        print("   [AVISO] Nao foi possivel obter versao")
    
    print("\n3. Verificando documento ativo...")
    if app.ActiveDocument:
        doc = app.ActiveDocument
        print(f"   [OK] Documento encontrado!")
        print(f"   Nome: {doc.Name if hasattr(doc, 'Name') else 'N/A'}")
        print(f"   Caminho: {doc.FullName if hasattr(doc, 'FullName') else 'N/A'}")
    else:
        print("   [AVISO] Nenhum documento aberto")
    
    print("\n" + "=" * 60)
    print("TESTE CONCLUIDO COM SUCESSO!")
    print("=" * 60)
    
except Exception as e:
    print("\n" + "=" * 60)
    print("ERRO AO CONECTAR!")
    print("=" * 60)
    print(f"\nErro: {str(e)}")
    print(f"\nTipo: {type(e).__name__}")
    
    import traceback
    print("\nTraceback completo:")
    traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("POSSIVEIS SOLUCOES:")
    print("=" * 60)
    print("1. Execute este script como ADMINISTRADOR")
    print("2. Certifique-se de que o SolidEdge esta ABERTO")
    print("3. Tente abrir um desenho no SolidEdge primeiro")
    sys.exit(1)
