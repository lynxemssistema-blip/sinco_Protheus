import React, { useRef, useState } from 'react';
import { Building2, Search, Upload, Trash2, Save, MapPin, Phone, FileBadge, Loader2, ImageIcon, CheckCircle2, AlertTriangle, Share2, Instagram, Facebook, Linkedin, Youtube, Twitter, Music2, MapPinned, ExternalLink } from 'lucide-react';
import { lookupCnpjBrasilApi } from '../../services/api';

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const REGIMES = ['Simples Nacional', 'MEI', 'Lucro Presumido', 'Lucro Real', 'Lucro Presumido/Real'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_SIDE = 600;

const maskCnpj = (v = '') => {
    const d = String(v).replace(/\D/g, '').slice(0, 14);
    return d
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
};
const maskCep = (v = '') => String(v).replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
const maskPhone = (v = '') => {
    const d = String(v).replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};

const SOCIAL_NETWORKS = [
    { key: 'instagram', label: 'Instagram', icon: Instagram, base: 'https://instagram.com/', placeholder: '@suaempresa', color: 'text-pink-600' },
    { key: 'facebook', label: 'Facebook', icon: Facebook, base: 'https://facebook.com/', placeholder: 'facebook.com/suaempresa', color: 'text-blue-600' },
    { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, base: 'https://linkedin.com/company/', placeholder: 'linkedin.com/company/suaempresa', color: 'text-sky-700' },
    { key: 'youtube', label: 'YouTube', icon: Youtube, base: 'https://youtube.com/@', placeholder: 'youtube.com/@suaempresa', color: 'text-red-600' },
    { key: 'tiktok', label: 'TikTok', icon: Music2, base: 'https://tiktok.com/@', placeholder: '@suaempresa', color: 'text-slate-800' },
    { key: 'twitter_x', label: 'X (Twitter)', icon: Twitter, base: 'https://x.com/', placeholder: '@suaempresa', color: 'text-slate-800' },
    { key: 'google_maps', label: 'Google Maps / Localização', icon: MapPinned, base: '', placeholder: 'https://maps.app.goo.gl/...', color: 'text-emerald-600' }
];

/** Builds a clickable URL from a handle (@user) or partial/complete link. */
const toSocialUrl = (value, base) => {
    const v = String(value || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    if (/^(www\.)?[\w-]+\.[a-z]{2,}/i.test(v)) return `https://${v}`;
    return base ? `${base}${v.replace(/^@/, '')}` : '';
};

/** Normalizes any image to a compact PNG data URL (jsPDF reports use 'PNG'). */
const toPngDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
            const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
});

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-shadow';
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1';

const Field = ({ label, className = '', children }) => (
    <div className={className}>
        <label className={labelCls}>{label}</label>
        {children}
    </div>
);

const Section = ({ icon: Icon, title, subtitle, children }) => (
    <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 h-full">
        <div className="flex items-center gap-2 mb-3">
            <span className="p-1.5 rounded-md bg-blue-50 text-blue-600"><Icon className="w-4 h-4" /></span>
            <div>
                <h4 className="text-sm font-bold text-slate-800 leading-tight">{title}</h4>
                {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
            </div>
        </div>
        {children}
    </section>
);

export default function CompanyProfileForm({ companyForm, setCompanyForm, onSubmit, loading }) {
    const fileRef = useRef(null);
    const [buscandoCnpj, setBuscandoCnpj] = useState(false);
    const [buscandoCep, setBuscandoCep] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const set = (field) => (e) => setCompanyForm(prev => ({ ...prev, [field]: e.target.value }));

    const handleBuscarCnpj = async () => {
        const digits = String(companyForm.cnpj || '').replace(/\D/g, '');
        if (digits.length !== 14) {
            setFeedback({ type: 'error', msg: 'Informe um CNPJ com 14 dígitos.' });
            return;
        }
        setBuscandoCnpj(true);
        setFeedback(null);
        try {
            const data = await lookupCnpjBrasilApi(digits);
            // Only overwrite fields BrasilAPI actually returned
            const filled = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined));
            setCompanyForm(prev => ({ ...prev, ...filled }));
            setFeedback({ type: 'success', msg: `Dados de "${data.razao_social}" carregados da Receita (BrasilAPI). Revise e salve.` });
        } catch (err) {
            setFeedback({ type: 'error', msg: err.response?.data?.error || 'Falha ao consultar o CNPJ.' });
        } finally {
            setBuscandoCnpj(false);
        }
    };

    const handleBuscarCep = async () => {
        const cep = String(companyForm.cep || '').replace(/\D/g, '');
        if (cep.length !== 8) return;
        setBuscandoCep(true);
        try {
            const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
            if (!res.ok) throw new Error('CEP não encontrado');
            const d = await res.json();
            setCompanyForm(prev => ({
                ...prev,
                logradouro: d.street || prev.logradouro,
                bairro: d.neighborhood || prev.bairro,
                cidade: d.city || prev.cidade,
                uf: d.state || prev.uf
            }));
        } catch {
            setFeedback({ type: 'error', msg: 'CEP não encontrado na BrasilAPI.' });
        } finally {
            setBuscandoCep(false);
        }
    };

    const handleLogo = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setFeedback({ type: 'error', msg: 'Selecione uma imagem (PNG, JPG, SVG ou WEBP).' });
            return;
        }
        if (file.size > MAX_LOGO_BYTES) {
            setFeedback({ type: 'error', msg: 'O logo deve ter no máximo 2MB.' });
            return;
        }
        try {
            const png = await toPngDataUrl(file);
            setCompanyForm(prev => ({ ...prev, logo_base64: png }));
            setFeedback({ type: 'success', msg: 'Logo carregado. Clique em "Salvar Alterações" para aplicar nos relatórios.' });
        } catch {
            setFeedback({ type: 'error', msg: 'Não foi possível ler a imagem.' });
        }
    };

    const enderecoPreview = [
        [companyForm.logradouro, companyForm.numero].filter(Boolean).join(', ') || companyForm.endereco,
        companyForm.bairro,
        [companyForm.cidade, companyForm.uf].filter(Boolean).join('/')
    ].filter(Boolean).join(' - ');

    return (
        <form onSubmit={onSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            <aside className="xl:col-span-4 2xl:col-span-3 space-y-4 xl:sticky xl:top-4">
            {/* Report header preview */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-slate-800 text-[10px] font-semibold tracking-wider text-slate-300 uppercase">
                    Pré-visualização do cabeçalho dos relatórios
                </div>
                <div className="flex items-stretch bg-white">
                    <div className="w-40 shrink-0 flex items-center justify-center border-r border-slate-200 p-3 bg-slate-50">
                        {companyForm.logo_base64
                            ? <img src={companyForm.logo_base64} alt="Logo da empresa" className="max-h-14 max-w-full object-contain" />
                            : <span className="text-[10px] text-slate-400 text-center">Sem logo<br />(usa o logo padrão)</span>}
                    </div>
                    <div className="p-3 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{(companyForm.razao_social || 'RAZÃO SOCIAL DA EMPRESA').toUpperCase()}</p>
                        <p className="text-[11px] text-slate-500 truncate">{[enderecoPreview, companyForm.cnpj && `CNPJ: ${companyForm.cnpj}`].filter(Boolean).join('  -  ') || 'Endereço  -  CNPJ'}</p>
                        <p className="text-[11px] text-slate-500 truncate">{[companyForm.email, companyForm.telefone, companyForm.site].filter(Boolean).join('  |  ') || 'e-mail  |  telefone'}</p>
                    </div>
                </div>
            </div>

            {feedback && (
                <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{feedback.msg}</span>
                </div>
            )}

            {/* Logo */}
            <Section icon={ImageIcon} title="Logo da Empresa" subtitle="Usado em todos os relatórios e PDFs gerados pelo sistema">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        id="btn-upload-logo"
                        onClick={() => fileRef.current?.click()}
                        className="group w-32 h-20 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 bg-white flex items-center justify-center overflow-hidden transition-colors"
                        title="Clique para enviar o logo"
                    >
                        {companyForm.logo_base64
                            ? <img src={companyForm.logo_base64} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
                            : <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />}
                    </button>
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors">
                                <Upload className="w-3.5 h-3.5" /> {companyForm.logo_base64 ? 'Trocar logo' : 'Enviar logo'}
                            </button>
                            {companyForm.logo_base64 && (
                                <button type="button" id="btn-remove-logo" onClick={() => setCompanyForm(prev => ({ ...prev, logo_base64: '' }))} className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" /> Remover
                                </button>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500">PNG, JPG, SVG ou WEBP até 2MB. Prefira fundo transparente e formato horizontal.</p>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                </div>
            </Section>

            <button
                type="submit"
                id="btn-save-company"
                disabled={loading}
                className="w-full bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2 font-medium shadow-sm transition-colors"
            >
                <Save className="w-4 h-4" />
                {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            </aside>

            <div className="xl:col-span-8 2xl:col-span-9 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Identification */}
            <Section icon={Building2} title="Identificação" subtitle="Digite o CNPJ e busque os dados oficiais na Receita Federal (BrasilAPI)">
                <div className="grid grid-cols-6 gap-3">
                    <Field label="CNPJ" className="col-span-6 sm:col-span-3">
                        <div className="flex gap-2">
                            <input
                                id="input-company-cnpj"
                                className={inputCls}
                                value={companyForm.cnpj || ''}
                                placeholder="00.000.000/0000-00"
                                onChange={(e) => setCompanyForm(prev => ({ ...prev, cnpj: maskCnpj(e.target.value) }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleBuscarCnpj(); } }}
                            />
                            <button
                                type="button"
                                id="btn-buscar-cnpj"
                                onClick={handleBuscarCnpj}
                                disabled={buscandoCnpj}
                                className="shrink-0 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white flex items-center gap-1.5 transition-colors"
                                title="Buscar dados na BrasilAPI"
                            >
                                {buscandoCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                Buscar CNPJ
                            </button>
                        </div>
                    </Field>
                    <Field label="Regime Tributário" className="col-span-6 sm:col-span-3">
                        <select className={inputCls} value={companyForm.regime_tributario || ''} onChange={set('regime_tributario')}>
                            <option value="">Selecione...</option>
                            {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </Field>
                    <Field label="Razão Social" className="col-span-6">
                        <input className={inputCls} value={companyForm.razao_social || ''} onChange={set('razao_social')} />
                    </Field>
                    <Field label="Nome Fantasia" className="col-span-6 sm:col-span-2">
                        <input className={inputCls} value={companyForm.nome_fantasia || ''} onChange={set('nome_fantasia')} />
                    </Field>
                    <Field label="Inscrição Estadual" className="col-span-3 sm:col-span-2">
                        <input className={inputCls} value={companyForm.inscricao_estadual || ''} onChange={set('inscricao_estadual')} placeholder="Isento / nº" />
                    </Field>
                    <Field label="Inscrição Municipal" className="col-span-3 sm:col-span-2">
                        <input className={inputCls} value={companyForm.inscricao_municipal || ''} onChange={set('inscricao_municipal')} />
                    </Field>
                </div>
            </Section>

            {/* Address */}
            <Section icon={MapPin} title="Endereço" subtitle="Ao informar o CEP, o endereço é preenchido automaticamente">
                <div className="grid grid-cols-6 gap-3">
                    <Field label="CEP" className="col-span-3 sm:col-span-2">
                        <div className="relative">
                            <input className={inputCls} value={companyForm.cep || ''} placeholder="00000-000"
                                onChange={(e) => setCompanyForm(prev => ({ ...prev, cep: maskCep(e.target.value) }))}
                                onBlur={handleBuscarCep} />
                            {buscandoCep && <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-2 top-1/2 -translate-y-1/2" />}
                        </div>
                    </Field>
                    <Field label="Logradouro" className="col-span-6 sm:col-span-4">
                        <input className={inputCls} value={companyForm.logradouro || ''} onChange={set('logradouro')} />
                    </Field>
                    <Field label="Número" className="col-span-2">
                        <input className={inputCls} value={companyForm.numero || ''} onChange={set('numero')} />
                    </Field>
                    <Field label="Complemento" className="col-span-4">
                        <input className={inputCls} value={companyForm.complemento || ''} onChange={set('complemento')} />
                    </Field>
                    <Field label="Bairro" className="col-span-6 sm:col-span-2">
                        <input className={inputCls} value={companyForm.bairro || ''} onChange={set('bairro')} />
                    </Field>
                    <Field label="Cidade" className="col-span-4 sm:col-span-3">
                        <input className={inputCls} value={companyForm.cidade || ''} onChange={set('cidade')} />
                    </Field>
                    <Field label="UF" className="col-span-2 sm:col-span-1">
                        <select className={inputCls} value={companyForm.uf || ''} onChange={set('uf')}>
                            <option value="">--</option>
                            {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                    </Field>
                </div>
            </Section>

            {/* Contact */}
            <Section icon={Phone} title="Contato" subtitle="Telefones e e-mails por departamento">
                <div className="grid grid-cols-6 gap-3">
                    <Field label="Telefone Principal" className="col-span-6 sm:col-span-2">
                        <input className={inputCls} value={companyForm.telefone || ''} onChange={(e) => setCompanyForm(prev => ({ ...prev, telefone: maskPhone(e.target.value) }))} placeholder="(00) 0000-0000" />
                    </Field>
                    <Field label="Telefone Secundário" className="col-span-6 sm:col-span-2">
                        <input className={inputCls} value={companyForm.telefone_2 || ''} onChange={(e) => setCompanyForm(prev => ({ ...prev, telefone_2: maskPhone(e.target.value) }))} placeholder="(00) 0000-0000" />
                    </Field>
                    <Field label="WhatsApp" className="col-span-6 sm:col-span-2">
                        <input id="input-company-whatsapp" className={inputCls} value={companyForm.whatsapp || ''} onChange={(e) => setCompanyForm(prev => ({ ...prev, whatsapp: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" />
                    </Field>
                    <Field label="E-mail Principal" className="col-span-6 sm:col-span-3">
                        <input type="email" className={inputCls} value={companyForm.email || ''} onChange={set('email')} />
                    </Field>
                    <Field label="Site" className="col-span-6 sm:col-span-3">
                        <input className={inputCls} value={companyForm.site || ''} onChange={set('site')} placeholder="www.empresa.com.br" />
                    </Field>
                    <Field label="E-mail Comercial" className="col-span-6 sm:col-span-2">
                        <input type="email" className={inputCls} value={companyForm.email_comercial || ''} onChange={set('email_comercial')} placeholder="vendas@..." />
                    </Field>
                    <Field label="E-mail Financeiro" className="col-span-6 sm:col-span-2">
                        <input type="email" className={inputCls} value={companyForm.email_financeiro || ''} onChange={set('email_financeiro')} placeholder="financeiro@..." />
                    </Field>
                    <Field label="E-mail NF-e / XML" className="col-span-6 sm:col-span-2">
                        <input type="email" className={inputCls} value={companyForm.email_nfe || ''} onChange={set('email_nfe')} placeholder="nfe@..." />
                    </Field>
                </div>
            </Section>

            {/* Social networks */}
            <Section icon={Share2} title="Redes Sociais" subtitle="Informe o @usuário ou o link completo — clique no ícone para testar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SOCIAL_NETWORKS.map(({ key, label, icon: Icon, base, placeholder, color }) => {
                        const url = toSocialUrl(companyForm[key], base);
                        return (
                            <Field key={key} label={label} className={key === 'google_maps' ? 'sm:col-span-2' : ''}>
                                <div className="flex items-center gap-2">
                                    <span className={`shrink-0 p-2 rounded-lg bg-white border border-slate-200 ${color}`}><Icon className="w-4 h-4" /></span>
                                    <input id={`input-company-${key}`} className={inputCls} value={companyForm[key] || ''} onChange={set(key)} placeholder={placeholder} />
                                    {url && (
                                        <a href={url} target="_blank" rel="noopener noreferrer" title={`Abrir ${url}`} className="shrink-0 p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            </Field>
                        );
                    })}
                </div>
            </Section>

            {/* Federal Revenue data */}
            <Section icon={FileBadge} title="Dados da Receita Federal" subtitle="Preenchidos automaticamente pela busca do CNPJ">
                <div className="grid grid-cols-6 gap-3">
                    <Field label="CNAE Principal" className="col-span-2">
                        <input className={inputCls} value={companyForm.cnae_principal || ''} onChange={set('cnae_principal')} />
                    </Field>
                    <Field label="Descrição da Atividade" className="col-span-4">
                        <input className={inputCls} value={companyForm.cnae_descricao || ''} onChange={set('cnae_descricao')} />
                    </Field>
                    <Field label="Situação Cadastral" className="col-span-3">
                        <input className={inputCls} value={companyForm.situacao_cadastral || ''} onChange={set('situacao_cadastral')} />
                    </Field>
                    <Field label="Data de Abertura" className="col-span-3">
                        <input type="date" className={inputCls} value={companyForm.data_abertura || ''} onChange={set('data_abertura')} />
                    </Field>
                </div>
            </Section>
            </div>
        </form>
    );
}
