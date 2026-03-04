"""
SolidEdge Agent - MetalFisa
VERSAO SEM FLASK - HTTP Server Nativo
Threading completamente controlado para COM
"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse
import win32com.client
import pythoncom
import traceback
import os
from datetime import datetime, date

class CustomJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle datetime and other COM objects"""
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        try:
            return str(obj)
        except:
            return None


class SolidEdgeHandler(BaseHTTPRequestHandler):
    """HTTP Handler com COM inicializado por request"""
    
    def log_message(self, format, *args):
        """Log customizado"""
        print(f"[{self.address_string()}] {format % args}")
    
    def send_json(self, data, status=200):
        """Envia resposta JSON"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, cls=CustomJSONEncoder).encode('utf-8'))
    
    def get_solidedge(self):
        """Get SolidEdge COM object"""
        try:
            # Tenta conectar na instancia que ja esta rodando (O CORRETO)
            return win32com.client.GetActiveObject("SolidEdge.Application")
        except Exception as e:
            print(f"⚠️ [COM] Falha ao conectar no SolidEdge ativo: {e}")
            print("⚠️ [COM] Tentando iniciar nova instancia (Dispatch)...")
            try:
                return win32com.client.Dispatch("SolidEdge.Application")
            except Exception as e2:
                print(f"❌ [COM] Falha total ao obter SolidEdge: {e2}")
                return None
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_json({'status': 'ok'})
    
    def do_GET(self):
        """Handle GET requests"""
        pythoncom.CoInitialize()
        try:
            if self.path == '/api/solidedge/status':
                self.handle_status()
            elif self.path == '/api/solidedge/active-document':
                self.handle_active_document()
            else:
                self.send_json({'error': 'Not Found'}, 404)
        finally:
            pythoncom.CoUninitialize()
    
    def do_POST(self):
        """Handle POST requests"""
        pythoncom.CoInitialize()
        
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
            data = json.loads(body)
            
            if self.path == '/api/solidedge/export-dxf':
                self.handle_export_dxf(data)
            elif self.path == '/api/solidedge/export-pdf':
                self.handle_export_pdf(data)
            else:
                self.send_json({'error': 'Not Found'}, 404)
        finally:
            pythoncom.CoUninitialize()

    def handle_status(self):
        """Status endpoint"""
        try:
            app = self.get_solidedge()
            if not app:
                self.send_json({'isRunning': False, 'error': 'SolidEdge not running', 'status': 'offline'}, 503)
                return

            version = getattr(app, 'Version', 'Unknown')
            self.send_json({
                'isRunning': True,
                'version': version,
                'status': 'online'
            })
        except Exception as e:
            self.send_json({
                'isRunning': False,
                'error': str(e),
                'status': 'offline'
            }, 503)

    def handle_documents(self):
        """List documents endpoint"""
        try:
            app = self.get_solidedge()
            if not app:
                self.send_json({'count': 0, 'items': [], 'error': 'SolidEdge not running'})
                return

            docs = getattr(app, 'Documents', None)
            
            if not docs:
                self.send_json({'count': 0, 'items': []})
                return
            
            items = []
            try:
                for i in range(1, docs.Count + 1):
                    try:
                        d = docs.Item(i)
                        items.append({
                            'name': getattr(d, 'Name', None),
                            'fullPath': getattr(d, 'FullName', None),
                            'type': str(getattr(d, 'Type', None))
                        })
                    except:
                        pass
            except:
                pass
            
            self.send_json({'count': len(items), 'items': items})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_active_document(self):
        """Active document endpoint"""
        try:
            app = self.get_solidedge()
            
            if not app:
                self.send_json({'error': 'SolidEdge nao encontrado. Verifique se esta aberto.'}, 503)
                return
            
            # Verifica documentos abertos
            try:
                if app.Documents.Count == 0:
                    self.send_json({'error': 'Nenhum documento aberto no SolidEdge'}, 404)
                    return
            except:
                # Se falhar ao ler Documents.Count, provavelmente a conexao COM esta quebrada
                self.send_json({'error': 'Erro ao ler documentos. SolidEdge travado ou permissao negada.'}, 500)
                return

            try:
                doc = app.ActiveDocument
            except:
                doc = None

            if not doc:
                self.send_json({'error': 'Nenhum documento ativo detectado'}, 404)
                return

            print(f"📄 [DEBUG] Sincronizando: {doc.Name}")

            # =========================================================================
            # LOGICA DO VB.NET REPLICADA
            # =========================================================================
            
            # 1. Força atualização
            try: 
                doc.Update() 
                app.DoIdle() # Processa fila de mensagens do Windows
            except: pass

            # 2. Verifica Flat Pattern (Chaparia) e cria se necessario
            filename = getattr(doc, 'Name', '').lower()
            if filename.endswith('.psm'):
                try:
                    # Tenta acessar FlatPatternModels
                    # Nota: Em Python COM, colecoes as vezes precisam de ()
                    fps = None
                    try: fps = doc.FlatPatternModels 
                    except: pass
                    
                    if fps and fps.Count == 0:
                        print("🔧 [AUTO] Criando Flat Pattern (Comando 1494)...")
                        app.StartCommand(1494) 
                except Exception as e:
                    print(f"⚠️ [AUTO] Falha ao verificar/criar Flat Pattern: {e}")

            # 3. Força UpdatePhysicalProperties
            try: doc.UpdatePhysicalProperties() 
            except: pass

            # Retorna dados (mesma estrutura de antes)
            doc_data = {
                'basic': {
                    'fileName': getattr(doc, 'Name', None),
                    'fullPath': getattr(doc, 'FullName', None),
                    'type': str(getattr(doc, 'Type', None)),
                    'readOnly': getattr(doc, 'ReadOnly', None)
                },
                'variables': {},
                'customProperties': {},
                'summary': {},
                'physical': {},
                'material': None,
                'flatPattern': {}
            }
            
            # ========== READ VARIABLES ==========
            try:
                if hasattr(doc, 'Variables'):
                    variables = doc.Variables
                    vars_dict = {}
                    
                    # Lista de variáveis importantes (baseado no VB.NET)
                    target_vars = [
                        'Mass_0', 'Mass0',
                        'Área_de_superfície', 'Area_de_superficie', 'SurfaceArea',
                        'Flat_Pattern_Model_CutSizeX', 'CutSizeX',
                        'Flat_Pattern_Model_CutSizeY', 'CutSizeY'
                    ]
                    
                    # Ler TODAS as variáveis
                    for i in range(1, variables.Count + 1):
                        try:
                            var = variables.Item(i)
                            var_name = getattr(var, 'Name', None)
                            if var_name:
                                var_info = {
                                    'value': None,
                                    'formula': None,
                                    'isActive': None,
                                    'expose': None
                                }
                                
                                try:
                                    var_info['value'] = getattr(var, 'Value', None)
                                except:
                                    pass
                                
                                try:
                                    var_info['formula'] = getattr(var, 'Formula', None)
                                except:
                                    pass
                                
                                try:
                                    var_info['isActive'] = getattr(var, 'IsActive', None)
                                except:
                                    pass
                                
                                try:
                                    var_info['expose'] = getattr(var, 'Expose', None)
                                except:
                                    pass
                                
                                vars_dict[var_name] = var_info
                        except:
                            pass
                    
                    doc_data['variables'] = vars_dict
            except Exception as e:
                doc_data['variables']['_error'] = str(e)
            
            # ========== READ CUSTOM PROPERTIES (INDIVIDUAL) ==========
            try:
                if hasattr(doc, 'Properties'):
                    # Acessa conjunto "Custom"
                    try:
                        custom_props = doc.Properties("Custom")
                        custom_dict = {}
                        
                        # Lista de propriedades importantes
                        important_props = [
                            'Tipo de desenho',
                            'Bloqueado',
                            'Projeto',
                            'Cliente',
                            'Material',
                            'Espessura',
                            'Acabamento',
                            'Peso',
                            'Desenho'
                        ]
                        
                        # Tenta ler cada propriedade importante
                        for prop_name in important_props:
                            try:
                                prop = custom_props.Item(prop_name)
                                custom_dict[prop_name] = {
                                    'value': getattr(prop, 'Value', None),
                                    'type': str(getattr(prop, 'Type', None))
                                }
                            except:
                                custom_dict[prop_name] = None
                        
                        # Tenta ler TODAS as custom properties
                        try:
                            for i in range(1, custom_props.Count + 1):
                                try:
                                    prop = custom_props.Item(i)
                                    prop_name = getattr(prop, 'Name', f'Custom_{i}')
                                    if prop_name not in custom_dict:
                                        custom_dict[prop_name] = {
                                            'value': getattr(prop, 'Value', None),
                                            'type': str(getattr(prop, 'Type', None))
                                        }
                                except:
                                    pass
                        except:
                            pass
                        
                        doc_data['customProperties'] = custom_dict
                    except Exception as e:
                        doc_data['customProperties']['_error'] = str(e)
            except Exception as e:
                doc_data['customProperties']['_error'] = str(e)
            
            # ========== SUMMARY PROPERTIES ==========
            try:
                if hasattr(doc, 'SummaryInfo'):
                    summary = doc.SummaryInfo
                    doc_data['summary'] = {
                        'title': getattr(summary, 'Title', None),
                        'subject': getattr(summary, 'Subject', None),
                        'author': getattr(summary, 'Author', None),
                        'keywords': getattr(summary, 'Keywords', None),
                        'comments': getattr(summary, 'Comments', None)
                    }
            except Exception as e:
                doc_data['summary']['_error'] = str(e)
            
            # ========== PHYSICAL PROPERTIES (DEEP READ) ==========
            try:
                # FORÇA RECÁLCULO (como VB.NET)
                try:
                    doc.UpdatePhysicalProperties()
                except:
                    pass
                
                try:
                    doc.Update()
                except:
                    pass
                
                # Tenta ler ExtendedMassProperties
                if hasattr(doc, 'Models') and doc.Models.Count > 0:
                    model = doc.Models.Item(1)
                    
                    # Primeira tentativa: ExtendedMassProperties
                    if hasattr(model, 'ExtendedMassProperties'):
                        try:
                            mp = model.ExtendedMassProperties
                            
                            # Lê propriedades
                            mass_raw = None
                            area_raw = None
                            volume_raw = None
                            density_raw = None
                            accuracy_raw = None
                            
                            try:
                                mass_raw = mp.Mass  # em kg
                            except:
                                pass
                            
                            try:
                                area_raw = mp.Area  # em m²
                            except:
                                pass
                            
                            try:
                                volume_raw = mp.Volume  # em m³
                            except:
                                pass
                            
                            try:
                                density_raw = mp.Density  # em kg/m³
                            except:
                                pass
                            
                            try:
                                accuracy_raw = mp.Accuracy
                            except:
                                pass
                            
                            doc_data['physical'] = {
                                'mass': round(mass_raw, 6) if mass_raw else None,
                                'area': round(area_raw, 6) if area_raw else None,
                                'volume': round(volume_raw, 9) if volume_raw else None,
                                'density': round(density_raw, 2) if density_raw else None,
                                'accuracy': round(accuracy_raw, 3) if accuracy_raw else None
                            }
                        except Exception as e:
                            doc_data['physical']['_error'] = f'ExtendedMassProperties: {str(e)}'
                    
                    # Segunda tentativa: MassProperties (fallback)
                    if not doc_data.get('physical', {}).get('mass') and hasattr(model, 'MassProperties'):
                        try:
                            mp = model.MassProperties
                            mass_raw = getattr(mp, 'Mass', None)
                            if mass_raw:
                                if not doc_data.get('physical'):
                                    doc_data['physical'] = {}
                                doc_data['physical']['mass'] = round(mass_raw, 6)
                                doc_data['physical']['_source'] = 'MassProperties (fallback)'
                        except:
                            pass
                
                # Terceira tentativa: Extrair de Custom Properties
                # SolidEdge armazena valores formatados como strings: "10096,59 mm^2", "0,167 kg"
                if doc_data.get('customProperties'):
                    custom_props = doc_data.get('customProperties', {})
                    
                    # Helper: extrair número de string formatada
                    def extract_number_from_custom_prop(prop_value_str):
                        """Extrai número de string como '10096,59 mm^2' ou '0,167 kg'"""
                        if not prop_value_str or not isinstance(prop_value_str, str):
                            return None
                        try:
                            # Remove unidades e espaços
                            import re
                            # Procura padrão numérico (com vírgula ou ponto decimal)
                            match = re.search(r'([\d]+[,\.]?[\d]*)', prop_value_str.replace(' ', ''))
                            if match:
                                num_str = match.group(1).replace(',', '.')
                                return float(num_str)
                        except:
                            pass
                        return None
                    
                    # Massa de custom property (geralmente em kg)
                    if not doc_data.get('physical', {}).get('mass'):
                        for prop_name in ['Mass', 'Peso', 'mass', 'peso']:
                            prop_data = custom_props.get(prop_name)
                            if prop_data and prop_data.get('value'):
                                mass_val = extract_number_from_custom_prop(prop_data['value'])
                                if mass_val:
                                    if not doc_data.get('physical'):
                                        doc_data['physical'] = {}
                                    doc_data['physical']['mass'] = round(mass_val, 6)
                                    doc_data['physical']['_source'] = f'Custom Property: {prop_name}'
                                    break
                    
                    # Área de custom property (pode estar em mm² ou m²)
                    if not doc_data.get('physical', {}).get('area'):
                        for prop_name in ['Área_de_superfície', 'Area_de_superficie', 'SurfaceArea', 'Area']:
                            prop_data = custom_props.get(prop_name)
                            if prop_data and prop_data.get('value'):
                                area_str = prop_data['value']
                                area_val = extract_number_from_custom_prop(area_str)
                                if area_val:
                                    # Converte mm² → m²
                                    if 'mm' in area_str.lower():
                                        area_val = area_val / 1_000_000.0  # mm² para m²
                                    
                                    if not doc_data.get('physical'):
                                        doc_data['physical'] = {}
                                    doc_data['physical']['area'] = round(area_val, 6)
                                    doc_data['physical']['_source'] = f'Custom Property: {prop_name}'
                                    break
                
            except Exception as e:
                doc_data['physical']['_error'] = str(e)
            
            
            
            # ========== FLAT PATTERN INFO (.psm files) ==========
            try:
                # Verifica se é SheetMetal document
                file_ext = os.path.splitext(doc_data['basic']['fileName'])[1].lower()
                if file_ext == '.psm':
                    try:
                        if hasattr(doc, 'FlatPatternModels'):
                            fps = doc.FlatPatternModels
                            if fps.Count > 0:
                                fp = fps.Item(1)
                                doc_data['flatPattern'] = {
                                    'exists': True,
                                    'count': fps.Count,
                                    'name': getattr(fp, 'Name', None)
                                }
                                
                                # Tenta pegar dimensões do flat pattern
                                try:
                                    doc_data['flatPattern']['cutSizeX'] = doc_data['variables'].get('Flat_Pattern_Model_CutSizeX', {}).get('value')
                                    doc_data['flatPattern']['cutSizeY'] = doc_data['variables'].get('Flat_Pattern_Model_CutSizeY', {}).get('value')
                                except:
                                    pass
                            else:
                                doc_data['flatPattern'] = {'exists': False, 'reason': 'No flat pattern models'}
                    except Exception as e:
                        doc_data['flatPattern'] = {'error': str(e)}
            except:
                pass
            
            # ========== MATERIAL ==========
            try:
                if hasattr(doc, 'Models') and doc.Models.Count > 0:
                    model = doc.Models.Item(1)
                    doc_data['material'] = getattr(model, 'Material', None)
            except:
                pass
            
            self.send_json(doc_data)
        except Exception as e:
            self.send_json({
                'error': 'Erro ao acessar documento',
                'details': str(e),
                'traceback': traceback.format_exc()
            }, 500)
    
    
    def handle_export_dxf(self, data):
        """Export DXF endpoint"""
        try:
            app = self.get_solidedge()
            
            if not app.ActiveDocument:
                self.send_json({'success': False, 'error': 'Nenhum documento aberto'}, 404)
                return
            
            doc = app.ActiveDocument
            
            if not hasattr(doc, 'Sheets'):
                self.send_json({'success': False, 'error': 'Nao e um Draft'}, 400)
                return
            
            output_path = data.get('outputPath')
            if not output_path:
                base_name = os.path.splitext(doc.FullName)[0]
                output_path = f"{base_name}.dxf"
            
            doc.SaveAs(output_path)
            self.send_json({'success': True, 'filePath': output_path})
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_export_pdf(self, data):
        """Export PDF endpoint"""
        try:
            app = self.get_solidedge()
            
            if not app.ActiveDocument:
                self.send_json({'success': False, 'error': 'Nenhum documento aberto'}, 404)
                return
            
            doc = app.ActiveDocument
            
            output_path = data.get('outputPath')
            if not output_path:
                base_name = os.path.splitext(doc.FullName)[0]
                output_path = f"{base_name}.pdf"
            
            if hasattr(doc, 'SaveAsPDF'):
                doc.SaveAsPDF(output_path)
            else:
                doc.PrintOut(1, output_path, True)
            
            self.send_json({'success': True, 'filePath': output_path})
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)

if __name__ == '__main__':
    import sys
    
    HOST = '0.0.0.0'
    PORT = 8080
    
    # Allow port override via command line: python agent.py 8081
    if len(sys.argv) > 1:
        try:
            PORT = int(sys.argv[1])
        except ValueError:
            print(f"Porta invalida: {sys.argv[1]}. Usando padrao {PORT}.")

    print("=" * 60)
    print("  SolidEdge Agent - MetalFisa v3.1")
    print("  (HTTP Server Nativo - SEM Flask)")
    print("=" * 60)
    print(f"Porta: {PORT}")
    print(f"URL: http://localhost:{PORT}")
    print(f"Rede: http://192.168.1.169:{PORT}")
    print()
    print("IMPORTANTE:")
    print("1. Execute com MESMO nivel de privilegio que SolidEdge")
    print("2. Se SolidEdge esta como Admin, rode como Admin")
    print("=" * 60)
    
    try:
        server = ThreadingHTTPServer((HOST, PORT), SolidEdgeHandler)
        print("\nServidor rodando (Multi-Thread)... Pressione CTRL+C para parar\n")
        server.serve_forever()
    except OSError as e:
        if e.errno == 10048: # Address already in use (Windows)
            print(f"\n[ERRO CRITICO] A porta {PORT} ja esta em uso!")
            print("Solucao 1: Feche o programa que esta usando esta porta.")
            print("Solucao 2: Execute em outra porta. Ex: python agent.py 8081")
        else:
            print(f"\n[ERRO] Falha ao iniciar servidor: {e}")
    except KeyboardInterrupt:
        print("\n\nEncerrando servidor...")
        try:
            server.shutdown()
        except:
            pass
