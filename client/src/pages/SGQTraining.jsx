import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Network,
    ClipboardList,
    Users,
    Target,
    FileCheck,
    Plus,
    GraduationCap
} from 'lucide-react';
import ProcessMappingForm from '../components/ProcessMappingForm';
import OrganogramBuilder from '../components/OrganogramBuilder';

const SGQTraining = () => {
    const navigate = useNavigate();
    const [view, setView] = useState('list'); // 'list', 'map', 'organogram'
    const [showProcessForm, setShowProcessForm] = useState(false);

    // Mock data based on the manual example
    const [processes, setProcesses] = useState([
        {
            id: 1,
            sector: 'Corte a Laser',
            leader: 'João Silva',
            activity: 'Corte de chapas metálicas CNC',
            supplier: 'Amoxarifado',
            inputs: 'Chapas aço/inox + OP + Arquivo CAD',
            outputs: 'Peças cortadas e identificadas',
            customer: 'Dobra / Solda',
            mission: 'Garantir corte preciso conforme especificação para alimentar processo de dobra',
            supportActivities: 'Limpeza de lente, Manutenção preventiva, Reportar peças refugadas'
        }
    ]);

    const [editingProcess, setEditingProcess] = useState(null);

    const handleEdit = (process) => {
        setEditingProcess(process);
        setShowProcessForm(true);
    };

    const handleCloseForm = () => {
        setShowProcessForm(false);
        setEditingProcess(null);
    };

    const handleSaveProcess = (processData) => {
        if (editingProcess) {
            // Edit existing
            setProcesses(prev => prev.map(p =>
                p.id === editingProcess.id ? { ...processData, id: editingProcess.id } : p
            ));
        } else {
            // Create new
            setProcesses(prev => [...prev, { ...processData, id: prev.length + 1 }]);
        }
        handleCloseForm();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <button
                        onClick={() => navigate('/sgq')}
                        className="flex items-center text-gray-500 hover:text-blue-600 mb-4 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar para SGQ
                    </button>

                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <Target className="h-7 w-7 text-blue-600" />
                                Gestão de Processos e Treinamento
                            </h1>
                            <p className="text-gray-500 mt-1">Mapeamento, organização hierárquica e definição de responsabilidades</p>
                        </div>

                        {view === 'list' && (
                            <button
                                onClick={() => setShowProcessForm(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <Plus className="h-4 w-4" />
                                Novo Mapeamento
                            </button>
                        )}

                        {/* view === 'organogram' handled inside the builder itself or we can keep a button if needed. 
                            Actually, the builder manages its own 'Add Node', so we might hide the header button 
                            or make it trigger the builder's add method via ref (too complex).
                            Let's just hide the header button for organogram since the builder has its own toolbar. 
                        */}

                        {view === 'matrix' && (
                            <button
                                onClick={() => alert('Funcionalidade de Matriz em desenvolvimento')}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <Plus className="h-4 w-4" />
                                Nova Competência
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Menu Tabs */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div
                        onClick={() => setView('list')}
                        className={`bg-white p-6 rounded-xl shadow-sm border-2 cursor-pointer transition-all ${view === 'list' ? 'border-blue-500 ring-4 ring-blue-50' : 'border-transparent hover:border-gray-200'}`}
                    >
                        <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                            <ClipboardList className="h-6 w-6 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Processos Mapeados</h3>
                        <p className="text-gray-500 text-sm mt-2">Visão geral de todos os processos, entradas e saídas definidos.</p>
                    </div>

                    <div
                        onClick={() => setView('organogram')}
                        className={`bg-white p-6 rounded-xl shadow-sm border-2 cursor-pointer transition-all ${view === 'organogram' ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-transparent hover:border-gray-200'}`}
                    >
                        <div className="bg-indigo-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                            <Network className="h-6 w-6 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Organograma</h3>
                        <p className="text-gray-500 text-sm mt-2">Estrutura hierárquica e responsabilidades por setor.</p>
                    </div>

                    <div
                        onClick={() => setView('matrix')}
                        className={`bg-white p-6 rounded-xl shadow-sm border-2 cursor-pointer transition-all ${view === 'matrix' ? 'border-green-500 ring-4 ring-green-50' : 'border-transparent hover:border-gray-200'}`}
                    >
                        <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                            <Users className="h-6 w-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Matriz de Competências</h3>
                        <p className="text-gray-500 text-sm mt-2">Controle de treinamentos e habilidades da equipe.</p>
                    </div>
                </div>

                {/* Content Area */}
                {view === 'list' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-800">Fichas de Processo Ativas</h3>
                            <span className="text-sm text-gray-500">{processes.length} processos cadastrados</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3">Setor / Líder</th>
                                        <th className="px-6 py-3">Atividade Principal</th>
                                        <th className="px-6 py-3">Entradas (Inputs)</th>
                                        <th className="px-6 py-3">Saídas (Outputs)</th>
                                        <th className="px-6 py-3">Cliente Interno</th>
                                        <th className="px-6 py-3 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {processes.map((proc) => (
                                        <tr key={proc.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{proc.sector}</div>
                                                <div className="text-gray-500 text-xs">{proc.leader}</div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 max-w-xs truncate" title={proc.activity}>
                                                {proc.activity}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={proc.inputs}>
                                                {proc.inputs}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={proc.outputs}>
                                                {proc.outputs}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {proc.customer}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleEdit(proc)}
                                                    className="text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
                                                >
                                                    Ver / Editar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {view === 'organogram' && (
                    <OrganogramBuilder />
                )}

                {view === 'matrix' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
                        <GraduationCap className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900">Matriz de Competências</h3>
                        <p className="max-w-md mx-auto mt-2">O controle de treinamentos e habilidades da equipe será gerenciado nesta seção.</p>
                    </div>
                )}
            </div>

            {/* Modal de Mapeamento */}
            {showProcessForm && (
                <ProcessMappingForm
                    onClose={handleCloseForm}
                    onSave={handleSaveProcess}
                    initialData={editingProcess}
                />
            )}
        </div>
    );
};

export default SGQTraining;
