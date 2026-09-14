import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, Download, TableProperties, Mail } from 'lucide-react';


export default function PPAPsBuscarProduto() {
    const [file, setFile] = useState(null);
    const [sheets, setSheets] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    
    const [isUploading, setIsUploading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Recuperar token para autenticação
    const token = localStorage.getItem('@MetalFisa:token');

    // 1. Lidar com a seleção do arquivo e puxar as abas
    const handleFileChange = async (e) => {
        setError('');
        setSuccess('');
        setSheets([]);
        setSelectedSheet('');
        
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        // Validar extensão
        const validExt = ['xlsx', 'xls'];
        const fileExt = selectedFile.name.split('.').pop().toLowerCase();
        if (!validExt.includes(fileExt)) {
            setError('Por favor, selecione um arquivo Excel válido (.xlsx ou .xls)');
            return;
        }

        setFile(selectedFile);
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await axios.post('/api/ppaps/get-sheets', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            if (response.data.sheets && response.data.sheets.length > 0) {
                setSheets(response.data.sheets);
                setSelectedSheet(response.data.sheets[0]); // Seleciona a primeira por padrão
            } else {
                setError('Nenhuma aba encontrada neste arquivo.');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Erro ao ler abas do arquivo.');
        } finally {
            setIsUploading(false);
        }
    };

    // 2. Processar a planilha
    const handleProcess = async () => {
        if (!file || !selectedSheet) {
            setError('Por favor, selecione um arquivo e uma aba.');
            return;
        }

        setError('');
        setSuccess('');
        setIsProcessing(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('sheetName', selectedSheet);

        try {
            const response = await axios.post('/api/ppaps/process-excel', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
                responseType: 'blob' // Importante para receber arquivos binários
            });

            // Criar URL para download do blob
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `PPAPs_Processado_${file.name}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            
            setSuccess('Planilha processada com sucesso! O download começará automaticamente. Um resumo foi enviado para o seu e-mail.');
        } catch (err) {
            console.error(err);
            // Ao usar responseType: 'blob', o erro vem como blob. Precisamos ler.
            if (err.response && err.response.data instanceof Blob) {
                const text = await err.response.data.text();
                try {
                    const json = JSON.parse(text);
                    setError(json.error || 'Erro ao processar planilha.');
                } catch {
                    setError('Erro ao processar planilha.');
                }
            } else {
                setError('Falha de conexão com o servidor ao processar planilha.');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
            
            <div className="flex-1 flex flex-col h-full overflow-y-auto">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 px-8 py-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-teal-100 text-teal-600 rounded-xl">
                            <FileSpreadsheet className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Buscar Produtos Protheus (PPAPs)</h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Preenchimento automático do "Desenho MetalFisa" a partir do "Desenho Cliente" na coluna E.
                            </p>
                            <p className="text-xs text-amber-600 mt-1 font-medium">
                                Por definição, só preenche produtos já classificados como <strong>PPAP</strong> em algum pedido. Produtos localizados mas sem essa classificação ficam de fora (você recebe o detalhamento por e-mail).
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 md:p-8 w-full max-w-[1920px] mx-auto">
                    
                    {/* Status Alerts */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-red-700 text-sm font-medium">{error}</p>
                        </div>
                    )}
                    
                    {success && (
                        <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-emerald-800 text-sm font-bold">Concluído!</p>
                                <p className="text-emerald-700 text-sm mt-1">{success}</p>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        
                        {/* Passo 1: Upload */}
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <span className="bg-slate-800 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                                Selecionar Arquivo
                            </h2>
                            
                            <label className={`
                                flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                                ${file ? 'border-teal-400 bg-teal-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
                            `}>
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {isUploading ? (
                                        <Loader2 className="w-10 h-10 text-teal-500 animate-spin mb-3" />
                                    ) : file ? (
                                        <FileSpreadsheet className="w-10 h-10 text-teal-600 mb-3" />
                                    ) : (
                                        <Upload className="w-10 h-10 text-gray-400 mb-3" />
                                    )}
                                    
                                    <p className="mb-2 text-sm text-gray-500">
                                        {file ? (
                                            <span className="font-semibold text-teal-700">{file.name}</span>
                                        ) : (
                                            <>
                                                <span className="font-semibold">Clique para fazer upload</span> ou arraste e solte
                                            </>
                                        )}
                                    </p>
                                    <p className="text-xs text-gray-400">XLSX, XLS</p>
                                </div>
                                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                            </label>
                        </div>

                        {/* Passo 2: Configuração */}
                        {sheets.length > 0 && (
                            <div className="p-6 bg-slate-50">
                                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="bg-slate-800 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                                    Configurações
                                </h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                            <TableProperties className="w-4 h-4 text-slate-400" />
                                            Aba de Trabalho
                                        </label>
                                        <select
                                            value={selectedSheet}
                                            onChange={(e) => setSelectedSheet(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-teal-500 focus:border-teal-500 shadow-sm"
                                        >
                                            {sheets.map((sheet, idx) => (
                                                <option key={idx} value={sheet}>{sheet}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                                        <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                                            <Mail className="w-4 h-4" /> Notificação Automática
                                        </h3>
                                        <p className="text-xs text-blue-600 leading-relaxed">
                                            Ao finalizar o processamento, enviaremos um resumo por e-mail informando as linhas preenchidas, linhas não encontradas e detalhando as duplicidades identificadas no Protheus.
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="mt-8 flex justify-end">
                                    <button
                                        onClick={handleProcess}
                                        disabled={isProcessing}
                                        className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Processando Protheus...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-5 h-5" />
                                                Processar e Baixar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                        
                    </div>
                </div>
            </div>
        </div>
    );
}
