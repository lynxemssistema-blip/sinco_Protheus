import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { 
    Plus, X, Trash2, Calendar, Clock, User, FileText, 
    Factory, AlertCircle, RefreshCw, Search, Edit, Copy, GripVertical, Table, Printer, Settings, Info
} from 'lucide-react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { logoBase64 } from '../../services/metalfisaLogoBase64';
import { getNextWorkingTime, addWorkingTime, getTurnoForTime, jumpToNextShift, toSecs } from '../../utils/timeProjectionUtils';

// Auxiliares de conversão de tempo
function hhmmssToSeconds(str) {
    if (!str) return 0;
    const parts = str.split(':');
    const hrs = parseInt(parts[0]) || 0;
    const mins = parseInt(parts[1]) || 0;
    const secs = parseInt(parts[2]) || 0;
    return (hrs * 3600) + (mins * 60) + secs;
}

function secondsToHhmmss(totalSecs) {
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

export default function ProgramasNCN() {
    const { user } = useAuth();
    
    // State de dados
    const [maquinas, setMaquinas] = useState([]);
    const [loadingMaquinas, setLoadingMaquinas] = useState(true);
    const [programas, setProgramas] = useState([]);
    const [loadingProgramas, setLoadingProgramas] = useState(true);

    // State de filtros
    const [filterMaquinaId, setFilterMaquinaId] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [highlightedProgId, setHighlightedProgId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showConcluidos, setShowConcluidos] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState(null);
    
    // State Config Turnos
    const [showConfigTurnos, setShowConfigTurnos] = useState(false);
    const [turnos, setTurnos] = useState([]);
    const [loadingTurnos, setLoadingTurnos] = useState(false);
    const [editingTurno, setEditingTurno] = useState(null);
    const [turnoForm, setTurnoForm] = useState({
        nome: '', hora_inicio: '06:00', hora_fim: '15:00', intervalo_inicio: '', intervalo_fim: '', ordem: 1
    });

    // State do Modal
    const [showFormProg, setShowFormProg] = useState(false);
    const [editingProgId, setEditingProgId] = useState(null);
    const [editingProgram, setEditingProgram] = useState(null);
    const [progForm, setProgForm] = useState({
        maquina_id: '',
        nome_programa: '',
        data_criacao: new Date().toISOString().substring(0, 10),
        tempo_previsto: '00:00:00',
        tipo_material: '',
        quantidade_vezes: 1,
        chapas_planejadas: [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }],
        criado_por: '',
        turno_previsao: 1,
        recebedor_nome: '',
        recebido_data: '',
        recebido_hora: '',
        notas_instrucoes: ''
    });

    // State do Print Settings Modal
    const [printModalProg, setPrintModalProg] = useState(null);
    const [printSettings, setPrintSettings] = useState({
        date: new Date().toISOString().substring(0, 10),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        turnoId: ''
    });

    // Carregar máquinas e programas ao montar a tela
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setLoadingMaquinas(true);
                const resMaquinas = await api.get('/manutencao/maquinas');
                setMaquinas(resMaquinas.data.filter(m => m.status === 'ATIVO'));
            } catch (err) {
                console.error("Erro ao carregar máquinas:", err);
                toast.error("Erro ao carregar máquinas do parque fabril.");
            } finally {
                setLoadingMaquinas(false);
            }

            await loadTurnos();
            await loadProgramas();
        };
        fetchInitialData();
    }, []);

    const loadProgramas = async () => {
        try {
            setLoadingProgramas(true);
            const res = await api.get('/pcp/programas/maquina/all');
            setProgramas(res.data);
        } catch (err) {
            console.error("Erro ao carregar programas:", err);
            toast.error("Erro ao carregar programas liberados.");
        } finally {
            setLoadingProgramas(false);
        }
    };

    const loadTurnos = async () => {
        try {
            setLoadingTurnos(true);
            const res = await api.get('/pcp/programas/turnos');
            setTurnos(res.data);
        } catch (err) {
            console.error("Erro ao carregar turnos:", err);
            toast.error("Erro ao carregar configurações de turnos.");
        } finally {
            setLoadingTurnos(false);
        }
    };

    useEffect(() => {
        // Removed conditional to avoid redundant loads, it's loaded on mount now.
    }, [showConfigTurnos]);

    const handleSaveTurno = async (e) => {
        e.preventDefault();
        try {
            if (editingTurno) {
                await api.put(`/pcp/programas/turnos/${editingTurno.id}`, turnoForm);
                toast.success("Turno atualizado com sucesso!");
            } else {
                await api.post('/pcp/programas/turnos', turnoForm);
                toast.success("Turno criado com sucesso!");
            }
            setEditingTurno(null);
            setTurnoForm({ nome: '', hora_inicio: '06:00', hora_fim: '15:00', intervalo_inicio: '', intervalo_fim: '', ordem: turnos.length + 2 });
            loadTurnos();
        } catch (err) {
            toast.error("Erro ao salvar turno.");
        }
    };

    const handleDeleteTurno = async (id) => {
        if (window.confirm("Deseja excluir este turno? O histórico de horários pode ser impactado nas chapas atuais.")) {
            try {
                await api.delete(`/pcp/programas/turnos/${id}`);
                toast.success("Turno excluído.");
                loadTurnos();
            } catch (err) {
                toast.error("Erro ao excluir turno.");
            }
        }
    };

    // Handlers para os campos dinâmicos de Chapas Planejadas
    const handleAddChapaField = () => {
        setProgForm(prev => ({
            ...prev,
            chapas_planejadas: [...prev.chapas_planejadas, { codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }]
        }));
    };

    const handleRemoveChapaField = (index) => {
        setProgForm(prev => {
            const newChapas = [...prev.chapas_planejadas];
            newChapas.splice(index, 1);
            return {
                ...prev,
                chapas_planejadas: newChapas.length > 0 ? newChapas : [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }]
            };
        });
    };

    const handleChapaFieldChange = (index, field, value) => {
        setProgForm(prev => {
            const newChapas = [...prev.chapas_planejadas];
            newChapas[index] = { ...newChapas[index], [field]: value };
            return {
                ...prev,
                chapas_planejadas: newChapas
            };
        });
    };

    // Submissão do Formulário (Criar / Editar)
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        try {
            if (!progForm.maquina_id) {
                toast.error("Selecione uma máquina de destino.");
                return;
            }

            const chapasFiltradas = [];
            progForm.chapas_planejadas.forEach(c => {
                const codigo = c.codigo ? c.codigo.trim() : '';
                if (!codigo) return;
                const repeticoes = parseInt(c.repeticoes) || 1;
                const tempo = c.tempo || '00:00:00';
                const tipo = c.tipo || 'inteira';
                for (let i = 0; i < repeticoes; i++) {
                    chapasFiltradas.push({ codigo, tempo, tipo });
                }
            });

            if (chapasFiltradas.length === 0) {
                toast.error("Adicione pelo menos uma chapa planejada.");
                return;
            }

            const payload = {
                ...progForm,
                chapas_planejadas: chapasFiltradas,
                quantidade_vezes: chapasFiltradas.length,
                maquina_id: parseInt(progForm.maquina_id),
                criado_por: progForm.criado_por || user?.NomeCompleto || user?.nome || 'PCP'
            };

            if (editingProgId) {
                await api.put(`/pcp/programas/${editingProgId}`, payload);
                toast.success("Programa CNC atualizado com sucesso!");
            } else {
                const res = await api.post('/pcp/programas', payload);
                if (res.data && res.data.id) {
                    setHighlightedProgId(res.data.id);
                    setTimeout(() => setHighlightedProgId(null), 6000);
                }
                toast.success("Programa CNC liberado com sucesso!");
            }

            setShowFormProg(false);
            setEditingProgId(null);
            setEditingProgram(null);
            setProgForm({
                maquina_id: '',
                nome_programa: '',
                data_criacao: new Date().toISOString().substring(0, 10),
                tempo_previsto: '00:00:00',
                tipo_material: '',
                quantidade_vezes: 1,
                chapas_planejadas: [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }],
                criado_por: user?.NomeCompleto || user?.nome || '',
                turno_previsao: 1,
                recebedor_nome: '',
                recebido_data: '',
                recebido_hora: '',
                notas_instrucoes: ''
            });
            loadProgramas();
        } catch (err) {
            console.error(err);
            toast.error(editingProgId ? "Erro ao atualizar programa CNC." : "Erro ao cadastrar programa CNC.");
        }
    };

    // Carregar programa no formulário de edição
    const handleEditProgram = (prog) => {
        let chapas = [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }];
        if (prog.chapas_planejadas) {
            try {
                const parsed = typeof prog.chapas_planejadas === 'string'
                    ? JSON.parse(prog.chapas_planejadas)
                    : prog.chapas_planejadas;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const groupedMap = new Map();
                    parsed.forEach(ch => {
                        const rawCode = typeof ch === 'string' ? ch : (ch.codigo || '');
                        const tempo = typeof ch === 'string' ? '00:00:00' : (ch.tempo || '00:00:00');
                        const tipo = typeof ch === 'string' ? 'inteira' : (ch.tipo || 'inteira');

                        const match = rawCode.match(/^(.*?)\s*\(\d+\)$/);
                        const baseCode = match ? match[1].trim() : rawCode.trim();

                        const key = `${baseCode}|${tempo}|${tipo}`;
                        if (groupedMap.has(key)) {
                            groupedMap.get(key).repeticoes += 1;
                        } else {
                            groupedMap.set(key, { codigo: baseCode, repeticoes: 1, tempo, tipo });
                        }
                    });
                    chapas = Array.from(groupedMap.values());
                }
            } catch (e) {
                chapas = [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }];
            }
        }
        setProgForm({
            maquina_id: prog.maquina_id || '',
            nome_programa: prog.nome_programa || '',
            data_criacao: prog.data_criacao ? new Date(prog.data_criacao).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
            tempo_previsto: prog.tempo_previsto || '00:00:00',
            tipo_material: prog.tipo_material || '',
            quantidade_vezes: prog.quantidade_vezes || 1,
            chapas_planejadas: chapas,
            criado_por: prog.criado_por || '',
            turno_previsao: prog.turno_previsao || 1,
            recebedor_nome: prog.recebedor_nome || '',
            recebido_data: prog.recebido_data ? new Date(prog.recebido_data).toISOString().substring(0, 10) : '',
            recebido_hora: prog.recebido_hora || '',
            notas_instrucoes: prog.notas_instrucoes || ''
        });
        setEditingProgId(prog.id);
        setEditingProgram(prog);
        setShowFormProg(true);
    };

    // Duplicar programa
    const handleDuplicateProgram = (prog) => {
        let chapas = [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }];
        if (prog.chapas_planejadas) {
            try {
                const parsed = typeof prog.chapas_planejadas === 'string'
                    ? JSON.parse(prog.chapas_planejadas)
                    : prog.chapas_planejadas;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const groupedMap = new Map();
                    parsed.forEach(ch => {
                        const rawCode = typeof ch === 'string' ? ch : (ch.codigo || '');
                        const tempo = typeof ch === 'string' ? '00:00:00' : (ch.tempo || '00:00:00');
                        const tipo = typeof ch === 'string' ? 'inteira' : (ch.tipo || 'inteira');

                        const match = rawCode.match(/^(.*?)\s*\(\d+\)$/);
                        const baseCode = match ? match[1].trim() : rawCode.trim();

                        const key = `${baseCode}|${tempo}|${tipo}`;
                        if (groupedMap.has(key)) {
                            groupedMap.get(key).repeticoes += 1;
                        } else {
                            groupedMap.set(key, { codigo: baseCode, repeticoes: 1, tempo, tipo });
                        }
                    });
                    chapas = Array.from(groupedMap.values());
                }
            } catch (e) {
                chapas = [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }];
            }
        }
        
        setProgForm({
            maquina_id: prog.maquina_id || '',
            nome_programa: '', 
            data_criacao: new Date().toISOString().substring(0, 10),
            tempo_previsto: prog.tempo_previsto || '00:00:00',
            tipo_material: prog.tipo_material || '',
            quantidade_vezes: prog.quantidade_vezes || 1,
            chapas_planejadas: chapas,
            criado_por: user?.NomeCompleto || user?.nome || '', 
            turno_previsao: prog.turno_previsao || 1,
            ordem_execucao: -1,
            recebedor_nome: '', 
            recebido_data: '', 
            recebido_hora: '', 
            notas_instrucoes: prog.notas_instrucoes || ''
        });
        
        setEditingProgId(null);
        setEditingProgram(null);
        setShowFormProg(true);
    };

    // Excluir programa
    const handleDeleteProgram = async (progId) => {
        if (window.confirm("Deseja realmente excluir esta liberação de programa CNC?")) {
            try {
                await api.delete(`/pcp/programas/${progId}`);
                toast.success("Liberação excluída com sucesso.");
                loadProgramas();
            } catch (err) {
                console.error(err);
                toast.error("Erro ao excluir programa.");
            }
        }
    };

    const handleExportExcel = () => {
        try {
            const dataToExport = filteredProgramas.map(prog => ({
                "ID": prog.id,
                "Ordem": prog.ordem_execucao || 0,
                "Status": prog.status,
                "Programa": prog.nome_programa,
                "Equipamento": prog.maquina_nome || `Máquina ${prog.maquina_id}`,
                "Material": prog.tipo_material,
                "Turno": prog.turno_previsao,
                "Total Chapas": prog.quantidade_vezes,
                "Tempo Previsto (Lote)": prog.tempo_previsto,
                "Criado Por": prog.criado_por,
                "Data Liberação": prog.created_at ? new Date(prog.created_at).toLocaleString('pt-BR') : ''
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Programas CNC");
            XLSX.writeFile(workbook, `Programas_CNC_${new Date().toISOString().slice(0,10)}.xlsx`);
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
            doc.text('Relatório de Programas CNC (NCN)', 60, 20);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, 60, 26);
            doc.text(`Data Base: ${new Date().toLocaleDateString('pt-BR')}`, doc.internal.pageSize.getWidth() - 14, 20, { align: 'right' });
            
            doc.setDrawColor(200, 200, 200);
            doc.line(14, 38, doc.internal.pageSize.getWidth() - 14, 38);
            
            const tableColumn = ["ID", "Ordem", "Status", "Programa", "Máquina", "Material", "Turno", "Chapas", "Tempo"];
            const tableRows = [];
            
            filteredProgramas.forEach(prog => {
                tableRows.push([
                    `#${prog.id}`,
                    prog.ordem_execucao || 0,
                    prog.status,
                    prog.nome_programa,
                    prog.maquina_nome || `Máquina ${prog.maquina_id}`,
                    prog.tipo_material,
                    `T${prog.turno_previsao}`,
                    prog.quantidade_vezes,
                    prog.tempo_previsto
                ]);
            });
            
            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 42,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 58, 95] } 
            });
            
            doc.save(`Programas_CNC_${new Date().toISOString().slice(0,10)}.pdf`);
            toast.success("PDF gerado com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao gerar PDF.");
        }
    };

    const handlePrintProgram = (prog, baseDate, baseTime, customTurnoId) => {
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
            doc.text('FICHA TÉCNICA - PROGRAMA CNC', 60, 22);
            
            doc.setDrawColor(200, 200, 200);
            doc.line(14, 38, doc.internal.pageSize.getWidth() - 14, 38);
            
            // Caixa de Informações Principais
            doc.setDrawColor(200);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(14, 42, 269, 50, 2, 2, 'FD'); // Width was 182, now 269
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`Programa: ${prog.nome_programa}`, 20, 52);
            doc.text(`Status: ${prog.status}`, 200, 52); // X was 140, now 200
            
            doc.setFont("helvetica", "normal");
            doc.text(`Material: ${prog.tipo_material}`, 20, 60);
            doc.text(`Equipamento: ${prog.maquina_nome || prog.maquina_id}`, 200, 60);
            
            doc.text(`Criado por: ${prog.criado_por}`, 20, 68);
            doc.text(`Turno: T${prog.turno_previsao}`, 200, 68);
            
            const dataLib = prog.created_at ? new Date(prog.created_at).toLocaleString('pt-BR') : '-';
            doc.text(`Data Liberação: ${dataLib}`, 20, 76);
            
            doc.text(`Qtd. Chapas: ${prog.quantidade_vezes}`, 200, 76);
            
            // Calculando projeção de tempo para as chapas
            const chapasArray = [];
            if (prog._chapas && prog._chapas.length > 0) {
                prog._chapas.forEach((ch, idx) => {
                    if (typeof ch === 'string') chapasArray.push({ codigo: ch, tempo: prog.tempo_previsto || '00:00:00' });
                    else chapasArray.push({ ...ch, codigo: ch.codigo || `Chapa ${idx+1}`, tempo: ch.tempo || prog.tempo_previsto || '00:00:00' });
                });
            } else {
                for (let i = 0; i < prog.quantidade_vezes; i++) {
                    chapasArray.push({ codigo: `${prog.nome_programa} (${i+1})`, tempo: prog.tempo_previsto || '00:00:00' });
                }
            }

            let baseRefTime = new Date();
            if (baseDate && baseTime) {
                baseRefTime = new Date(`${baseDate}T${baseTime}:00`);
            } else if (prog.base_time_calculo) {
                baseRefTime = new Date(prog.base_time_calculo);
            }
            
            let currentCursor = getNextWorkingTime(baseRefTime, turnos);
            
            // Se o usuário selecionou um turno diferente do calculado para o Início
            let initialTurno = getTurnoForTime(currentCursor, turnos);
            
            const projArray = chapasArray.map((chapa, idx) => {
                const tempoSecs = toSecs(chapa.tempo);
                const projStart = new Date(currentCursor);
                const projEnd = addWorkingTime(projStart, tempoSecs, turnos);
                currentCursor = new Date(projEnd);
                
                let turnoAssigned = getTurnoForTime(projStart, turnos);
                
                // Força o turno customizado apenas para a primeira chapa se definido,
                // ou se ele preencheu todo um período com a mesma identificação
                if (idx === 0 && customTurnoId && turnoAssigned?.id != customTurnoId) {
                    const found = turnos.find(t => t.id == customTurnoId);
                    if (found) turnoAssigned = found;
                }
                
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

            // Mark the last chapa of each shift based on turno change or manual break
            for (let i = 0; i < projArray.length; i++) {
                const currentTurnoId = projArray[i].turnoAssigned?.id;
                const nextTurnoId = i + 1 < projArray.length ? projArray[i+1].turnoAssigned?.id : null;
                
                if (projArray[i].forcar_quebra_turno || currentTurnoId !== nextTurnoId) {
                    projArray[i].isLastOfShift = true;
                }
            }

            // Tabela de Chapas
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text('Lista de Chapas do Lote (Projeção)', 14, 102);
            
            const chapasRows = [];
            projArray.forEach((ch, idx) => {
                const projStart = ch.projStart.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
                const projEnd = ch.projEnd.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
                const turnoStr = ch.turnoAssigned ? ch.turnoAssigned.nome : '-';
                
                // Add marker for last of shift
                const marker = ch.isLastOfShift ? ' (FIM DO TURNO)' : '';
                
                chapasRows.push([
                    idx + 1, 
                    ch.codigo || '-', 
                    ch.tempo || '-', 
                    turnoStr + marker,
                    projStart,
                    '         :         ', // Espaço maior para Início Real
                    projEnd,
                    '         :         '  // Espaço maior para Fim Real
                ]);
            });
            
            autoTable(doc, {
                startY: 107,
                head: [['#', 'Código da Chapa', 'Tempo Prev.', 'Turno', 'Início Proj.', 'Início Real', 'Fim Proj.', 'Fim Real']],
                body: chapasRows,
                headStyles: { fillColor: [71, 85, 105] }, // slate-600
                alternateRowStyles: { fillColor: [248, 250, 252] },
                styles: { fontSize: 9 },
                didParseCell: function (data) {
                    if (data.section === 'body' && data.row.raw[3] && data.row.raw[3].includes('(FIM DO TURNO)')) {
                        // Highlight the row if it's the last of the shift
                        if (data.cell.section === 'body') {
                            data.cell.styles.fillColor = [254, 243, 199]; // amber-100
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            });
            
            const finalY = doc.lastAutoTable.finalY || 100;
            
            // Resumo de Turnos
            const turnosSummary = {};
            projArray.forEach(ch => {
                const tName = ch.turnoAssigned ? ch.turnoAssigned.nome : 'Sem Turno';
                if (!turnosSummary[tName]) turnosSummary[tName] = 0;
                turnosSummary[tName]++;
            });
            
            let currentY = finalY + 10;
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text('Resumo de Chapas por Turno (Saldo):', 14, currentY);
            doc.setFont("helvetica", "normal");
            Object.keys(turnosSummary).forEach((tName, i) => {
                doc.text(`${tName}: ${turnosSummary[tName]} chapa(s)`, 14, currentY + 6 + (i*5));
            });

            currentY = currentY + 6 + (Object.keys(turnosSummary).length * 5) + 5;

            // Área de Apontamento Manual (para o operador)
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text('Apontamento do Operador (Manual)', 14, currentY);
            
            doc.setDrawColor(200);
            doc.roundedRect(14, currentY + 5, 269, 60, 2, 2, 'S'); // width 269
            
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text('Inicio Real:', 20, currentY + 15);
            doc.line(40, currentY + 15, 130, currentY + 15); // underline
            
            doc.text('Fim Real:', 150, currentY + 15);
            doc.line(170, currentY + 15, 260, currentY + 15);
            
            doc.text('Operador:', 20, currentY + 30);
            doc.line(40, currentY + 30, 130, currentY + 30);
            
            doc.text('Assinatura:', 150, currentY + 30);
            doc.line(170, currentY + 30, 260, currentY + 30);
            
            doc.text('Observacoes:', 20, currentY + 45);
            doc.line(42, currentY + 45, 260, currentY + 45);
            doc.line(20, currentY + 55, 260, currentY + 55);
            
            // Abre o PDF em nova guia para visualizacao e impressao
            window.open(doc.output('bloburl'), '_blank');
        } catch (error) {
            console.error(error);
            toast.error("Erro ao gerar ficha tecnica do programa.");
        }
    };

    const handleUpdateOrdem = async (prog, valor) => {
        const novaOrdem = parseInt(valor);
        if (!novaOrdem || novaOrdem === (prog.ordem_execucao || 0)) return;

        if (filterMaquinaId !== 'all') {
            const currentIndex = filteredProgramas.findIndex(p => p.id === prog.id);
            if (currentIndex === -1) return;

            const novoArray = [...filteredProgramas];
            const [item] = novoArray.splice(currentIndex, 1);
            
            // novaOrdem is 1-based index
            let newIndex = novaOrdem - 1;
            if (newIndex < 0) newIndex = 0;
            if (newIndex > novoArray.length) newIndex = novoArray.length;
            
            novoArray.splice(newIndex, 0, item);
            updateSequenciaNoBanco(novoArray);
        } else {
            toast.warning("Selecione uma máquina específica no filtro acima para reordenar digitando a sequência.");
            loadProgramas();
        }
    };

    // Atualizar sequência no banco em lote
    const updateSequenciaNoBanco = async (novoArray) => {
        try {
            const programIds = novoArray.map(p => p.id);
            await api.put('/pcp/programas/reordenar', { programIds });
            toast.success("Sequência de execução atualizada com sucesso!");
            await loadProgramas();
        } catch (err) {
            console.error("Erro ao salvar ordenação:", err);
            toast.error("Erro ao salvar a nova sequência de execução.");
        }
    };

    // Drag and Drop Handlers
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
    };

    const handleDrop = async (e, targetIndex) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIndex) return;

        const novoArray = [...filteredProgramas];
        const [draggedItem] = novoArray.splice(draggedIndex, 1);
        novoArray.splice(targetIndex, 0, draggedItem);

        setDraggedIndex(null);
        await updateSequenciaNoBanco(novoArray);
    };

    // Setas Subir/Descer
    const handleSubir = async (index) => {
        if (index === 0) return;
        const novoArray = [...filteredProgramas];
        const temp = novoArray[index];
        novoArray[index] = novoArray[index - 1];
        novoArray[index - 1] = temp;
        await updateSequenciaNoBanco(novoArray);
    };

    const handleDescer = async (index) => {
        if (index === filteredProgramas.length - 1) return;
        const novoArray = [...filteredProgramas];
        const temp = novoArray[index];
        novoArray[index] = novoArray[index + 1];
        novoArray[index + 1] = temp;
        await updateSequenciaNoBanco(novoArray);
    };

    const handleStatusChange = async (prog, novoStatus) => {
        try {
            const agora = new Date();
            const ano = agora.getFullYear();
            const mes = String(agora.getMonth() + 1).padStart(2, '0');
            const dia = String(agora.getDate()).padStart(2, '0');
            const dataLocal = `${ano}-${mes}-${dia}`;
            const horaLocal = agora.toLocaleTimeString('pt-BR', { hour12: false });
            const nomeUsuario = user?.NomeCompleto || user?.nome || 'Operador';

            const payload = {
                status: novoStatus,
                recebedor_nome: nomeUsuario,
                recebido_data: dataLocal,
                recebido_hora: horaLocal
            };

            await api.put(`/pcp/programas/${prog.id}`, payload);
            toast.success(`Status do programa #${prog.id} atualizado para ${novoStatus}!`);
            loadProgramas();
        } catch (err) {
            console.error("Erro ao alterar status manualmente:", err);
            toast.error("Erro ao atualizar o status do programa.");
        }
    };

    // Filtragem + pré-parse de chapas (evita JSON.parse repetido no render por linha)
    const filteredProgramas = useMemo(() => {
        const term = searchQuery.toLowerCase();
        return programas
            .filter(p => {
                const nome = p.nome_programa ? p.nome_programa.toLowerCase() : '';
                const material = p.tipo_material ? p.tipo_material.toLowerCase() : '';
                const matchesSearch = nome.includes(term) || material.includes(term);
                const matchesMaquina = filterMaquinaId === 'all' || String(p.maquina_id) === String(filterMaquinaId);
                
                let matchesStatus = false;
                if (filterStatus === 'all') {
                    matchesStatus = showConcluidos ? true : p.status !== 'CONCLUIDO';
                } else {
                    matchesStatus = p.status === filterStatus;
                }
                
                return matchesSearch && matchesMaquina && matchesStatus;
            })
            .map(p => {
                let _chapas = [];
                try {
                    const raw = typeof p.chapas_planejadas === 'string'
                        ? JSON.parse(p.chapas_planejadas)
                        : (p.chapas_planejadas || []);
                    _chapas = Array.isArray(raw) ? raw : [];
                } catch (_) {}
                return { ...p, _chapas };
            });
    }, [programas, searchQuery, filterMaquinaId, filterStatus, showConcluidos]);

    const canChangeMachine = useMemo(() => {
        if (!editingProgId) return true;
        if (!editingProgram) return false;
        const concluidas = Number(editingProgram.chapas_concluidas || 0);
        const emAndamento = Number(editingProgram.chapas_em_andamento || 0);
        return concluidas === 0 && emAndamento === 0;
    }, [editingProgId, editingProgram]);

    return (
        <div className="p-6 w-full space-y-6">
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleUp {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-fade-in {
                    animation: fadeIn 0.2s ease-out forwards;
                }
                .animate-scale-up {
                    animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>

            {/* Cabeçalho Premium */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="z-10">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">Programas CNC</h1>
                    <p className="text-xs md:text-sm text-slate-400 mt-1">Gerenciamento e liberação de arquivos de corte por equipamento e especificações de processo</p>
                </div>
                
                <div className="flex items-center gap-3 z-10 flex-wrap justify-end">
                    <button
                        onClick={() => setShowConfigTurnos(true)}
                        className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md hover:-translate-y-0.5"
                    >
                        <Settings size={16} /> Configurar Turnos
                    </button>
                    <button
                        onClick={() => {
                            setEditingProgId(null);
                            setEditingProgram(null);
                            setProgForm({
                                maquina_id: '',
                                nome_programa: '',
                                data_criacao: new Date().toISOString().substring(0, 10),
                                tempo_previsto: '00:00:00',
                                tipo_material: '',
                                quantidade_vezes: 1,
                                chapas_planejadas: [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }],
                                criado_por: user?.NomeCompleto || user?.nome || '',
                                turno_previsao: 1,
                                recebedor_nome: '',
                                recebido_data: '',
                                recebido_hora: '',
                                notas_instrucoes: ''
                            });
                            setShowFormProg(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md hover:scale-105 hover:-translate-y-0.5"
                    >
                        <Plus size={16} /> Liberar Novo Programa
                    </button>
                </div>
            </div>

            {/* Barra de Filtros Unificada */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-4">
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

                {/* Filtro de Máquina */}
                <div className="w-full md:w-64">
                    <select
                        value={filterMaquinaId}
                        onChange={(e) => setFilterMaquinaId(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-xl p-3 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                    >
                        <option value="all">Todas as Máquinas</option>
                        {maquinas.map(m => (
                            <option key={m.id} value={m.id}>
                                {m.nome} {m.tag_identificacao ? `[${m.tag_identificacao}]` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Filtro de Status */}
                <div className="w-full md:w-48">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-xl p-3 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                    >
                        <option value="all">Todos os Status</option>
                        <option value="LIBERADO">LIBERADO</option>
                        <option value="EM_EXECUCAO">EM EXECUÇÃO</option>
                        <option value="EM_MONTAGEM">EM MONTAGEM</option>
                        <option value="CONCLUIDO">CONCLUÍDO</option>
                    </select>
                </div>

                {/* Filtro de Concluídos */}
                <div className="w-full md:w-auto flex items-center">
                    <label className="flex items-center cursor-pointer select-none text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl hover:bg-slate-100 transition-colors w-full md:w-auto justify-center">
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
                    onClick={loadProgramas}
                    className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 px-4 py-3 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors border border-slate-200 w-full md:w-auto shrink-0"
                    title="Recarregar Dados"
                >
                    <RefreshCw size={14} />
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

            {filterMaquinaId === 'all' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3 text-slate-500 text-xs">
                    <AlertCircle size={16} className="text-slate-400 shrink-0" />
                    <span>
                        <strong>Dica de Sequenciamento:</strong> Selecione uma máquina específica no filtro acima para poder reordenar a sequência de corte arrastando as linhas ou usando as setas.
                    </span>
                </div>
            )}

            {/* Tabela de Liberações */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loadingProgramas ? (
                    <div className="p-16 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : filteredProgramas.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 text-xs">
                        Nenhum programa cadastrado ou liberado com os filtros selecionados.
                    </div>
                ) : (
                    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-thin scrollbar-thumb-slate-200">
                        <table className="w-full text-left border-collapse text-xs relative">
                            <thead className="sticky top-0 z-10 shadow-sm">
                                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                    {/* <th className="px-5 py-4 w-12 text-center bg-slate-50 border-b border-slate-200">ID</th> */}
                                    <th className="px-5 py-4 w-20 text-center bg-slate-50 border-b border-slate-200">Seq.</th>
                                    <th className="px-5 py-4 w-28 text-center bg-slate-50 border-b border-slate-200">Status</th>
                                    <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">Programa CNC</th>
                                    <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">Equipamento</th>
                                    <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">Material</th>
                                    <th className="px-5 py-4 w-16 text-center bg-slate-50 border-b border-slate-200">Turno</th>
                                    <th className="px-5 py-4 max-w-[280px] bg-slate-50 border-b border-slate-200">Chapas do Lote</th>
                                    <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">Tempo (Prev. / Exec.)</th>
                                    <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">Assinatura / Controle</th>
                                    <th className="px-5 py-4 w-24 text-center bg-slate-50 border-b border-slate-200">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredProgramas.map((prog, idx) => (
                                    <tr 
                                        key={prog.id} 
                                        draggable={filterMaquinaId !== 'all'}
                                        onDragStart={(e) => handleDragStart(e, idx)}
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDrop={(e) => handleDrop(e, idx)}
                                        onDragEnd={() => setDraggedIndex(null)}
                                        className={`hover:bg-slate-50/50 transition-colors duration-1000 ${
                                            highlightedProgId === prog.id ? 'bg-yellow-100/80 border-l-4 border-yellow-500' : ''
                                        } ${
                                            filterMaquinaId !== 'all' ? 'cursor-grab active:cursor-grabbing' : ''
                                        } ${draggedIndex === idx ? 'opacity-40 bg-slate-100 border-dashed border-indigo-300' : ''}`}
                                    >
                                        {/* <td className="px-5 py-4 text-center font-bold text-slate-400 font-mono">
                                            <div className="flex items-center justify-center gap-1">
                                                {filterMaquinaId !== 'all' && (
                                                    <GripVertical size={12} className="text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-500 shrink-0" title="Arraste para reordenar" />
                                                )}
                                                <span>#{prog.id}</span>
                                            </div>
                                        </td> */}
                                        <td className="px-5 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {filterMaquinaId !== 'all' && (
                                                    <div className="flex flex-col gap-0.5">
                                                        <button 
                                                            onClick={() => handleSubir(idx)} 
                                                            disabled={idx === 0}
                                                            className={`p-0.5 rounded hover:bg-slate-200 text-slate-500 transition-colors ${idx === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
                                                            title="Subir posição"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7"></path>
                                                            </svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDescer(idx)} 
                                                            disabled={idx === filteredProgramas.length - 1}
                                                            className={`p-0.5 rounded hover:bg-slate-200 text-slate-500 transition-colors ${idx === filteredProgramas.length - 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                                                            title="Descer posição"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                )}
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    key={prog.id + '-' + (prog.ordem_execucao || 0)}
                                                    defaultValue={prog.ordem_execucao || 0}
                                                    onBlur={(e) => handleUpdateOrdem(prog, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleUpdateOrdem(prog, e.target.value);
                                                            e.target.blur();
                                                        }
                                                    }}
                                                    className="w-10 text-center border border-slate-200 rounded-lg p-1 text-[11px] font-bold focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 hover:bg-white transition-all outline-none font-mono"
                                                    title="Digite a ordem e clique fora ou aperte Enter"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <div className="relative inline-block w-28">
                                                <select
                                                    value={prog.status}
                                                    onChange={(e) => handleStatusChange(prog, e.target.value)}
                                                    className={`w-full text-center appearance-none cursor-pointer font-black text-[9px] uppercase border tracking-wider rounded-full px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white ${
                                                        prog.status === 'CONCLUIDO' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        prog.status === 'EM_EXECUCAO' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                        prog.status === 'EM_MONTAGEM' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                        'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}
                                                >
                                                    <option value="LIBERADO">LIBERADO</option>
                                                    <option value="EM_EXECUCAO">EM EXECUÇÃO</option>
                                                    <option value="EM_MONTAGEM">EM MONTAGEM</option>
                                                    <option value="CONCLUIDO">CONCLUÍDO</option>
                                                </select>
                                            </div>
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
                                            {prog.maquina_tag && <div className="text-[10px] text-slate-400 mt-0.5">TAG: {prog.maquina_tag}</div>}
                                        </td>
                                        <td className="px-5 py-4 text-slate-600 font-medium">{prog.tipo_material}</td>
                                        <td className="px-5 py-4 text-center font-bold text-slate-600 bg-slate-50/50">T{prog.turno_previsao}</td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="font-bold text-slate-700">{prog.quantidade_vezes} chapa(s)</span>
                                                <div className="flex flex-wrap gap-1 max-w-[280px]">
                                                    {prog._chapas.length > 0 ? (() => {
                                                        const limit = 2;
                                                        const visible = prog._chapas.slice(0, limit);
                                                        const restCount = prog._chapas.length - limit;
                                                        return (
                                                            <>
                                                                {visible.map((ch, i) => (
                                                                    <span key={i} className="bg-slate-50 text-slate-700 px-1.5 py-0.5 rounded-md font-mono text-[9px] border border-slate-200" title={typeof ch === 'string' ? ch : ch.codigo}>
                                                                        {typeof ch === 'string' ? ch : ch.codigo.substring(0, 15) + (ch.codigo.length > 15 ? '...' : '')}
                                                                    </span>
                                                                ))}
                                                                {restCount > 0 && (
                                                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-slate-200" title="Veja os detalhes na edição">
                                                                        +{restCount} mais
                                                                    </span>
                                                                )}
                                                            </>
                                                        );
                                                    })() : <span className="text-slate-400 text-[10px]">-</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            {(() => {
                                                const tempoPrevTotal = prog._chapas.length > 0
                                                    ? secondsToHhmmss(prog._chapas.reduce((sum, ch) => sum + hhmmssToSeconds(ch.tempo), 0))
                                                    : secondsToHhmmss(hhmmssToSeconds(prog.tempo_previsto) * prog.quantidade_vezes);
                                                const tempoRealTotal = secondsToHhmmss(prog.total_realizado_segundos || 0);
                                                return (
                                                    <div className="space-y-1 font-mono font-bold text-slate-700">
                                                        <div className="flex items-center gap-1.5 text-[11px]" title="Tempo Total Previsto para o Lote">
                                                            <Clock size={12} className="text-slate-400" />
                                                            <span>{tempoPrevTotal}</span>
                                                            <span className="text-[9px] text-slate-400 font-sans font-normal uppercase tracking-wider">(Prev)</span>
                                                        </div>
                                                        <div className={`flex items-center gap-1.5 text-[11px] ${prog.total_realizado_segundos > 0 ? 'text-green-600' : 'text-slate-400'}`} title="Tempo já Executado">
                                                            <RefreshCw size={12} className={prog.status === 'EM_EXECUCAO' ? 'animate-spin' : ''} />
                                                            <span>{tempoRealTotal}</span>
                                                            <span className="text-[9px] font-sans font-normal uppercase tracking-wider">(Exec)</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-5 py-4">
                                            {prog.recebedor_nome ? (
                                                <div className="space-y-0.5 text-slate-600">
                                                    <div className="font-semibold text-slate-800">{prog.recebedor_nome}</div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {prog.recebido_data ? new Date(prog.recebido_data).toLocaleDateString('pt-BR') : ''} {prog.recebido_hora || ''}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded inline-flex items-center gap-1">
                                                    <AlertCircle size={10} /> Pendente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => setPrintModalProg(prog)}
                                                    className="text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 p-2 rounded-xl transition-all"
                                                    title="Imprimir Ficha Técnica do Programa"
                                                >
                                                    <Printer size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDuplicateProgram(prog)}
                                                    className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded-xl transition-all"
                                                    title="Duplicar programa"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleEditProgram(prog)}
                                                    className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-xl transition-all"
                                                    title="Editar liberação"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProgram(prog.id)}
                                                    className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-xl transition-all"
                                                    title="Excluir liberação"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Cadastro e Edição */}
            {showFormProg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FileText size={18} className="text-indigo-600" />
                                {editingProgId ? "Editar Liberação de Programa CNC" : "Nova Liberação de Arquivo CNC"}
                            </h4>
                            <button 
                                type="button" 
                                onClick={() => {
                                    setShowFormProg(false);
                                    setEditingProgId(null);
                                    setEditingProgram(null);
                                }}
                                className="text-slate-400 hover:text-red-500 hover:bg-slate-100 p-1.5 rounded-lg transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Seletor de Máquina de Destino */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Máquina de Destino *</label>
                                    <select
                                        required
                                        value={progForm.maquina_id}
                                        onChange={e => setProgForm({...progForm, maquina_id: e.target.value})}
                                        className={`w-full border rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 bg-white ${
                                            !canChangeMachine 
                                                ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' 
                                                : 'border-slate-300 text-slate-800'
                                        }`}
                                        disabled={!canChangeMachine}
                                    >
                                        <option value="">Selecione uma máquina...</option>
                                        {maquinas.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.nome} {m.tag_identificacao ? `[${m.tag_identificacao}]` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {editingProgId && (
                                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium leading-normal">
                                            {canChangeMachine ? (
                                                <>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
                                                    <span className="text-green-600">
                                                        Permitido alterar o equipamento pois nenhuma chapa deste lote foi iniciada.
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                                    <span className="text-amber-600">
                                                        Equipamento bloqueado pois já existem chapas em execução ou concluídas.
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Nome do Programa */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nome do Programa CNC *</label>
                                    <input
                                        required
                                        type="text"
                                        value={progForm.nome_programa}
                                        onChange={e => setProgForm({...progForm, nome_programa: e.target.value})}
                                        className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 font-bold"
                                        placeholder="Ex: PRG-1029-CNC"
                                    />
                                </div>

                                {/* Data de Criação */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Criação *</label>
                                    <input
                                        required
                                        type="date"
                                        value={progForm.data_criacao}
                                        onChange={e => setProgForm({...progForm, data_criacao: e.target.value})}
                                        className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* Tipo de Material */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Material *</label>
                                    <input
                                        required
                                        type="text"
                                        value={progForm.tipo_material}
                                        onChange={e => setProgForm({...progForm, tipo_material: e.target.value})}
                                        className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Ex: Chapa Fina Frio 1.5mm"
                                    />
                                </div>

                                {/* Turno Previsão */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Turno Previsão *</label>
                                    <select
                                        value={progForm.turno_previsao}
                                        onChange={e => setProgForm({...progForm, turno_previsao: parseInt(e.target.value) || 1})}
                                        className="w-full border border-slate-300 rounded p-2 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                                    >
                                        {turnos && turnos.length > 0 ? (
                                            turnos.map(t => (
                                                <option key={t.id} value={t.ordem}>{t.nome}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="1">Turno 1</option>
                                                <option value="2">Turno 2</option>
                                                <option value="3">Turno 3</option>
                                                <option value="4">Turno 4</option>
                                            </>
                                        )}
                                    </select>
                                </div>

                                {/* Criado Por */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Criado Por *</label>
                                    <input
                                        required
                                        type="text"
                                        value={progForm.criado_por}
                                        onChange={e => setProgForm({...progForm, criado_por: e.target.value})}
                                        className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* Chapas Planejadas */}
                                <div className="col-span-1 md:col-span-2 border-t pt-3 mt-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-bold text-slate-700">Chapas Planejadas e Tempos Estimados *</label>
                                        <button
                                            type="button"
                                            onClick={handleAddChapaField}
                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-0.5 border border-indigo-200 transition-colors"
                                        >
                                            <Plus size={10} /> Adicionar Chapa
                                        </button>
                                    </div>
                                    
                                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm max-h-56 overflow-y-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                                                    <th className="px-4 py-2.5 w-10 text-center">#</th>
                                                    <th className="px-4 py-2.5">Código da Chapa *</th>
                                                    <th className="px-4 py-2.5 w-32 text-center">Tipo</th>
                                                    <th className="px-4 py-2.5 w-24 text-center">Repetições (x)</th>
                                                    <th className="px-4 py-2.5 w-32">Tempo / Chapa *</th>
                                                    <th className="px-4 py-2.5 w-32">Tempo Total</th>
                                                    <th className="px-4 py-2.5 w-12 text-center"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {progForm.chapas_planejadas.map((chapa, idx) => {
                                                    const totalSeconds = hhmmssToSeconds(chapa.tempo) * (parseInt(chapa.repeticoes) || 1);
                                                    const tempoTotal = secondsToHhmmss(totalSeconds);
                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-4 py-2.5 text-slate-400 font-mono font-bold text-center">{idx + 1}</td>
                                                            <td className="px-4 py-2.5">
                                                                <input
                                                                    required
                                                                    type="text"
                                                                    value={chapa.codigo || ''}
                                                                    onChange={e => handleChapaFieldChange(idx, 'codigo', e.target.value)}
                                                                    placeholder="Ex: 4202 - Jabil-00005"
                                                                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold text-slate-700"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[10px] font-bold w-fit mx-auto">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleChapaFieldChange(idx, 'tipo', 'inteira')}
                                                                        className={`px-2 py-1.5 transition-colors ${(chapa.tipo || 'inteira') === 'inteira' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                                                                    >
                                                                        Inteira
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleChapaFieldChange(idx, 'tipo', 'retalho')}
                                                                        className={`px-2 py-1.5 transition-colors ${(chapa.tipo || 'inteira') === 'retalho' ? 'bg-amber-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                                                                    >
                                                                        Retalho
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <input
                                                                    required
                                                                    type="number"
                                                                    min="1"
                                                                    value={chapa.repeticoes || 1}
                                                                    onChange={e => handleChapaFieldChange(idx, 'repeticoes', parseInt(e.target.value) || 1)}
                                                                    className="w-full border border-slate-300 rounded-lg p-2 text-xs text-center focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <input
                                                                    required
                                                                    type="text"
                                                                    pattern="[0-9]{2,}:[0-9]{2}:[0-9]{2}"
                                                                    value={chapa.tempo || '00:00:00'}
                                                                    onChange={e => handleChapaFieldChange(idx, 'tempo', e.target.value)}
                                                                    placeholder="00:00:00"
                                                                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-slate-600 font-mono font-bold">{tempoTotal}</td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                {progForm.chapas_planejadas.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveChapaField(idx)}
                                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    {(() => {
                                        const totalChapasCalculadas = progForm.chapas_planejadas.reduce((sum, ch) => sum + (parseInt(ch.repeticoes) || 1), 0);
                                        const totalSecondsLote = progForm.chapas_planejadas.reduce((sum, ch) => sum + (hhmmssToSeconds(ch.tempo) * (parseInt(ch.repeticoes) || 1)), 0);
                                        return (
                                            <div className="text-[11px] text-slate-500 font-bold mt-2 flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                <div>
                                                    Total de Chapas Físicas: <span className="text-indigo-600 text-xs font-black ml-1">{totalChapasCalculadas}</span>
                                                </div>
                                                <div>
                                                    Tempo Total Estimado do Lote: <span className="text-slate-700 text-xs font-mono font-black ml-1">
                                                        {secondsToHhmmss(totalSecondsLote)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Controle de Recebimento Opcional */}
                            <div className="border-t pt-3 mt-3">
                                <h5 className="text-xs font-bold text-slate-700 mb-2">Campos de Controle de Recebimento (Pré-assinatura Opcional)</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Nome do Recebedor</label>
                                        <input
                                            type="text"
                                            value={progForm.recebedor_nome || ''}
                                            onChange={e => setProgForm({...progForm, recebedor_nome: e.target.value})}
                                            className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                            placeholder="Operador / Supervisor"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Data / Hora de Recebimento</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="date"
                                                value={progForm.recebido_data || ''}
                                                onChange={e => setProgForm({...progForm, recebido_data: e.target.value})}
                                                className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                            />
                                            <input
                                                type="time"
                                                value={progForm.recebido_hora || ''}
                                                onChange={e => setProgForm({...progForm, recebido_hora: e.target.value})}
                                                className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Notas de Instruções</label>
                                        <textarea
                                            rows="2"
                                            value={progForm.notas_instrucoes || ''}
                                            onChange={e => setProgForm({...progForm, notas_instrucoes: e.target.value})}
                                            className="w-full border border-slate-300 rounded p-2 text-xs resize-none focus:ring-1 focus:ring-indigo-500"
                                            placeholder="Instruções de bocal, velocidade, gás, etc..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer Controls */}
                            <div className="flex justify-end gap-2 border-t pt-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowFormProg(false);
                                        setEditingProgId(null);
                                        setEditingProgram(null);
                                    }}
                                    className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm"
                                >
                                    {editingProgId ? "Salvar Alterações" : "Liberar Programa"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal de Configuração de Turnos */}
            {showConfigTurnos && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
                        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <Settings size={20} className="text-indigo-400" />
                                    Configuração de Turnos PCP
                                </h3>
                                <p className="text-xs text-slate-400">Gerencie os horários e intervalos para projeção de chapas.</p>
                            </div>
                            <button onClick={() => setShowConfigTurnos(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                            {/* Formulário */}
                            <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 p-6 overflow-y-auto">
                                <h4 className="text-sm font-bold text-slate-700 mb-4">{editingTurno ? 'Editar Turno' : 'Novo Turno'}</h4>
                                <form onSubmit={handleSaveTurno} className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Nome/Identificador</label>
                                        <input required type="text" value={turnoForm.nome} onChange={e => setTurnoForm({...turnoForm, nome: e.target.value})} placeholder="Ex: Turno 1" className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500" />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="w-1/2">
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Hora Início</label>
                                            <input required type="time" value={turnoForm.hora_inicio} onChange={e => setTurnoForm({...turnoForm, hora_inicio: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500" />
                                        </div>
                                        <div className="w-1/2">
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Hora Fim</label>
                                            <input required type="time" value={turnoForm.hora_fim} onChange={e => setTurnoForm({...turnoForm, hora_fim: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="w-1/2">
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Início do Intervalo</label>
                                            <input type="time" value={turnoForm.intervalo_inicio || ''} onChange={e => setTurnoForm({...turnoForm, intervalo_inicio: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500" />
                                        </div>
                                        <div className="w-1/2">
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Fim do Intervalo</label>
                                            <input type="time" value={turnoForm.intervalo_fim || ''} onChange={e => setTurnoForm({...turnoForm, intervalo_fim: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Ordem (Sequência)</label>
                                        <input required type="number" min="1" value={turnoForm.ordem} onChange={e => setTurnoForm({...turnoForm, ordem: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500" />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button type="submit" className="flex-1 bg-indigo-600 text-white rounded p-2 text-xs font-bold hover:bg-indigo-700">
                                            {editingTurno ? 'Salvar Edição' : 'Adicionar Turno'}
                                        </button>
                                        {editingTurno && (
                                            <button type="button" onClick={() => { setEditingTurno(null); setTurnoForm({ nome: '', hora_inicio: '06:00', hora_fim: '15:00', intervalo_inicio: '', intervalo_fim: '', ordem: turnos.length + 1 }); }} className="bg-slate-200 text-slate-700 rounded p-2 text-xs font-bold hover:bg-slate-300">
                                                Cancelar
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                            {/* Lista */}
                            <div className="w-full md:w-2/3 p-6 overflow-y-auto">
                                <h4 className="text-sm font-bold text-slate-700 mb-4">Turnos Cadastrados</h4>
                                {loadingTurnos ? (
                                    <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div></div>
                                ) : turnos.length === 0 ? (
                                    <div className="text-center text-xs text-slate-400 p-8">Nenhum turno cadastrado. Crie um ao lado.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {turnos.map(t => (
                                            <div key={t.id} className="border border-slate-200 bg-white rounded-xl p-4 flex items-center justify-between hover:shadow-sm">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded">Seq: {t.ordem}</span>
                                                        <h5 className="font-bold text-slate-800 text-sm">{t.nome}</h5>
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1 font-mono">
                                                        {t.hora_inicio.substring(0,5)} as {t.hora_fim.substring(0,5)}
                                                        {t.intervalo_inicio && t.intervalo_fim && (
                                                            <span className="ml-3 text-orange-500">
                                                                (Pausa: {t.intervalo_inicio.substring(0,5)} as {t.intervalo_fim.substring(0,5)})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => {
                                                        setEditingTurno(t);
                                                        setTurnoForm({
                                                            nome: t.nome,
                                                            hora_inicio: t.hora_inicio.substring(0,5),
                                                            hora_fim: t.hora_fim.substring(0,5),
                                                            intervalo_inicio: t.intervalo_inicio ? t.intervalo_inicio.substring(0,5) : '',
                                                            intervalo_fim: t.intervalo_fim ? t.intervalo_fim.substring(0,5) : '',
                                                            ordem: t.ordem
                                                        });
                                                    }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                                                        <Edit size={16} />
                                                    </button>
                                                    <button onClick={() => handleDeleteTurno(t.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {printModalProg && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Printer size={20} />
                                Configurar Ficha Técnica
                            </h2>
                            <button onClick={() => setPrintModalProg(null)} className="text-white/70 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg text-sm border border-emerald-100 flex gap-3">
                                <Info size={18} className="shrink-0 mt-0.5" />
                                <p>Defina o momento exato em que o primeiro item do Lote começará a ser produzido. As demais chapas seguirão os horários configurados na sua estrutura de Turnos.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Data Inicial</label>
                                    <input 
                                        type="date"
                                        value={printSettings.date}
                                        onChange={(e) => {
                                            const newDate = e.target.value;
                                            const newSettings = { ...printSettings, date: newDate };
                                            
                                            // Atualiza turno sugerido
                                            const simulatedDate = new Date(`${newDate}T${printSettings.time}:00`);
                                            const autoTurno = getTurnoForTime(simulatedDate, turnos);
                                            if (autoTurno) newSettings.turnoId = autoTurno.id;
                                            
                                            setPrintSettings(newSettings);
                                        }}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Hora Inicial</label>
                                    <input 
                                        type="time"
                                        value={printSettings.time}
                                        onChange={(e) => {
                                            const newTime = e.target.value;
                                            const newSettings = { ...printSettings, time: newTime };
                                            
                                            // Atualiza turno sugerido
                                            const simulatedDate = new Date(`${printSettings.date}T${newTime}:00`);
                                            const autoTurno = getTurnoForTime(simulatedDate, turnos);
                                            if (autoTurno) newSettings.turnoId = autoTurno.id;
                                            
                                            setPrintSettings(newSettings);
                                        }}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Turno Base (Forçado)</label>
                                <select
                                    value={printSettings.turnoId}
                                    onChange={(e) => setPrintSettings(prev => ({ ...prev, turnoId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                                >
                                    <option value="">Selecione um Turno (Opcional)</option>
                                    {turnos.map(t => (
                                        <option key={t.id} value={t.id}>
                                            Turno {t.nome} ({t.hora_inicio.substring(0,5)} as {t.hora_fim.substring(0,5)})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">* Normalmente é detectado sozinho baseado na hora acima. Altere apenas se quiser forçar o início no cabeçalho/primeira chapa.</p>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button 
                                onClick={() => setPrintModalProg(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => {
                                    handlePrintProgram(printModalProg, printSettings.date, printSettings.time, printSettings.turnoId);
                                    setPrintModalProg(null);
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                            >
                                <Printer size={16} />
                                Gerar e Baixar PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
