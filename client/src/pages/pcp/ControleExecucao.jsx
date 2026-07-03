import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { 
    Play, Square, CheckCircle, Clock, Search, Filter, 
    TrendingUp, BarChart2, Factory, User, Check, AlertTriangle, 
    Calendar, RefreshCw, Plus, ArrowLeftRight, Octagon, Zap, X, RotateCcw,
    Truck, Download, Building, FileText, Table
} from 'lucide-react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { logoBase64 } from '../../services/metalfisaLogoBase64';
import { addWorkingTime, jumpToNextShift, getTurnoForTime, getNextWorkingTime, toSecs, sortTurnos } from '../../utils/timeProjectionUtils';

// Auxiliares de tempo
function formatSeconds(totalSecs) {
    if (isNaN(totalSecs) || totalSecs < 0) return '00:00:00';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return [
        String(hrs).padStart(2, '0'),
        String(mins).padStart(2, '0'),
        String(secs).padStart(2, '0')
    ].join(':');
}

const parseLocal = (dateStr) => {
    if (!dateStr) return null;
    return typeof dateStr === 'string' ? new Date(dateStr.replace('Z', '')) : new Date(dateStr);
};

function hhmmssToSeconds(str) {
    if (!str) return 0;
    const parts = str.split(':');
    const hrs = parseInt(parts[0]) || 0;
    const mins = parseInt(parts[1]) || 0;
    const secs = parseInt(parts[2]) || 0;
    return (hrs * 3600) + (mins * 60) + secs;
}

const formatClockTime = (dateStr) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
        return '';
    }
};

// Lista padrão de motivos de parada
const MOTIVOS_PARADA = [
    "Ajuste de Máquina / Setup",
    "Troca de Bocal / Consumível",
    "Manutenção Mecânica",
    "Manutenção Elétrica",
    "Aguardando Empilhadeira / Material",
    "Aguardando Programação / PCP",
    "Limpeza / Organização",
    "Outro (Descrever nas observações)"
];

export default function ControleExecucao() {
    const { user } = useAuth();
    
    // UI State
    const [activeTab, setActiveTab] = useState('operador'); // 'operador' ou 'relatorio'
    const [loadingMaquinas, setLoadingMaquinas] = useState(true);
    const [maquinas, setMaquinas] = useState([]);
    const [selectedMaquinaId, setSelectedMaquinaId] = useState('todas');
    
    // Operator Panel State
    const [programas, setProgramas] = useState([]);
    const [loadingProgramas, setLoadingProgramas] = useState(false);
    const [execucoes, setExecucoes] = useState({}); // programa_id -> lista de execucoes
    const [paradas, setParadas] = useState({}); // programa_id -> lista de paradas
    const [searchQuery, setSearchQuery] = useState('');
    const [operatorName, setOperatorName] = useState('');
    const [showConcluidos, setShowConcluidos] = useState(false);
    
    // Recebimento Form State
    const [signingProgId, setSigningProgId] = useState(null);
    const [signForm, setSignForm] = useState({
        recebedor_nome: '',
        recebido_data: new Date().toISOString().substring(0, 10),
        recebido_hora: new Date().toLocaleTimeString('pt-BR', { hour12: false }).substring(0, 5),
        notas_instrucoes: ''
    });

    // Parada Form State (Modal/Modal Inline)
    const [reportingParada, setReportingParada] = useState(null); // { progId, chapaNum }
    const [apontamentoProg, setApontamentoProg] = useState(null);
    const [chapaFilter, setChapaFilter] = useState('PENDENTES_ANDAMENTO_PARADAS');

    const [paradaForm, setParadaForm] = useState({
        motivo: MOTIVOS_PARADA[0],
        observacoes: ''
    });

    // Terceirização Form State
    const [terceirizacaoProg, setTerceirizacaoProg] = useState(null);
    const [terceirizacaoForm, setTerceirizacaoForm] = useState({
        tipo_execucao: 'INTERNA',
        terceirizado_empresa: '',
        terceirizado_escopo: '',
        terceirizado_data_envio: '',
        terceirizado_data_retorno: ''
    });

    // Relatório State
    const [loadingRelatorio, setLoadingRelatorio] = useState(false);
    const [relatorioData, setRelatorioData] = useState([]);
    const [relFilterMaquina, setRelFilterMaquina] = useState('');
    const [relFilterTurno, setRelFilterTurno] = useState('');
    const [relSearchQuery, setRelSearchQuery] = useState('');
    const [relFilterTerceirizado, setRelFilterTerceirizado] = useState('TODOS'); // 'TODOS', 'INTERNA', 'TERCEIRIZADA'
    const [relFilterDataPlanejada, setRelFilterDataPlanejada] = useState('');

    const [turnos, setTurnos] = useState([]);

    // Timer Global para atualizar cronômetros em tempo real
    const [now, setNow] = useState(new Date());
    const [fetchTime, setFetchTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Set default operator name from logged user
    useEffect(() => {
        if (user) {
            setOperatorName(user.NomeCompleto || user.nome || '');
        }
    }, [user]);

    // Carregar Turnos
    useEffect(() => {
        api.get('/pcp/programas/turnos').then(res => setTurnos(res.data)).catch(console.error);
    }, []);

    // Carregar máquinas no início
    useEffect(() => {
        const fetchMaquinas = async () => {
            try {
                setLoadingMaquinas(true);
                const res = await api.get('/manutencao/maquinas');
                setMaquinas(res.data.filter(m => m.status === 'ATIVO'));
            } catch (err) {
                console.error("Erro ao carregar máquinas:", err);
                toast.error("Erro ao carregar máquinas do parque fabril.");
            } finally {
                setLoadingMaquinas(false);
            }
        };
        fetchMaquinas();
    }, []);

    // Carregar programas quando a máquina for alterada
    useEffect(() => {
        loadProgramasMaquina(selectedMaquinaId || 'todas');
    }, [selectedMaquinaId]);

    const loadProgramasMaquina = async (maquinaId) => {
        try {
            setLoadingProgramas(true);
            const res = await api.get(`/pcp/programas/maquina/${maquinaId}`);
            setProgramas(res.data);
            
            // Carregar execuções e paradas para cada programa
            const execsObj = {};
            const paradasObj = {};
            
            await Promise.all(res.data.map(async (prog) => {
                try {
                    const execRes = await api.get(`/pcp/programas/${prog.id}/execucoes`);
                    execsObj[prog.id] = execRes.data;
                } catch (e) {
                    console.error(`Erro ao carregar execuções:`, e);
                    execsObj[prog.id] = [];
                }

                try {
                    const paradasRes = await api.get(`/pcp/programas/${prog.id}/paradas`);
                    paradasObj[prog.id] = paradasRes.data;
                } catch (e) {
                    console.error(`Erro ao carregar paradas:`, e);
                    paradasObj[prog.id] = [];
                }
            }));
            
            setExecucoes(execsObj);
            setParadas(paradasObj);
            setFetchTime(new Date());
        } catch (err) {
            console.error("Erro ao carregar programas:", err);
            toast.error("Erro ao buscar programas da máquina.");
        } finally {
            setLoadingProgramas(false);
        }
    };

    // Carregar Relatório Comparativo
    const loadRelatorio = async () => {
        try {
            setLoadingRelatorio(true);
            const res = await api.get('/pcp/programas/relatorio-horas');
            setRelatorioData(res.data);
        } catch (err) {
            console.error("Erro ao carregar relatório:", err);
            toast.error("Erro ao gerar relatório comparativo.");
        } finally {
            setLoadingRelatorio(false);
        }
    };

    // Recarregar aba ativa
    useEffect(() => {
        if (activeTab === 'relatorio') {
            loadRelatorio();
        } else if (activeTab === 'operador' && selectedMaquinaId) {
            loadProgramasMaquina(selectedMaquinaId);
        }
    }, [activeTab]);

    // Iniciar chapa
    const handleStartChapa = async (progId, chapaNum) => {
        const activeName = operatorName.trim() || 'Operador';
        try {
            await api.post(`/pcp/programas/${progId}/execucoes/iniciar`, {
                chapa_numero: chapaNum,
                usuario_apontamento: activeName
            });
            toast.success(`Chapa ${chapaNum} iniciada com sucesso!`);
            loadProgramasMaquina(selectedMaquinaId);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Erro ao iniciar chapa.");
        }
    };

    // Concluir chapa
    const handleConcludeChapa = async (progId, chapaNum) => {
        try {
            // Verificar se há alguma parada ativa nesta chapa e fechá-la primeiro
            const progParadas = paradas[progId] || [];
            const activeParada = progParadas.find(p => p.chapa_numero === chapaNum && p.status === 'EM_ANDAMENTO');
            if (activeParada) {
                await api.put(`/pcp/programas/${progId}/paradas/concluir`, { chapa_numero: chapaNum });
            }

            const res = await api.put(`/pcp/programas/${progId}/execucoes/concluir`, {
                chapa_numero: chapaNum
            });
            toast.success(`Chapa ${chapaNum} concluída! Tempo: ${formatSeconds(res.data.tempo_realizado_segundos)}`);
            loadProgramasMaquina(selectedMaquinaId);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Erro ao concluir chapa.");
        }
    };

    // Cancelar e reiniciar chapa
    const handleCancelChapa = async (progId, chapaNum) => {
        if (!window.confirm(`Deseja realmente cancelar e reiniciar o apontamento da chapa ${chapaNum}? Os tempos de corte e pausas registrados para ela serão excluídos permanentemente.`)) {
            return;
        }

        try {
            await api.post(`/pcp/programas/${progId}/execucoes/cancelar`, {
                chapa_numero: chapaNum
            });
            toast.info(`Apontamento da chapa ${chapaNum} reiniciado com sucesso.`);
            
            // Recarregar dados locais
            await loadProgramasMaquina(selectedMaquinaId);
            
            // Atualizar o modal ativo para refletir a alteração de status/tempos
            const res = await api.get(`/pcp/programas/maquina/${selectedMaquinaId}`);
            const updatedProg = res.data.find(p => p.id === progId);
            if (updatedProg) {
                setApontamentoProg(updatedProg);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Erro ao reiniciar chapa.");
        }
    };

    // Iniciar Parada (Pausar máquina)
    const handleStartParada = async (e) => {
        e.preventDefault();
        const { progId, chapaNum } = reportingParada;
        const activeName = operatorName.trim() || 'Operador';
        
        try {
            await api.post(`/pcp/programas/${progId}/paradas/iniciar`, {
                chapa_numero: chapaNum,
                usuario_apontamento: activeName,
                motivo: paradaForm.motivo,
                observacoes: paradaForm.observacoes
            });
            toast.warning(`Parada por "${paradaForm.motivo}" registrada para a chapa ${chapaNum}.`);
            setReportingParada(null);
            setParadaForm({ motivo: MOTIVOS_PARADA[0], observacoes: '' });
            loadProgramasMaquina(selectedMaquinaId);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Erro ao registrar parada.");
        }
    };

    // Concluir Parada (Retomar corte)
    const handleConcludeParada = async (progId, chapaNum) => {
        try {
            const res = await api.put(`/pcp/programas/${progId}/paradas/concluir`, {
                chapa_numero: chapaNum
            });
            toast.success(`Corte retomado! Tempo parada: ${formatSeconds(res.data.tempo_segundos)}`);
            loadProgramasMaquina(selectedMaquinaId);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Erro ao retomar corte.");
        }
    };

    // Abrir formulário de recebimento
    const handleOpenSign = (prog) => {
        setSigningProgId(prog.id);
        setSignForm({
            recebedor_nome: operatorName || prog.recebedor_nome || '',
            recebido_data: new Date().toISOString().substring(0, 10),
            recebido_hora: new Date().toLocaleTimeString('pt-BR', { hour12: false }).substring(0, 5),
            notas_instrucoes: prog.notas_instrucoes || ''
        });
    };

    // Salvar recebimento do programa
    const handleSaveSign = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/pcp/programas/${signingProgId}`, signForm);
            toast.success("Recebimento do programa assinado com sucesso!");
            setSigningProgId(null);
            loadProgramasMaquina(selectedMaquinaId);
        } catch (err) {
            console.error(err);
            toast.error("Erro ao salvar assinatura de recebimento.");
        }
    };

    // Abrir Modal de Terceirização
    const handleOpenTerceirizacao = (prog) => {
        setTerceirizacaoProg(prog);
        setTerceirizacaoForm({
            tipo_execucao: prog.tipo_execucao || 'INTERNA',
            terceirizado_empresa: prog.terceirizado_empresa || '',
            terceirizado_escopo: prog.terceirizado_escopo || '',
            terceirizado_data_envio: prog.terceirizado_data_envio ? new Date(prog.terceirizado_data_envio).toISOString().substring(0, 10) : '',
            terceirizado_data_retorno: prog.terceirizado_data_retorno ? new Date(prog.terceirizado_data_retorno).toISOString().substring(0, 10) : ''
        });
    };

    // Salvar Terceirização
    const handleSaveTerceirizacao = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/pcp/programas/${terceirizacaoProg.id}/terceirizacao`, terceirizacaoForm);
            toast.success("Dados de terceirização salvos com sucesso!");
            setTerceirizacaoProg(null);
            loadProgramasMaquina(selectedMaquinaId);
        } catch (err) {
            console.error(err);
            toast.error("Erro ao salvar dados de terceirização.");
        }
    };

    // Exportar Relatório Excel
    const handleExportRelatorio = () => {
        if (!filteredRelatorio || filteredRelatorio.length === 0) {
            toast.warning("Nenhum dado para exportar.");
            return;
        }

        const dataToExport = filteredRelatorio.map(r => ({
            "Equipamento": r.maquina_nome,
            "Programa": r.nome_programa,
            "Turno": `Turno ${r.turno_previsao}`,
            "Status": r.status,
            "Chapas Concluídas": `${r.chapas_concluidas} de ${r.total_chapas}`,
            "Tempo Previsto": r.tempo_previsto_total,
            "Tempo Realizado": r.tempo_realizado_total,
            "Tempo Parado": r.tempo_parada_total,
            "Eficiência Bruta (%)": r.eficiencia,
            "Eficiência Líquida (%)": r.eficiencia_liquida,
            "Tipo Execução": r.tipo_execucao || 'INTERNA',
            "Empresa Terceirizada": r.terceirizado_empresa || '-',
            "Data Envio": r.terceirizado_data_envio ? new Date(r.terceirizado_data_envio).toLocaleDateString('pt-BR') : '-',
            "Data Retorno": r.terceirizado_data_retorno ? new Date(r.terceirizado_data_retorno).toLocaleDateString('pt-BR') : '-',
            "Escopo": r.terceirizado_escopo || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatório Técnico");
        XLSX.writeFile(wb, `Relatorio_Tecnico_PCP_${new Date().getTime()}.xlsx`);
    };

    // Filtragem de programas do operador
    const filteredProgramas = useMemo(() => {
        return programas.filter(p => {
            const matchesQuery = p.nome_programa.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 p.tipo_material.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = showConcluidos ? true : p.status !== 'CONCLUIDO';
            return matchesQuery && matchesStatus;
        });
    }, [programas, searchQuery, showConcluidos]);

    // Filtragem do relatório
    const filteredRelatorio = useMemo(() => {
        return relatorioData.filter(r => {
            const matchesMaquina = relFilterMaquina ? String(r.maquina_nome) === String(relFilterMaquina) : true;
            const matchesTurno = relFilterTurno ? String(r.turno_previsao) === String(relFilterTurno) : true;
            const matchesSearch = relSearchQuery ? 
                r.nome_programa.toLowerCase().includes(relSearchQuery.toLowerCase()) ||
                r.maquina_nome.toLowerCase().includes(relSearchQuery.toLowerCase())
                : true;
                
            const matchesTerceirizado = relFilterTerceirizado === 'TODOS' ? true :
                relFilterTerceirizado === 'TERCEIRIZADA' ? r.tipo_execucao === 'TERCEIRIZADA' :
                (r.tipo_execucao === 'INTERNA' || !r.tipo_execucao);
                
            const matchesDataPlanejada = relFilterDataPlanejada ? 
                (r.data_criacao && r.data_criacao.substring(0, 10) === relFilterDataPlanejada) : true;
                
            return matchesMaquina && matchesTurno && matchesSearch && matchesTerceirizado && matchesDataPlanejada;
        });
    }, [relatorioData, relFilterMaquina, relFilterTurno, relSearchQuery, relFilterTerceirizado, relFilterDataPlanejada]);

    // Obter lista única de máquinas do relatório para filtros
    const relMaquinasList = useMemo(() => {
        const names = relatorioData.map(r => r.maquina_nome);
        return [...new Set(names)];
    }, [relatorioData]);

    // Estatísticas gerais para o topo do relatório
    const stats = useMemo(() => {
        const total = filteredRelatorio.length;
        const concluido = filteredRelatorio.filter(r => r.status === 'CONCLUIDO').length;
        const totalChapas = filteredRelatorio.reduce((acc, r) => acc + r.chapas_concluidas, 0);
        
        let sumPrevSeconds = 0;
        let sumRealSeconds = 0;
        let sumParadaSeconds = 0;
        
        filteredRelatorio.forEach(r => {
            // Conversão manual do tempo previsto total do relatório para somar
            const parts = r.tempo_previsto_total.split(':');
            const sec = (parseInt(parts[0]) || 0) * 3600 + (parseInt(parts[1]) || 0) * 60 + (parseInt(parts[2]) || 0);
            sumPrevSeconds += sec;
            
            // Somar realizado total
            const realParts = r.tempo_realizado_total.split(':');
            const rSec = (parseInt(realParts[0]) || 0) * 3600 + (parseInt(realParts[1]) || 0) * 60 + (parseInt(realParts[2]) || 0);
            sumRealSeconds += rSec;

            // Somar parado total
            const paradaParts = r.tempo_parada_total.split(':');
            const pSec = (parseInt(paradaParts[0]) || 0) * 3600 + (parseInt(paradaParts[1]) || 0) * 60 + (parseInt(paradaParts[2]) || 0);
            sumParadaSeconds += pSec;
        });

        const eficienciaGeral = sumPrevSeconds > 0 && sumRealSeconds > 0 
            ? Math.round((sumPrevSeconds / sumRealSeconds) * 100) 
            : 0;

        const sumLiquidoSeconds = Math.max(0, sumRealSeconds - sumParadaSeconds);
        const eficienciaLiquidaGeral = sumPrevSeconds > 0 && sumLiquidoSeconds > 0
            ? Math.round((sumPrevSeconds / sumLiquidoSeconds) * 100)
            : 0;

        return {
            total,
            concluido,
            totalChapas,
            tempoPrevisto: formatSeconds(sumPrevSeconds),
            tempoRealizado: formatSeconds(sumRealSeconds),
            tempoParado: formatSeconds(sumParadaSeconds),
            eficienciaGeral,
            eficienciaLiquidaGeral
        };
    }, [filteredRelatorio]);

    const activeMaquina = useMemo(() => {
        return maquinas.find(m => String(m.id) === String(selectedMaquinaId));
    }, [maquinas, selectedMaquinaId]);

    const hoursToExecuteSummary = useMemo(() => {
        const hoursByMachine = {};
        let totalGlobalRem = 0;
        
        filteredProgramas.forEach(prog => {
            if (prog.status === 'CONCLUIDO') return;
            
            const mName = prog.maquina_nome || `Máquina #${prog.maquina_id}`;
            if (!hoursByMachine[mName]) {
                hoursByMachine[mName] = { remSecs: 0, progCount: 0 };
            }
            
            const progExecs = execucoes[prog.id] || [];
            const concludedCount = progExecs.filter(e => e.status === 'CONCLUIDA').length;
            const pendingChapas = Math.max(0, prog.quantidade_vezes - concludedCount);
            
            const tSecs = hhmmssToSeconds(prog.tempo_previsto);
            const rem = pendingChapas * tSecs;
            hoursByMachine[mName].remSecs += rem;
            hoursByMachine[mName].progCount += 1;
            totalGlobalRem += rem;
            
            // Separar terceirizados
            if (prog.tipo_execucao === 'TERCEIRIZADA') {
                if (!hoursByMachine['TERCEIRIZADOS']) {
                    hoursByMachine['TERCEIRIZADOS'] = { remSecs: 0, progCount: 0 };
                }
                hoursByMachine['TERCEIRIZADOS'].remSecs += rem;
                hoursByMachine['TERCEIRIZADOS'].progCount += 1;
            }
        });
        
        return { byMachine: hoursByMachine, totalGlobalRem };
    }, [filteredProgramas, execucoes]);

    const handleExportExcel = () => {
        try {
            const dataToExport = filteredProgramas.map(prog => {
                const progExecs = execucoes[prog.id] || [];
                const concludedCount = progExecs.filter(e => e.status === 'CONCLUIDA').length;
                const tempoPrev = formatSeconds(prog.quantidade_vezes * hhmmssToSeconds(prog.tempo_previsto));
                
                let tempoExecutadoTotal = 0;
                progExecs.forEach(e => {
                    if (e.status === 'CONCLUIDA') {
                        tempoExecutadoTotal += e.tempo_realizado_segundos || 0;
                    }
                });

                return {
                    "ID": prog.id,
                    "Status": prog.status,
                    "Programa": prog.nome_programa,
                    "Data Liberação": prog.created_at ? new Date(prog.created_at).toLocaleDateString('pt-BR') : '',
                    "Equipamento": prog.maquina_nome || `Máquina ${prog.maquina_id}`,
                    "Material": prog.tipo_material,
                    "Chapas Concluídas": concludedCount,
                    "Total Chapas": prog.quantidade_vezes,
                    "Tempo Previsto (Lote)": tempoPrev,
                    "Tempo Realizado (Lote)": formatSeconds(tempoExecutadoTotal),
                    "Criado Por": prog.criado_por
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "PCP");
            XLSX.writeFile(workbook, `Relatorio_PCP_${new Date().toISOString().slice(0,10)}.xlsx`);
            toast.success("Excel gerado com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao gerar Excel.");
        }
    };

    const handleExportPDF = () => {
        try {
            const doc = new jsPDF('landscape');
            
            // Header MetalFisa
            doc.setFillColor(30, 58, 95);
            doc.rect(14, 10, 42, 24, 'F');
            doc.addImage(logoBase64, 'PNG', 16, 12, 14, 14);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text('METALFISA', 32, 21);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.text('Metalúrgica Ltda', 32, 25.5);
            
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text('Relatório de Controle de Execução (PCP)', 60, 20);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, 60, 26);
            
            if (selectedMaquinaId !== 'todas') {
                const maq = maquinas.find(m => String(m.id) === String(selectedMaquinaId));
                if (maq) doc.text(`Máquina: ${maq.nome}`, 60, 31);
            }
            
            doc.text(`Data Base: ${new Date().toLocaleDateString('pt-BR')}`, doc.internal.pageSize.getWidth() - 14, 20, { align: 'right' });
            
            doc.setDrawColor(200, 200, 200);
            doc.line(14, 38, doc.internal.pageSize.getWidth() - 14, 38);
            
            const tableColumn = ["ID", "Status", "Programa", "Data Lib.", "Máquina", "Material", "Prev. Chapas", "Tempo Previsto", "Tempo Executado"];
            const tableRows = [];
            
            filteredProgramas.forEach(prog => {
                const progExecs = execucoes[prog.id] || [];
                const concludedCount = progExecs.filter(e => e.status === 'CONCLUIDA').length;
                const tempoPrev = formatSeconds(prog.quantidade_vezes * hhmmssToSeconds(prog.tempo_previsto));
                
                let tempoExecutadoTotal = 0;
                progExecs.forEach(e => {
                    if (e.status === 'CONCLUIDA') {
                        tempoExecutadoTotal += e.tempo_realizado_segundos || 0;
                    }
                });

                tableRows.push([
                    `#${prog.id}`,
                    prog.status,
                    prog.nome_programa,
                    prog.created_at ? new Date(prog.created_at).toLocaleDateString('pt-BR') : '',
                    prog.maquina_nome || `Máquina ${prog.maquina_id}`,
                    prog.tipo_material,
                    `${concludedCount} / ${prog.quantidade_vezes}`,
                    tempoPrev,
                    formatSeconds(tempoExecutadoTotal)
                ]);
            });
            
            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 42,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 58, 95] } 
            });
            
            doc.save(`Relatorio_PCP_${new Date().toISOString().slice(0,10)}.pdf`);
            toast.success("PDF gerado com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao gerar PDF.");
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            
            {/* Header com estilo moderno */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="z-10">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">PCP - Controle de Execução</h1>
                    <p className="text-xs md:text-sm text-slate-400 mt-1">Apontamento de corte chapa a chapa, tempos de parada e análise OEE</p>
                </div>
                
                {/* Controles de Aba */}
                <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700 z-10">
                    <button
                        onClick={() => setActiveTab('operador')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                            activeTab === 'operador' 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Play size={14} /> Painel do Operador
                    </button>
                    <button
                        onClick={() => setActiveTab('relatorio')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                            activeTab === 'relatorio' 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <BarChart2 size={14} /> Comparativo de Horas
                    </button>
                </div>
            </div>

            {/* CONTEÚDO DA ABA: PAINEL DO OPERADOR */}
            {activeTab === 'operador' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Barra de Filtros Unificada do Operador */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row items-center gap-4">
                        {/* Nome do Operador */}
                        <div className="relative w-full lg:w-72">
                            <input
                                type="text"
                                value={operatorName}
                                onChange={(e) => setOperatorName(e.target.value)}
                                placeholder="Operador do Turno..."
                                className="w-full text-xs border border-slate-300 rounded-xl pl-9 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-700 bg-slate-50/50"
                            />
                            <User size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                        </div>

                        {/* Seleção de Equipamento */}
                        <div className="w-full lg:w-64">
                            <select
                                value={selectedMaquinaId}
                                onChange={(e) => setSelectedMaquinaId(e.target.value)}
                                className="w-full text-xs border border-slate-300 rounded-xl p-3 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                            >
                                <option value="todas">Todas as Máquinas (Geral)</option>
                                {maquinas.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.nome} {m.tag_identificacao ? `[${m.tag_identificacao}]` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Busca Textual */}
                        <div className="relative flex-1 w-full">
                            <input
                                type="text"
                                placeholder="Buscar por programa ou material..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full text-xs border border-slate-300 rounded-xl pl-9 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700"
                            />
                            <Search size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                        </div>

                        {/* Filtro/Status Concluídos */}
                        <div className="w-full lg:w-auto flex items-center">
                            <label className="flex items-center cursor-pointer select-none text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl hover:bg-slate-100 transition-colors w-full lg:w-auto justify-center">
                                <input
                                    type="checkbox"
                                    checked={showConcluidos}
                                    onChange={(e) => setShowConcluidos(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded mr-2"
                                />
                                Mostrar Concluídos
                            </label>
                        </div>

                        {/* Botão Recarregar */}
                        <button
                            onClick={() => loadProgramasMaquina(selectedMaquinaId)}
                            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors active:scale-95 flex items-center justify-center"
                            title="Recarregar Dados"
                        >
                            <RefreshCw size={16} />
                        </button>
                        
                        {/* Botões de Exportação */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleExportPDF}
                                className="p-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl transition-colors active:scale-95 flex items-center justify-center"
                                title="Exportar para PDF"
                            >
                                <FileText size={16} />
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="p-3 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 rounded-xl transition-colors active:scale-95 flex items-center justify-center"
                                title="Exportar para Excel"
                            >
                                <Table size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Resumo de Horas a Executar */}
                    {!loadingProgramas && filteredProgramas.length > 0 && (
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex gap-4 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                            <div className="flex-shrink-0 flex items-center justify-center bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3">
                                <div className="text-center">
                                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-0.5">Total Geral Restante</div>
                                    <div className="text-xl font-black text-indigo-700">{formatSeconds(hoursToExecuteSummary.totalGlobalRem)}</div>
                                </div>
                            </div>
                            
                            {Object.keys(hoursToExecuteSummary.byMachine).length > 0 && (
                                <div className="w-px bg-slate-200 mx-1 flex-shrink-0"></div>
                            )}
                            
                            {Object.entries(hoursToExecuteSummary.byMachine).map(([mName, data]) => (
                                <div key={mName} className="flex-shrink-0 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-xl px-5 py-3">
                                    <div className="text-center">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">{mName}</div>
                                        <div className="text-lg font-black text-slate-800">{formatSeconds(data.remSecs)}</div>
                                        <div className="text-[9px] text-slate-400 font-semibold mt-0.5">{data.progCount} {data.progCount === 1 ? 'programa' : 'programas'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tabela de Programas */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        {loadingProgramas ? (
                            <div className="p-16 flex justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : filteredProgramas.length === 0 ? (
                            <div className="p-16 text-center text-slate-400 text-xs">
                                Nenhum programa liberado localizado para os filtros selecionados.
                            </div>
                        ) : (
                            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-thin scrollbar-thumb-slate-200">
                                <table className="w-full text-left border-collapse text-xs relative">
                                    <thead className="sticky top-0 z-10 shadow-sm">
                                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                            <th className="px-5 py-4 w-12 text-center bg-slate-50 border-b border-slate-200">ID</th>
                                            <th className="px-5 py-4 w-16 text-center bg-slate-50 border-b border-slate-200" title="Sequência/Prioridade de Execução">Seq.</th>
                                            <th className="px-5 py-4 w-28 text-center bg-slate-50 border-b border-slate-200">Status</th>
                                            <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">Programa CNC</th>
                                            <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">Equipamento</th>
                                            <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">Material</th>
                                            <th className="px-5 py-4 w-16 text-center bg-slate-50 border-b border-slate-200">Turno</th>
                                            <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">Progresso</th>
                                            <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">Previsão Lote</th>
                                            <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">Assinatura / Controle</th>
                                            <th className="px-5 py-4 w-32 text-center bg-slate-50 border-b border-slate-200">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredProgramas.map(prog => {
                                            const progExecs = execucoes[prog.id] || [];
                                            const concludedCount = progExecs.filter(e => e.status === 'CONCLUIDA').length;
                                            
                                            // Correção do Cálculo da Previsão de Lote (Sem o fator extra de 60x multiplicativo)
                                            const tempoPrevTotal = formatSeconds(prog.quantidade_vezes * hhmmssToSeconds(prog.tempo_previsto));
                                            
                                            // Calcula a separação de Inteira vs Retalho
                                            let countInteira = 0;
                                            let countRetalho = 0;
                                            try {
                                                const chapas = typeof prog.chapas_planejadas === 'string' 
                                                    ? JSON.parse(prog.chapas_planejadas) 
                                                    : (prog.chapas_planejadas || []);
                                                if (Array.isArray(chapas) && chapas.length > 0) {
                                                    chapas.forEach(ch => {
                                                        const tipo = (ch.tipo || 'inteira').toLowerCase();
                                                        if (tipo === 'retalho') countRetalho++;
                                                        else countInteira++;
                                                    });
                                                }
                                            } catch(e) {}
                                            
                                            // Fallback se não tiver detalhes de planejamento
                                            if (countInteira === 0 && countRetalho === 0) {
                                                countInteira = prog.quantidade_vezes;
                                            }
                                            
                                            return (
                                                <tr key={prog.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-5 py-4 text-center font-bold text-slate-400 font-mono">#{prog.id}</td>
                                                    <td className="px-5 py-4 text-center">
                                                        {prog.ordem_execucao > 0 ? (
                                                            <div className="flex justify-center items-center">
                                                                <span className="flex items-center justify-center w-7 h-7 bg-red-600 text-white font-black rounded-lg shadow-sm text-xs">
                                                                    {prog.ordem_execucao}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 font-bold">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-wider inline-block ${
                                                            prog.status === 'CONCLUIDO' ? 'bg-green-50 text-green-700 border-green-200' :
                                                            prog.status === 'EM_EXECUCAO' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse' :
                                                            prog.status === 'EM_MONTAGEM' ? 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse' :
                                                            'bg-blue-50 text-blue-700 border-blue-200'
                                                        }`}>
                                                            {prog.status === 'EM_EXECUCAO' ? '● Em Execução' : prog.status === 'EM_MONTAGEM' ? '● Em Montagem' : prog.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 font-bold text-slate-800">
                                                        <div>{prog.nome_programa}</div>
                                                        <div className="text-[10px] font-normal text-slate-400 mt-0.5 font-sans">
                                                            Criado por: {prog.criado_por} | Doc: {new Date(prog.data_criacao).toLocaleDateString('pt-BR')}
                                                        </div>
                                                        {prog.created_at && (
                                                            <div className="text-[10px] font-semibold text-indigo-600 mt-1 flex items-center gap-1">
                                                                <Calendar size={10} />
                                                                <span>Liberado: {new Date(prog.created_at).toLocaleString('pt-BR')}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-slate-700">{prog.maquina_nome || `Máquina #${prog.maquina_id}`}</div>
                                                        {prog.maquina_tag && <div className="text-[10px] text-slate-400 mt-0.5 font-mono">TAG: {prog.maquina_tag}</div>}
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-600 font-medium">{prog.tipo_material}</td>
                                                    <td className="px-5 py-4 text-center font-bold text-slate-600 bg-slate-50/50">T{prog.turno_previsao}</td>
                                                    <td className="px-5 py-4 font-bold text-slate-700">
                                                        <div className="flex flex-col gap-1 w-32">
                                                            <span>{concludedCount} / {prog.quantidade_vezes} chapas</span>
                                                            <div className="flex gap-1.5 text-[9px] font-semibold flex-wrap">
                                                                {countInteira > 0 && (
                                                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                                                        {countInteira} Inteira{countInteira > 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                                {countRetalho > 0 && (
                                                                    <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                                                                        {countRetalho} Retalho{countRetalho > 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="w-full bg-slate-100 rounded-full h-1 mt-0.5">
                                                                <div 
                                                                    className="bg-indigo-600 h-1 rounded-full transition-all duration-300"
                                                                    style={{ width: `${Math.min(100, Math.round((concludedCount / prog.quantidade_vezes) * 100))}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 font-mono font-bold text-slate-700">{tempoPrevTotal}</td>
                                                    <td className="px-5 py-4">
                                                        {prog.recebedor_nome ? (
                                                            <div className="space-y-0.5 text-slate-600">
                                                                <div className="font-semibold text-slate-800">{prog.recebedor_nome}</div>
                                                                <div className="text-[10px] text-slate-400 font-normal">
                                                                    {prog.recebido_data ? new Date(prog.recebido_data).toLocaleDateString('pt-BR') : ''} {prog.recebido_hora ? prog.recebido_hora.substring(0, 5) : ''}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleOpenSign(prog)}
                                                                className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 hover:bg-amber-100 transition-colors"
                                                            >
                                                                <Check size={10} /> Assinar Recebimento
                                                            </button>
                                                        )}
                                                        <div className="mt-2 border-t border-slate-100 pt-2">
                                                            <button
                                                                onClick={() => handleOpenTerceirizacao(prog)}
                                                                className={`text-[9px] font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 transition-colors ${
                                                                    prog.tipo_execucao === 'TERCEIRIZADA' 
                                                                    ? 'text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100'
                                                                    : 'text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100'
                                                                }`}
                                                            >
                                                                <Truck size={10} /> {prog.tipo_execucao === 'TERCEIRIZADA' ? 'Terceirizada' : 'Terceirizar'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        {prog.recebedor_nome ? (
                                                            <button
                                                                onClick={() => {
                                                                    setApontamentoProg(prog);
                                                                    setFetchTime(new Date());
                                                                }}
                                                                className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-xl transition-all shadow-sm active:scale-95"
                                                            >
                                                                <Play size={12} fill="white" /> Apontar Corte
                                                            </button>
                                                        ) : (
                                                            <button
                                                                disabled
                                                                className="w-full flex items-center justify-center gap-1.5 bg-slate-100 text-slate-400 font-bold py-2 px-3 rounded-xl cursor-not-allowed border border-slate-200"
                                                            >
                                                                Aguardando Assinatura
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CONTEÚDO DA ABA: RELATÓRIO COMPARATIVO */}
            {activeTab === 'relatorio' && (
                <div className="space-y-6">
                    
                    {/* Estatísticas no Topo */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="text-slate-400 text-[10px] font-bold uppercase">Lotes Analisados</span>
                            <div className="text-2xl font-black text-slate-800 mt-1">{stats.total}</div>
                            <div className="text-[10px] text-slate-500 mt-1 font-semibold">Concluídos: {stats.concluido}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="text-slate-400 text-[10px] font-bold uppercase">Chapas Cortadas</span>
                            <div className="text-2xl font-black text-slate-800 mt-1">{stats.totalChapas}</div>
                            <div className="text-[10px] text-slate-500 mt-1 font-semibold">Realizadas chapa a chapa</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="text-slate-400 text-[10px] font-bold uppercase">Tempo Total Parado</span>
                            <div className="text-2xl font-black text-red-500 mt-1">{stats.tempoParado}</div>
                            <div className="text-[10px] text-slate-500 mt-1 font-semibold">Perdas operacionais</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="text-slate-400 text-[10px] font-bold uppercase">Eficiência Bruta</span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className={`text-2xl font-black ${
                                    stats.eficienciaGeral >= 90 ? 'text-green-600' :
                                    stats.eficienciaGeral >= 70 ? 'text-amber-500' : 'text-red-500'
                                }`}>
                                    {stats.eficienciaGeral}%
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 font-semibold">Programado / Exec. (Bruto)</span>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-2 lg:col-span-1">
                            <span className="text-slate-400 text-[10px] font-bold uppercase flex items-center gap-0.5">
                                <Zap size={12} className="text-indigo-600 fill-indigo-100" /> Eficiência Líquida
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className={`text-2xl font-black ${
                                    stats.eficienciaLiquidaGeral >= 90 ? 'text-indigo-600' :
                                    stats.eficienciaLiquidaGeral >= 70 ? 'text-amber-500' : 'text-red-500'
                                }`}>
                                    {stats.eficienciaLiquidaGeral}%
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 font-semibold">Descontando as paradas</span>
                        </div>
                    </div>

                    {/* Filtros do Relatório */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            
                            {/* Busca */}
                            <div className="relative min-w-[200px] flex-1 md:flex-initial">
                                <input
                                    type="text"
                                    placeholder="Buscar por programa..."
                                    value={relSearchQuery}
                                    onChange={(e) => setRelSearchQuery(e.target.value)}
                                    className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                            </div>

                            {/* Filtro Máquina */}
                            <select
                                value={relFilterMaquina}
                                onChange={(e) => setRelFilterMaquina(e.target.value)}
                                className="text-xs border border-slate-300 rounded-lg p-2 bg-white"
                            >
                                <option value="">Todas as Máquinas</option>
                                {relMaquinasList.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>

                            {/* Filtro Turno */}
                            <select
                                value={relFilterTurno}
                                onChange={(e) => setRelFilterTurno(e.target.value)}
                                className="text-xs border border-slate-300 rounded-lg p-2 bg-white"
                            >
                                <option value="">Todos os Turnos</option>
                                <option value="1">Turno 1</option>
                                <option value="2">Turno 2</option>
                                <option value="3">Turno 3</option>
                                <option value="4">Turno 4</option>
                            </select>

                            {/* Filtro Terceirizado */}
                            <select
                                value={relFilterTerceirizado}
                                onChange={(e) => setRelFilterTerceirizado(e.target.value)}
                                className="text-xs border border-slate-300 rounded-lg p-2 bg-white"
                            >
                                <option value="TODOS">Todas as Execuções</option>
                                <option value="INTERNA">Apenas Interna</option>
                                <option value="TERCEIRIZADA">Apenas Terceirizada</option>
                            </select>

                            {/* Filtro Data Planejada */}
                            <input
                                type="date"
                                value={relFilterDataPlanejada}
                                onChange={(e) => setRelFilterDataPlanejada(e.target.value)}
                                className="text-xs border border-slate-300 rounded-lg p-2 bg-white outline-none focus:ring-1 focus:ring-indigo-500"
                                title="Filtrar por Data Planejada"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                            <button
                                onClick={handleExportRelatorio}
                                className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors shadow-sm"
                            >
                                <Download size={12} /> Exportar Excel
                            </button>
                            <button
                                onClick={loadRelatorio}
                                className="flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                            >
                                <RefreshCw size={12} /> Atualizar Relatório
                            </button>
                        </div>
                    </div>

                    {/* Tabela de Relatório */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {loadingRelatorio ? (
                            <div className="flex justify-center p-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : filteredRelatorio.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 italic text-sm">
                                Nenhum registro localizado para os filtros selecionados.
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-800 font-bold">
                                        <th className="p-4">Equipamento</th>
                                        <th className="p-4">Programa</th>
                                        <th className="p-4 text-center">Turno</th>
                                        <th className="p-4 text-center">Chapas Concluídas</th>
                                        <th className="p-4 text-center">Tempo Programado</th>
                                        <th className="p-4 text-center">T. Executado (Bruto)</th>
                                        <th className="p-4 text-center">T. Executado (Líquido)</th>
                                        <th className="p-4 text-center">Tempo de Parada</th>
                                        <th className="p-4 text-center">Ef. Bruta</th>
                                        <th className="p-4 text-center">Ef. Líquida</th>
                                        <th className="p-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                                    {filteredRelatorio.map(row => (
                                        <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{row.maquina_nome}</div>
                                                {row.maquina_tag && <div className="text-[10px] font-mono text-slate-400 mt-0.5">{row.maquina_tag}</div>}
                                            </td>
                                            <td className="p-4 font-bold text-slate-800">{row.nome_programa}</td>
                                            <td className="p-4 text-center">Turno {row.turno_previsao}</td>
                                            <td className="p-4 text-center">
                                                <span className="font-bold text-slate-700">{row.chapas_concluidas}</span> / {row.total_chapas}
                                            </td>
                                            <td className="p-4 text-center font-mono font-bold text-slate-700">{row.tempo_previsto_total}</td>
                                            <td className="p-4 text-center font-mono font-bold text-slate-700">{row.tempo_realizado_total}</td>
                                            <td className="p-4 text-center font-mono font-bold text-indigo-600">{row.tempo_liquido_total}</td>
                                            <td className="p-4 text-center font-mono font-bold text-red-500">{row.tempo_parada_total}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-black inline-block ${
                                                    row.eficiencia >= 90 ? 'bg-green-100 text-green-700' :
                                                    row.eficiencia >= 70 ? 'bg-amber-100 text-amber-700' :
                                                    row.eficiencia > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {row.eficiencia > 0 ? `${row.eficiencia}%` : '-'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center font-bold">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-black inline-block ${
                                                    row.eficiencia_liquida >= 90 ? 'bg-indigo-100 text-indigo-700' :
                                                    row.eficiencia_liquida >= 70 ? 'bg-amber-100 text-amber-700' :
                                                    row.eficiencia_liquida > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {row.eficiencia_liquida > 0 ? `${row.eficiencia_liquida}%` : '-'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block ${
                                                    row.status === 'CONCLUIDO' ? 'bg-green-50 text-green-700 border border-green-200' :
                                                    row.status === 'EM_EXECUCAO' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                                                    row.status === 'EM_MONTAGEM' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                                                    'bg-blue-50 text-blue-700 border border-blue-200'
                                                }`}>
                                                    {row.status === 'EM_MONTAGEM' ? 'EM MONTAGEM' : row.status === 'EM_EXECUCAO' ? 'EM EXECUÇÃO' : row.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL DE APONTAMENTO CHAPA A CHAPA */}
            {apontamentoProg && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
                        {/* Header do Modal */}
                        <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                            <div>
                                <span className="px-2.5 py-1 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                    Apontamento de Produção
                                </span>
                                <h3 className="text-xl font-black mt-2 tracking-tight">
                                    Programa CNC: {apontamentoProg.nome_programa}
                                </h3>
                                <p className="text-xs text-slate-400 mt-1 font-medium">
                                    Máquina: <strong>{apontamentoProg.maquina_nome || `Máquina #${apontamentoProg.maquina_id}`}</strong>
                                    {apontamentoProg.maquina_tag && ` (TAG: ${apontamentoProg.maquina_tag})`}
                                    {" | "} Material: <strong>{apontamentoProg.tipo_material}</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setApontamentoProg(null);
                                    loadProgramasMaquina(selectedMaquinaId);
                                }}
                                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Corpo do Modal */}
                        <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-6">
                            {/* Informativo do Lote */}
                            <div className="shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap gap-6 items-center justify-between text-xs font-semibold">
                                <div>
                                    <span className="text-slate-400 font-bold block uppercase text-[10px]">Operador Logado</span>
                                    <span className="text-sm font-black text-slate-700">{operatorName || 'Operador'}</span>
                                </div>
                                <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
                                <div>
                                    <span className="text-slate-400 font-bold block uppercase text-[10px]">Total de Chapas</span>
                                    <span className="text-sm font-black text-slate-700">{apontamentoProg.quantidade_vezes} chapas</span>
                                </div>
                                <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
                                <div>
                                    <span className="text-slate-400 font-bold block uppercase text-[10px]">Status Geral</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border inline-block mt-1 ${
                                        apontamentoProg.status === 'CONCLUIDO' ? 'bg-green-50 text-green-700 border-green-200' :
                                        apontamentoProg.status === 'EM_EXECUCAO' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse' :
                                        apontamentoProg.status === 'EM_MONTAGEM' ? 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse' :
                                        'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}>
                                        {apontamentoProg.status}
                                    </span>
                                </div>
                            </div>

                            {/* Listagem de Chapas Planejadas */}
                            <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
                                <div className="shrink-0 flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">Chapas do Lote</h4>
                                        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 p-1.5 rounded-lg">
                                            <span className="text-[10px] font-bold text-indigo-700 uppercase">Início do Cálculo:</span>
                                            <input 
                                                type="datetime-local" 
                                                className="text-xs border-none bg-white rounded p-1 text-slate-700 font-bold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                                                value={apontamentoProg.base_time_calculo ? new Date(new Date(apontamentoProg.base_time_calculo).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''}
                                                onChange={async (e) => {
                                                    const val = e.target.value;
                                                    try {
                                                        await api.put(`/pcp/programas/liberados/${apontamentoProg.id}/base-time`, { base_time_calculo: val || null });
                                                        toast.success("Data base salva!");
                                                        setApontamentoProg(prev => ({...prev, base_time_calculo: val || null}));
                                                        // Refresh parent lists
                                                        setFetchTime(new Date());
                                                    } catch (err) {
                                                        toast.error("Erro ao salvar data base.");
                                                    }
                                                }}
                                            />
                                            {apontamentoProg.base_time_calculo && (
                                                <button 
                                                    onClick={async () => {
                                                        try {
                                                            await api.put(`/pcp/programas/liberados/${apontamentoProg.id}/base-time`, { base_time_calculo: null });
                                                            toast.success("Data base limpa!");
                                                            setApontamentoProg(prev => ({...prev, base_time_calculo: null}));
                                                            setFetchTime(new Date());
                                                        } catch (err) {}
                                                    }}
                                                    className="text-indigo-400 hover:text-indigo-700 p-1 bg-white rounded shadow-sm"
                                                    title="Limpar e usar Hora Atual"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <select
                                        value={chapaFilter}
                                        onChange={(e) => setChapaFilter(e.target.value)}
                                        className="text-xs border border-slate-300 rounded-lg p-2 bg-white font-semibold text-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm"
                                    >
                                        <option value="PENDENTES_ANDAMENTO_PARADAS">Ocultar Concluídas (Padrão)</option>
                                        <option value="TODOS">Mostrar Todas</option>
                                        <option value="PENDENTE">Apenas Pendentes</option>
                                        <option value="EM_ANDAMENTO">Apenas Em Andamento</option>
                                        <option value="PARADA">Apenas Paradas</option>
                                        <option value="CONCLUIDA">Apenas Concluídas</option>
                                    </select>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                                    {(() => {
                                        const chapasArray = (() => {
                                            try {
                                                return typeof apontamentoProg.chapas_planejadas === 'string'
                                                    ? JSON.parse(apontamentoProg.chapas_planejadas)
                                                    : (apontamentoProg.chapas_planejadas || []);
                                            } catch (e) {
                                                return [];
                                            }
                                        })();

                                        if (chapasArray.length === 0) {
                                            return (
                                                <div className="p-8 text-center text-slate-400 italic text-xs">
                                                    Nenhuma chapa cadastrada para este programa.
                                                </div>
                                            );
                                        }

                                        const progExecs = execucoes[apontamentoProg.id] || [];
                                        const progParadas = paradas[apontamentoProg.id] || [];

                                        const filteredChapasArray = chapasArray.filter((chapa, index) => {
                                            const chapaCodigo = chapa.codigo || `Chapa ${index + 1}`;
                                            const exec = progExecs.find(e => e.chapa_numero === chapaCodigo);
                                            const paradaAtiva = progParadas.find(p => p.chapa_numero === chapaCodigo && p.status === 'EM_ANDAMENTO');

                                            let chapaStatus = 'PENDENTE';
                                            if (exec) {
                                                if (exec.status === 'CONCLUIDA') {
                                                    chapaStatus = 'CONCLUIDA';
                                                } else if (exec.status === 'EM_ANDAMENTO') {
                                                    chapaStatus = paradaAtiva ? 'PARADA' : 'EM_ANDAMENTO';
                                                }
                                            }

                                            if (chapaFilter === 'TODOS') return true;
                                            if (chapaFilter === 'PENDENTES_ANDAMENTO_PARADAS') return chapaStatus !== 'CONCLUIDA';
                                            return chapaStatus === chapaFilter;
                                        });

                                        if (filteredChapasArray.length === 0) {
                                            return (
                                                <div className="p-8 text-center text-slate-400 italic text-xs">
                                                    Nenhuma chapa encontrada para o filtro atual.
                                                </div>
                                            );
                                        }

                                        // LÓGICA DE PROJEÇÃO DINÂMICA
                                        let baseRefTime = apontamentoProg.base_time_calculo ? new Date(apontamentoProg.base_time_calculo) : new Date(now);
                                        let currentCursor = new Date(baseRefTime);
                                        let hasActiveOrConcluded = false;

                                        // Primeiro passe: encontrar onde o cursor de projeção deve começar
                                        for (let i = 0; i < chapasArray.length; i++) {
                                            const chapa = chapasArray[i];
                                            const chapaCodigo = chapa.codigo || `Chapa ${i + 1}`;
                                            const exec = progExecs.find(e => e.chapa_numero === chapaCodigo);
                                            
                                            if (exec) {
                                                hasActiveOrConcluded = true;
                                                if (exec.status === 'CONCLUIDA') {
                                                    currentCursor = new Date(exec.hora_fim);
                                                } else if (exec.status === 'EM_ANDAMENTO') {
                                                    const start = new Date(exec.hora_inicio);
                                                    const tempoPrevistoSecs = hhmmssToSeconds(chapa.tempo || apontamentoProg.tempo_previsto || '00:00:00');
                                                    currentCursor = addWorkingTime(start, tempoPrevistoSecs, turnos);
                                                    if (currentCursor < baseRefTime) currentCursor = new Date(baseRefTime);
                                                }
                                            }
                                        }

                                        if (!hasActiveOrConcluded) {
                                            currentCursor = new Date(baseRefTime);
                                        }

                                        currentCursor = getNextWorkingTime(currentCursor, turnos);

                                        // Segundo passe: Calcular projeções para cada chapa
                                        const projArray = chapasArray.map((chapa, index) => {
                                            const chapaCodigo = chapa.codigo || `Chapa ${index + 1}`;
                                            const exec = progExecs.find(e => e.chapa_numero === chapaCodigo);
                                            const tempoPrevistoSecs = hhmmssToSeconds(chapa.tempo || apontamentoProg.tempo_previsto || '00:00:00');
                                            
                                            let projStart, projEnd;
                                            
                                            if (exec) {
                                                if (exec.status === 'CONCLUIDA') {
                                                    projStart = new Date(exec.hora_inicio);
                                                    projEnd = new Date(exec.hora_fim);
                                                } else if (exec.status === 'EM_ANDAMENTO') {
                                                    projStart = new Date(exec.hora_inicio);
                                                    projEnd = addWorkingTime(projStart, tempoPrevistoSecs, turnos);
                                                    if (projEnd < baseRefTime) projEnd = new Date(baseRefTime);
                                                    currentCursor = new Date(projEnd);
                                                }
                                            } else {
                                                projStart = new Date(currentCursor);
                                                projEnd = addWorkingTime(projStart, tempoPrevistoSecs, turnos);
                                                currentCursor = new Date(projEnd);
                                            }

                                            const turnoAssigned = getTurnoForTime(projEnd, turnos);
                                            
                                            // Atualiza cursor caso exista quebra manual
                                            if (chapa.forcar_quebra_turno) {
                                                currentCursor = jumpToNextShift(currentCursor, turnos);
                                            }

                                            return {
                                                ...chapa,
                                                projStart,
                                                projEnd,
                                                turnoAssigned
                                            };
                                        });

                                        return filteredChapasArray.map((chapa) => {
                                            const index = chapasArray.findIndex(c => c.codigo === chapa.codigo);
                                            const projData = projArray[index];
                                            const chapaCodigo = chapa.codigo || `Chapa ${index + 1}`;
                                            const tempoPrevistoChapa = chapa.tempo || apontamentoProg.tempo_previsto || '00:00:00';
                                            
                                            const exec = progExecs.find(e => e.chapa_numero === chapaCodigo);
                                            const paradaAtiva = progParadas.find(p => p.chapa_numero === chapaCodigo && p.status === 'EM_ANDAMENTO');

                                            let chapaStatus = 'PENDENTE';
                                            let statusBadge = (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[9px] font-black uppercase">
                                                    Aguardando
                                                </span>
                                            );

                                            let tempoGastoText = '-';

                                            if (exec) {
                                                if (exec.status === 'CONCLUIDA') {
                                                    chapaStatus = 'CONCLUIDA';
                                                    statusBadge = (
                                                        <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[9px] font-black uppercase">
                                                            Concluído
                                                        </span>
                                                    );
                                                    tempoGastoText = (
                                                        <div className="flex flex-col font-mono text-[10px]">
                                                            <span className="text-slate-500 font-bold">
                                                                Previsto: {tempoPrevistoChapa}
                                                            </span>
                                                            <span className="text-xs font-black text-green-600 mt-0.5">
                                                                Real: {formatSeconds(exec.tempo_realizado_segundos)}
                                                            </span>
                                                        </div>
                                                    );
                                                } else if (exec.status === 'EM_ANDAMENTO') {
                                                    if (paradaAtiva) {
                                                        chapaStatus = 'PARADA';
                                                        statusBadge = (
                                                            <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[9px] font-black uppercase animate-pulse">
                                                                Pausada
                                                            </span>
                                                        );
                                                    } else {
                                                        chapaStatus = 'EM_ANDAMENTO';
                                                        statusBadge = (
                                                            <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-[9px] font-black uppercase animate-pulse">
                                                                Cortando
                                                            </span>
                                                        );
                                                    }

                                                    const inicio = parseLocal(exec.hora_inicio);
                                                    const diffSecs = Math.max(0, Math.floor((now - inicio) / 1000));
                                                    
                                                    const paradasConcluidas = progParadas.filter(p => p.chapa_numero === chapaCodigo && p.status === 'CONCLUIDA');
                                                    const tempoParadoConcluido = paradasConcluidas.reduce((sum, p) => sum + (p.tempo_segundos || 0), 0);

                                                    let tempoParadaAtiva = 0;
                                                    if (paradaAtiva) {
                                                        const paradaInicio = parseLocal(paradaAtiva.data_inicio);
                                                        tempoParadaAtiva = Math.max(0, Math.floor((now - paradaInicio) / 1000));
                                                    }

                                                    const tempoLiquido = Math.max(0, diffSecs - tempoParadoConcluido - tempoParadaAtiva);

                                                    tempoGastoText = (
                                                        <div className="flex flex-col font-mono text-[10px]">
                                                            <span className="text-slate-500 font-bold">
                                                                Previsto: {tempoPrevistoChapa}
                                                            </span>
                                                            <span className="text-xs font-black text-indigo-600 mt-0.5">
                                                                Líquido: {formatSeconds(tempoLiquido)}
                                                            </span>
                                                            {(tempoParadoConcluido + tempoParadaAtiva) > 0 && (
                                                                <span className="text-red-500 text-[9px] mt-0.5">
                                                                    Pausado: {formatSeconds(tempoParadoConcluido + tempoParadaAtiva)}
                                                                </span>
                                                            )}
                                                            <span className="text-slate-400 text-[9px] mt-0.5">
                                                                Bruto: {formatSeconds(diffSecs)}
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                            }

                                            return (
                                                <div 
                                                    key={index} 
                                                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                                                        chapaStatus === 'EM_ANDAMENTO' ? 'bg-indigo-50/20' : 
                                                        chapaStatus === 'PARADA' ? 'bg-red-50/10' :
                                                        'hover:bg-slate-50/50'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-500 flex items-center justify-center">
                                                            {index + 1}
                                                        </span>
                                                        <div>
                                                            <span className="font-bold text-slate-800 text-sm block font-sans">
                                                                {chapaCodigo}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-semibold font-mono">
                                                                Previsto: {tempoPrevistoChapa}
                                                            </span>
                                                            {exec && (
                                                                <div className="text-[10px] text-slate-500 mt-1.5 space-y-0.5 border-t border-slate-100 pt-1 w-48">
                                                                    <div>Operador: <span className="font-semibold text-slate-700">{exec.usuario_apontamento}</span></div>
                                                                    <div>Início: <span className="font-mono">{parseLocal(exec.hora_inicio).toLocaleString('pt-BR')}</span></div>
                                                                    {exec.hora_fim && (
                                                                        <div>Fim: <span className="font-mono">{parseLocal(exec.hora_fim).toLocaleString('pt-BR')}</span></div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {!exec && (
                                                                <div className="text-[10px] text-indigo-500 mt-1.5 space-y-0.5 border-t border-indigo-100 pt-1 w-48 font-mono">
                                                                    <div>Proj. Início: <span>{projData.projStart.toLocaleTimeString('pt-BR').substring(0,5)}</span></div>
                                                                    <div>Proj. Fim: <span>{projData.projEnd.toLocaleTimeString('pt-BR').substring(0,5)}</span></div>
                                                                    {projData.turnoAssigned && (
                                                                        <div className="text-indigo-600 font-bold">Turno: {projData.turnoAssigned.nome}</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {statusBadge}
                                                    </div>

                                                    <div className="text-slate-700 text-xs font-semibold flex flex-col items-end gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Tempo Gasto</div>
                                                        </div>
                                                        <div className="font-mono text-slate-800 text-right">{tempoGastoText}</div>
                                                    </div>

                                                    <div className="flex flex-col items-end gap-2">
                                                        <label className="flex items-center gap-1.5 cursor-pointer group">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={!!chapa.forcar_quebra_turno}
                                                                onChange={() => handleToggleQuebraTurno(apontamentoProg.id, index, !!chapa.forcar_quebra_turno)}
                                                                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                                            />
                                                            <span className="text-[9px] font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">Última do Turno</span>
                                                        </label>
                                                        {chapaStatus === 'PENDENTE' && (
                                                            <button
                                                                onClick={() => handleStartChapa(apontamentoProg.id, chapaCodigo)}
                                                                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-sm active:scale-95"
                                                            >
                                                                <Play size={12} fill="white" /> Iniciar Corte
                                                            </button>
                                                        )}

                                                        {chapaStatus === 'EM_ANDAMENTO' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleConcludeChapa(apontamentoProg.id, chapaCodigo)}
                                                                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3.5 rounded-xl text-xs transition-all shadow-sm active:scale-95"
                                                                    title="Concluir o corte desta chapa"
                                                                >
                                                                    <Check size={14} /> Concluir
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setReportingParada({ progId: apontamentoProg.id, chapaNum: chapaCodigo });
                                                                    }}
                                                                    className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-xl text-xs transition-all shadow-sm active:scale-95"
                                                                    title="Registrar parada (pausa) da máquina nesta chapa"
                                                                >
                                                                    <Clock size={14} /> Pausar
                                                                </button>
                                                            </>
                                                        )}

                                                        {chapaStatus === 'PARADA' && (
                                                            <button
                                                                onClick={() => handleConcludeParada(apontamentoProg.id, chapaCodigo)}
                                                                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-sm active:scale-95"
                                                                title="Retomar o corte desta chapa"
                                                            >
                                                                <Play size={12} fill="white" /> Retomar Corte
                                                            </button>
                                                        )}

                                                        {chapaStatus === 'CONCLUIDA' && (
                                                            <span className="text-slate-400 text-xs italic flex items-center gap-1.5 font-semibold">
                                                                <CheckCircle size={14} className="text-green-500" /> Finalizado
                                                            </span>
                                                        )}
                                                        {chapaStatus !== 'PENDENTE' && (
                                                            <button
                                                                onClick={() => handleCancelChapa(apontamentoProg.id, chapaCodigo)}
                                                                className="flex items-center justify-center p-2 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl transition-all shadow-sm active:scale-95 border border-slate-200"
                                                                title="Cancelar e reiniciar apontamento desta chapa"
                                                            >
                                                                <RotateCcw size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Footer do Modal */}
                        <div className="bg-slate-50 border-t border-slate-200 p-6 flex justify-end shrink-0">
                            <button
                                onClick={async () => {
                                    const chapasArray = (() => {
                                        try {
                                            return typeof apontamentoProg.chapas_planejadas === 'string'
                                                ? JSON.parse(apontamentoProg.chapas_planejadas)
                                                : (apontamentoProg.chapas_planejadas || []);
                                        } catch (e) { return []; }
                                    })();
                                    const progExecs = execucoes[apontamentoProg.id] || [];
                                    const concludedCount = progExecs.filter(e => e.status === 'CONCLUIDA').length;

                                    if (concludedCount === chapasArray.length && concludedCount > 0 && apontamentoProg.status !== 'CONCLUIDO') {
                                        if (window.confirm("Todas as chapas do lote foram concluídas! Deseja finalizar o status geral do lote/programa para CONCLUÍDO?")) {
                                            try {
                                                await api.put(`/pcp/programas/${apontamentoProg.id}`, { status: 'CONCLUIDO' });
                                                toast.success("Lote concluído com sucesso!");
                                            } catch (e) {
                                                console.error(e);
                                                toast.error("Erro ao concluir lote.");
                                            }
                                        }
                                    }
                                    setApontamentoProg(null);
                                    loadProgramasMaquina(selectedMaquinaId);
                                }}
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all shadow-sm active:scale-95"
                            >
                                Fechar Painel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE INICIAR PARADA */}
            {reportingParada && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
                    <form onSubmit={handleStartParada} className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up">
                        <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
                            <h3 className="font-black text-base flex items-center gap-2">
                                <AlertTriangle className="text-amber-500 w-5 h-5 animate-pulse" />
                                Registrar Parada (Pausa)
                            </h3>
                            <button
                                type="button"
                                onClick={() => setReportingParada(null)}
                                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <p className="text-xs text-slate-500 font-semibold">
                                Chapa selecionada: <span className="text-slate-700 font-bold">{reportingParada.chapaNum}</span>
                            </p>
                            
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                    Motivo da Parada
                                </label>
                                <select
                                    value={paradaForm.motivo}
                                    onChange={(e) => setParadaForm({ ...paradaForm, motivo: e.target.value })}
                                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white font-semibold text-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                                >
                                    {MOTIVOS_PARADA.map((m, i) => (
                                        <option key={i} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                    Observações / Detalhes (Opcional)
                                </label>
                                <textarea
                                    value={paradaForm.observacoes}
                                    onChange={(e) => setParadaForm({ ...paradaForm, observacoes: e.target.value })}
                                    placeholder="Descreva o motivo detalhado ou observações adicionais..."
                                    rows="3"
                                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium"
                                />
                            </div>
                        </div>

                        <div className="bg-slate-50 border-t border-slate-200 p-5 flex justify-end gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setReportingParada(null)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors shadow-sm"
                            >
                                Confirmar Parada
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL DE ASSINATURA DE RECEBIMENTO */}
            {signingProgId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <form onSubmit={handleSaveSign} className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up">
                        <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
                            <h3 className="font-black text-base flex items-center gap-2">
                                <User className="text-amber-500 w-5 h-5" />
                                Assinar Recebimento do Lote
                            </h3>
                            <button
                                type="button"
                                onClick={() => setSigningProgId(null)}
                                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                                Confirme o recebimento físico e a liberação dos materiais/desenhos do programa para iniciar o corte.
                            </p>
                            
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                    Nome do Recebedor / Operador
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={signForm.recebedor_nome}
                                    onChange={(e) => setSignForm({ ...signForm, recebedor_nome: e.target.value })}
                                    placeholder="Digite seu nome completo"
                                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-semibold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Data de Recebimento
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={signForm.recebido_data}
                                        onChange={(e) => setSignForm({ ...signForm, recebido_data: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-semibold cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Hora de Recebimento
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={signForm.recebido_hora}
                                        onChange={(e) => setSignForm({ ...signForm, recebido_hora: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-semibold cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                    Notas / Observações / Instruções (Opcional)
                                </label>
                                <textarea
                                    value={signForm.notas_instrucoes}
                                    onChange={(e) => setSignForm({ ...signForm, notas_instrucoes: e.target.value })}
                                    placeholder="Instruções de preparação ou notas sobre o lote recebido..."
                                    rows="3"
                                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium"
                                />
                            </div>
                        </div>

                        <div className="bg-slate-50 border-t border-slate-200 p-5 flex justify-end gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setSigningProgId(null)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors shadow-sm"
                            >
                                Confirmar Recebimento
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL DE TERCEIRIZAÇÃO */}
            {terceirizacaoProg && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <form onSubmit={handleSaveTerceirizacao} className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up">
                        <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
                            <h3 className="font-black text-base flex items-center gap-2">
                                <Truck className="text-teal-400 w-5 h-5" />
                                Gestão de Execução / Terceirização
                            </h3>
                            <button
                                type="button"
                                onClick={() => setTerceirizacaoProg(null)}
                                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                                Programa: <strong className="text-slate-800">{terceirizacaoProg.nome_programa}</strong>
                            </p>
                            
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                    Tipo de Execução
                                </label>
                                <select
                                    value={terceirizacaoForm.tipo_execucao}
                                    onChange={(e) => setTerceirizacaoForm({ ...terceirizacaoForm, tipo_execucao: e.target.value })}
                                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white font-bold text-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                                >
                                    <option value="INTERNA">Interna (Nossa Fábrica)</option>
                                    <option value="TERCEIRIZADA">Terceirizada (Fornecedor Externo)</option>
                                </select>
                            </div>

                            {terceirizacaoForm.tipo_execucao === 'TERCEIRIZADA' && (
                                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4 animate-fade-in">
                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <Building size={12} className="text-slate-400" /> Empresa Contratada
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={terceirizacaoForm.terceirizado_empresa}
                                            onChange={(e) => setTerceirizacaoForm({ ...terceirizacaoForm, terceirizado_empresa: e.target.value })}
                                            placeholder="Nome do fornecedor / empresa"
                                            className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-semibold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <Octagon size={12} className="text-slate-400" /> Escopo do Serviço
                                        </label>
                                        <textarea
                                            value={terceirizacaoForm.terceirizado_escopo}
                                            onChange={(e) => setTerceirizacaoForm({ ...terceirizacaoForm, terceirizado_escopo: e.target.value })}
                                            placeholder="Descreva o que o fornecedor fará (Corte, dobra, pintura...)"
                                            rows="3"
                                            className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                <Calendar size={12} className="text-slate-400" /> Data de Envio
                                            </label>
                                            <input
                                                type="date"
                                                value={terceirizacaoForm.terceirizado_data_envio}
                                                onChange={(e) => setTerceirizacaoForm({ ...terceirizacaoForm, terceirizado_data_envio: e.target.value })}
                                                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-semibold cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                <Calendar size={12} className="text-slate-400" /> Data de Retorno
                                            </label>
                                            <input
                                                type="date"
                                                value={terceirizacaoForm.terceirizado_data_retorno}
                                                onChange={(e) => setTerceirizacaoForm({ ...terceirizacaoForm, terceirizado_data_retorno: e.target.value })}
                                                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-semibold cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-50 border-t border-slate-200 p-5 flex justify-end gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setTerceirizacaoProg(null)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors shadow-sm"
                            >
                                Salvar Configuração
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
