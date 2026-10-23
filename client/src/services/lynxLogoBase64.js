export const DEFAULT_LOGO = '';

// Live binding: replaced dynamically by active company logo (see companyBranding.js)
export let logoBase64 = '';
export const setLogoBase64 = (value) => { logoBase64 = value || ''; };
