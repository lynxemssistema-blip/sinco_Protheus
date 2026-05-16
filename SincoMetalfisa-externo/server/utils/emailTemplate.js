const getCorporateEmailTemplate = (htmlBody) => {
    return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <!-- Header with Logo -->
            <div style="background-color: #ffffff; padding: 20px; text-align: center; border-bottom: 3px solid #0ea5e9;">
                <img src="https://metalfisa.com.br/wp-content/uploads/2023/10/Logo-Metalfisa.png" alt="MetalFisa ERP" style="max-height: 60px; height: auto; display: block; margin: 0 auto;" />
            </div>
            
            <!-- Email Content Body -->
            <div style="padding: 30px; background-color: #ffffff; line-height: 1.6;">
                ${htmlBody}
            </div>
            
            <!-- Corporate Footer / Auto-Reply Warning -->
            <div style="background-color: #f8fafc; padding: 25px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0 0 5px 0; color: #0f172a;"><strong>Metalfisa Metalúrgica Ltda.</strong></p>
                <p style="margin: 0 0 15px 0;">Tecnologia e Inovação em Aço</p>
                <div style="border-top: 1px dashed #cbd5e1; margin: 15px auto; width: 60%;"></div>
                <p style="margin: 0; font-size: 12px; font-style: italic;">
                    🛑 <strong>Aviso Automático:</strong> Este é um e-mail gerado automaticamente pelo Sistema ERP da Metalfisa. Por favor, <b>não é necessário responder</b> a esta mensagem.
                </p>
            </div>
        </div>
    `;
};

module.exports = {
    getCorporateEmailTemplate
};
