import re

filepath = r"c:\Users\lynx\Documents\MetalFisa Anty\client\src\pages\Settings.jsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Title
content = content.replace(
    '<h2 className="text-lg font-bold text-slate-800">Automações & Avisos</h2>',
    '<h2 className="text-lg font-bold text-slate-800">Automações & Avisos (WhatsApp)</h2>'
)

# 2. Add second grid
insertion_point = "                            {/* Notificações de Faturamento por E-mail */}"
new_grid = """
                            <div className="flex items-center gap-3 mt-8 mb-4">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <Mail className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Automações & Avisos (E-mail)</h2>
                                    <p className="text-sm text-slate-500">Controle independente para disparo de relatórios e alertas por e-mail.</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Notificações Meu Canal (Email) */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Notificação Meu Canal (Performance)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Resumo diário enviado por E-mail às 06:00 e 15:00.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.meu_canal_email_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, meu_canal_email_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.meu_canal_email_active !== false ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.meu_canal_email_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Visão Gerencial Faturamento (Email) */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Visão Gerencial (Faturamento)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Alerta noturno sobre solicitações em aberto por E-mail (18:01).</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.visao_gerencial_faturamento_email_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, visao_gerencial_faturamento_email_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.visao_gerencial_faturamento_email_active !== false ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.visao_gerencial_faturamento_email_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Alertas SGQ (Email) */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Alertas SGQ (Calibração)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Avisos diários matinais sobre vencimento por E-mail.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.sgq_alerts_email_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, sgq_alerts_email_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.sgq_alerts_email_active !== false ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.sgq_alerts_email_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Relatórios de Faturamento/Compras (Email) */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Relatórios Diários (Fat./Compras)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Relatório consolidado por E-mail nos horários programados.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.relatorios_faturamento_email_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, relatorios_faturamento_email_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.relatorios_faturamento_email_active !== false ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.relatorios_faturamento_email_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>

"""

if insertion_point in content:
    content = content.replace(insertion_point, new_grid + insertion_point)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Settings.jsx updated successfully!")
else:
    print("Insertion point not found!")
