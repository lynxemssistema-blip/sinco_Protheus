import React, { useState, useEffect } from 'react';
import { 
  MonitorPlay, 
  RefreshCw, 
  Box, 
  Settings, 
  Scale, 
  Layers, 
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Info
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';

// O Agente local rodará na porta 3005 por padrão
const AGENT_URL = 'http://localhost:3005';

const SWorks = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  const [activeDoc, setActiveDoc] = useState(null);
  const [customProps, setCustomProps] = useState([]);
  const [massProps, setMassProps] = useState(null);
  const [errorDetails, setErrorDetails] = useState('');

  // Verifica se o agente local está rodando ao montar o componente
  useEffect(() => {
    checkConnection();
    // Intervalo para checar a conexão a cada 5 segundos
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      const response = await axios.get(`${AGENT_URL}/api/status`, { timeout: 2000 });
      if (response.data.status === 'connected') {
        setIsConnected(true);
        setErrorDetails('');
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      setIsConnected(false);
      // Não mostra toast aqui para não floodar a tela com erros de polling silencioso
    } finally {
      setIsChecking(false);
    }
  };

  const handleFetchData = async () => {
    if (!isConnected) {
      toast.error('Agente Local não conectado.');
      return;
    }

    setIsLoadingData(true);
    setErrorDetails('');
    
    try {
      // 1. Fetch Status do Documento
      const statusRes = await axios.get(`${AGENT_URL}/api/status`);
      if (statusRes.data.status !== 'connected' || !statusRes.data.documentoAberto) {
        toast.warning('Nenhum documento aberto no SolidWorks.');
        setActiveDoc(null);
        setCustomProps([]);
        setMassProps(null);
        setIsLoadingData(false);
        return;
      }
      setActiveDoc(statusRes.data.arquivoNome);

      // 2. Fetch Custom Properties
      const propsRes = await axios.get(`${AGENT_URL}/api/properties`);
      if (propsRes.data.success) {
        setCustomProps(propsRes.data.propriedades || []);
      }

      // 3. Fetch Mass Properties (Geometria)
      const massRes = await axios.get(`${AGENT_URL}/api/geometry`);
      if (massRes.data.success) {
        setMassProps(massRes.data.geometria);
      }

      toast.success('Dados do SolidWorks lidos com sucesso!');
    } catch (error) {
      console.error('Erro ao ler dados do SW:', error);
      let errMsg = 'Erro desconhecido ao comunicar com o agente.';
      if (error.response?.data?.message) {
        errMsg = error.response.data.message;
      } else if (error.message) {
        errMsg = error.message;
      }
      setErrorDetails(errMsg);
      toast.error('Falha ao ler dados do SolidWorks.');
    } finally {
      setIsLoadingData(false);
    }
  };

  // UI Components Internos
  const AgentInstructions = () => (
    <div className="bg-slate-800 border-l-4 border-blue-500 rounded-lg p-6 shadow-md mb-6 transition-all">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-blue-500/20 text-blue-400 rounded-full shrink-0">
          <Download size={24} />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
            Agente Local Necessário
            <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded font-normal font-mono">v1.0.0</span>
          </h3>
          <p className="text-slate-300 leading-relaxed mb-4">
            Como esta interface roda na web, ela não tem permissão para acessar o SolidWorks diretamente no seu computador.
            Para fazer a ponte, você precisa baixar e executar o nosso <strong>Agente Metalfisa-SW</strong>.
          </p>
          
          <div className="bg-slate-900 rounded border border-slate-700 p-4 font-mono text-sm text-slate-300 mb-4">
            <ol className="list-decimal list-inside space-y-2">
              <li>Faça o download do executável do agente no botão abaixo.</li>
              <li>Extraia e execute o arquivo <code>start-sw-agent.bat</code> (ou <code>sw-agent.exe</code>).</li>
              <li>Mantenha a janela do terminal aberta.</li>
              <li>Certifique-se que o SolidWorks está aberto com um arquivo carregado.</li>
              <li>Aguarde alguns segundos e esta tela se conectará automaticamente.</li>
            </ol>
          </div>

          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded shadow-sm transition-colors font-medium">
            <Download size={18} />
            Baixar Agente SolidWorks
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 border border-slate-200 rounded-xl overflow-hidden print:border-none p-1 shadow-sm">
      {/* HEADER SECTION */}
      <div className="bg-slate-900 px-6 py-5 flex items-center justify-between shadow-md mb-6 rounded-t-lg mx-[-4px] mt-[-4px]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500 rounded-lg shadow-lg">
            <Box className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight leading-none mb-1">
              SolidWorks <span className="text-blue-400 font-light">Connect</span>
            </h1>
            <p className="text-slate-400 text-sm">Leitura de Meta-Dados e Geometria em Tempo Real</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-inner transition-colors ${
              isChecking ? 'bg-slate-800 border-slate-700 text-slate-400' :
              isConnected ? 'bg-green-500/10 border-green-500/30 text-green-400' : 
              'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {isChecking ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isConnected ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            <span className="text-sm font-semibold tracking-wide uppercase">
              {isChecking ? 'Verificando...' : isConnected ? 'Conectado. Agente Ativo.' : 'Desconectado'}
            </span>
          </div>

          {/* Refresh Button */}
             <button
            onClick={handleFetchData}
            disabled={!isConnected || isLoadingData}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg shadow-md font-semibold transition-all ${
              isConnected && !isLoadingData
                ? 'bg-blue-600 hover:bg-blue-500 text-white transform hover:-translate-y-0.5' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed hidden'
            }`}
          >
            {isLoadingData ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <MonitorPlay className="w-5 h-5" />
            )}
            Ler Arquivo Ativo
          </button>
        </div>
      </div>

      <div className="px-4 pb-8">
        
        {/* INSTRUCTIONS IF DISCONNECTED */}
        {!isConnected && !isChecking && <AgentInstructions />}

        {/* ERROR MESSAGES */}
        {errorDetails && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r shadow-sm flex items-start gap-3">
             <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20}/>
             <div>
                <h4 className="text-red-800 font-bold text-sm">Erro na Leitura</h4>
                <p className="text-red-600 text-sm mt-1 font-mono">{errorDetails}</p>
             </div>
          </div>
        )}

        {/* ACTIVE DOCUMENT BANNER */}
        {activeDoc && (
           <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-center justify-between shadow-sm mb-6">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-yellow-100 rounded-md text-yellow-700">
                    <FileText size={20} />
                 </div>
                 <div>
                    <h4 className="text-xs uppercase font-bold text-yellow-800 tracking-wider">Documento Aberto no SolidWorks</h4>
                    <p className="text-yellow-900 font-mono text-lg font-bold">{activeDoc}</p>
                 </div>
              </div>
           </div>
        )}

        {/* RESULTS GRID */}
        {(customProps.length > 0 || massProps) && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* GEOMETRIC PROPERTIES CARD */}
            {massProps && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col items-center justify-center p-8">
                <div className="w-full flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded">
                    <Scale size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Geometria e Material</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full h-full">
                  {/* Peso */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col justify-center">
                     <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                        <Scale size={14}/> Peso Calculado (Massa)
                     </span>
                     <span className="text-3xl font-bold text-indigo-700">
                        {massProps.massa_kg ? massProps.massa_kg.toFixed(3) : '0.000'} <span className="text-lg text-slate-400 font-normal">kg</span>
                     </span>
                  </div>

                  {/* Area */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col justify-center">
                     <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                        <Layers size={14}/> Área de Superfície (Pintura)
                     </span>
                     <span className="text-3xl font-bold text-teal-600">
                        {massProps.area_m2 ? massProps.area_m2.toFixed(4) : '0.000'} <span className="text-lg text-slate-400 font-normal">m²</span>
                     </span>
                  </div>
                  
                  {/* Volume */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 col-span-2 flex justify-between items-center">
                     <div>
                        <span className="text-xs font-bold text-slate-500 uppercase mb-1 block">Volume Total</span>
                        <span className="text-xl font-bold text-slate-700">
                            {massProps.volume_m3 ? massProps.volume_m3.toFixed(6) : '0.000000'} <span className="text-sm text-slate-400 font-normal">m³</span>
                        </span>
                     </div>
                     <div className="text-right">
                        <span className="text-xs font-bold text-slate-500 uppercase mb-1 block">Densidade</span>
                        <span className="text-xl font-bold text-slate-700">
                            {massProps.densidade_kg_m3 ? massProps.densidade_kg_m3.toFixed(2) : '0.00'} <span className="text-sm text-slate-400 font-normal">kg/m³</span>
                        </span>
                     </div>
                  </div>

                </div>
              </div>
            )}

            {/* CUSTOM PROPERTIES CARD */}
            {customProps.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded">
                    <Settings size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Propriedades Customizadas</h3>
                  <span className="ml-auto bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">
                     {customProps.length} Propriedades
                  </span>
                </div>
                
                <div className="p-0 overflow-auto max-h-[400px]">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-3 font-semibold text-slate-600 border-b border-slate-200 w-1/3">Nome da Propriedade</th>
                        <th className="px-6 py-3 font-semibold text-slate-600 border-b border-slate-200 w-2/3">Valor Resolvido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customProps.map((prop, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-2.5 font-medium text-slate-700">{prop.nome}</td>
                          <td className="px-6 py-2.5 font-mono text-slate-600">
                             {prop.valorResolvido || <span className="text-slate-300 italic">Vazio</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {customProps.length === 0 && (
                   <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                      <Info size={32} className="mb-2 opacity-50"/>
                      Nenhuma propriedade customizada encontrada neste arquivo.
                   </div>
                )}
              </div>
            )}
            
          </div>
        )}

      </div>
    </div>
  );
};

export default SWorks;
