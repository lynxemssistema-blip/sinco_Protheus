/**
 * Company branding used by every generated report (PDF/Excel).
 * Data comes from Configurações > Empresa (app_company_settings) and is loaded
 * once after login and refreshed whenever the company profile is saved.
 */
import api from './api';
import { setLogoBase64 as setMetalfisaLogo } from './metalfisaLogoBase64';
import { setLogoBase64 as setLynxLogo, DEFAULT_LOGO } from './lynxLogoBase64';

let company = {};

const clean = (v) => (v === null || v === undefined ? '' : String(v).trim());

export const getCompany = () => company;

/** Base64 do logotipo da empresa ativa */
export const getCompanyLogoBase64 = () => clean(company.logo_base64) || DEFAULT_LOGO || '';

/** Legal name, e.g. "DELTA PARAFUSOS LTDA". */
export const getCompanyLegalName = () =>
    (clean(company.razao_social) || clean(company.nome_fantasia) || 'SINCO ERP').toUpperCase();

/** Short brand label for compact header blocks (fits where company logo/name is shown). */
export const getCompanyShortName = () => {
    const name = (clean(company.nome_fantasia) || clean(company.razao_social) || 'SINCO').toUpperCase();
    if (name.length <= 15) return name;
    return name.split(/\s+/)[0].slice(0, 15);
};

export const getCompanyCnpj = () => clean(company.cnpj);

/** "Rua X, 123 - Bairro - Cidade/UF" */
export const getCompanyAddressLine = () => {
    const rua = [clean(company.logradouro), clean(company.numero)].filter(Boolean).join(', ') || clean(company.endereco);
    const cidadeUf = [clean(company.cidade), clean(company.uf)].filter(Boolean).join('/');
    return [rua, clean(company.bairro), cidadeUf].filter(Boolean).join(' - ');
};

/** "Rua X, 123  -  CNPJ: 00.000.000/0000-00" */
export const getCompanyAddressCnpjLine = () => {
    const rua = [clean(company.logradouro), clean(company.numero)].filter(Boolean).join(', ') || clean(company.endereco);
    const cnpj = getCompanyCnpj() ? `CNPJ: ${getCompanyCnpj()}` : '';
    return [rua, cnpj].filter(Boolean).join('  -  ');
};

/** "CNPJ: ...  -  IE: ..." */
export const getCompanyCnpjIeLine = () => {
    const parts = [];
    if (getCompanyCnpj()) parts.push(`CNPJ: ${getCompanyCnpj()}`);
    if (clean(company.inscricao_estadual)) parts.push(`IE: ${clean(company.inscricao_estadual)}`);
    return parts.join('  -  ');
};

/** "CNPJ: ...  |  Cidade / UF" */
export const getCompanyCnpjCityLine = () => {
    const cidadeUf = [clean(company.cidade), clean(company.uf)].filter(Boolean).join(' / ');
    return [getCompanyCnpj() ? `CNPJ: ${getCompanyCnpj()}` : '', cidadeUf].filter(Boolean).join('  |  ');
};

/** "email  |  telefone" */
export const getCompanyContactLine = () =>
    [clean(company.email), clean(company.telefone), clean(company.site)].filter(Boolean).join('  |  ');

/** "WhatsApp: (00) 00000-0000" or empty. */
export const getCompanyWhatsappLine = () =>
    clean(company.whatsapp) ? `WhatsApp: ${clean(company.whatsapp)}` : '';

/** Strips protocol/domain so reports show compact handles, e.g. "Instagram: @empresa". */
const toHandle = (v) => {
    const s = clean(v).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
    const last = s.includes('/') ? s.split('/').pop() : s;
    return last.startsWith('@') ? last : `@${last}`;
};

/** "Instagram: @x  |  LinkedIn: @y ..." — only filled networks. */
export const getCompanySocialLine = () => {
    const nets = [['Instagram', 'instagram'], ['Facebook', 'facebook'], ['LinkedIn', 'linkedin'], ['YouTube', 'youtube'], ['TikTok', 'tiktok'], ['X', 'twitter_x']];
    return nets.filter(([, k]) => clean(company[k])).map(([label, k]) => `${label}: ${toHandle(company[k])}`).join('  |  ');
};

/** Small line under the logo block (city/UF). */
export const getCompanyTagline = () =>
    [clean(company.cidade), clean(company.uf)].filter(Boolean).join(' / ');

/** Applies company data (and logo) to every report generator. */
export const applyCompanyBranding = (data) => {
    company = data || {};
    const logo = clean(company.logo_base64) || '';
    setMetalfisaLogo(logo);
    setLynxLogo(logo);
};

/** Loads the active company profile from the server. */
export const loadCompanyBranding = async () => {
    try {
        const { data } = await api.get('/company');
        applyCompanyBranding(data);
    } catch (err) {
        console.warn('[Branding] Não foi possível carregar os dados da empresa:', err?.message);
    }
    return company;
};
