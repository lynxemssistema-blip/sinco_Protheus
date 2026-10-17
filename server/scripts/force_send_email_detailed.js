const db = require('../db');
const { sendMail } = require('../services/mailService');

async function forceSendDetailed() {
    try {
        const dateStartProtheus = `20260501`;
        const dateEndProtheus = `20260519`;
        const periodBr = `01/05/2026 até 19/05/2026`;

        // Busca Faturamento Detalhado por Cliente
        const queryFaturamentoDet = `
            SELECT 
                SA1.A1_NOME as cliente,
                COUNT(*) as qtd_notas,
                SUM(SF2.F2_VALMERC) as total_valor
            FROM SF2010 SF2
            LEFT JOIN SA1010 SA1 ON SA1.A1_COD = SF2.F2_CLIENTE AND SA1.A1_LOJA = SF2.F2_LOJA AND COALESCE(SA1.D_E_L_E_T_,' ') = ' '
            WHERE SF2.F2_EMISSAO >= $1 AND SF2.F2_EMISSAO <= $2 
            AND COALESCE(SF2.D_E_L_E_T_,' ') = ' '
            AND SF2.F2_TIPO = 'N'
            AND COALESCE(SF2.F2_CHVNFE, ' ') <> ' '
            AND COALESCE(SF2.F2_STATUS, ' ') NOT IN ('A', 'C')
            GROUP BY SA1.A1_NOME
            ORDER BY total_valor DESC
        `;
        const resFat = await db.query(queryFaturamentoDet, [dateStartProtheus, dateEndProtheus]);
        
        const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        let detalhesHTML = '';
        let totalGeral = 0;
        let qtdGeral = 0;

        resFat.rows.forEach(r => {
            const val = parseFloat(r.total_valor || 0);
            totalGeral += val;
            qtdGeral += parseInt(r.qtd_notas || 0);
            
            detalhesHTML += `
                <tr>
                    <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 12px;">${r.cliente || 'CLIENTE NÃO IDENTIFICADO'}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-align: center;">${r.qtd_notas}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 12px; text-align: right; font-weight: 500;">${formatBRL(val)}</td>
                </tr>
            `;
        });

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #f59e0b; color: #fff; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Resumo de Faturamento - Verificação Detalhada</h2>
                    <p style="margin: 5px 0 0 0;">${periodBr}</p>
                </div>
                <div style="padding: 20px;">
                    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #fde68a; margin-bottom: 20px;">
                        <div style="font-size: 12px; color: #b45309; text-transform: uppercase; font-weight: bold;">Total Geral Filtrado (Apenas Tipo N)</div>
                        <div style="font-size: 24px; font-weight: bold; color: #78350f; margin-top: 5px;">${formatBRL(totalGeral)}</div>
                        <div style="font-size: 12px; color: #b45309; margin-top: 5px;">${qtdGeral} notas fiscais consideradas</div>
                    </div>
                    
                    <p style="font-size: 13px; color: #475569; margin-bottom: 10px;">
                        <strong>Critérios aplicados:</strong><br/>
                        - Tipo de NF = 'N' (Normal)<br/>
                        - Valor considerado = Valor da Mercadoria (F2_VALMERC)<br/>
                        - Excluídos: Deletados, s/ Chave SEFAZ, ou Status A/C.
                    </p>

                    <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
                        <thead>
                            <tr style="background-color: #f1f5f9;">
                                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1; font-size: 12px; color: #475569;">Cliente</th>
                                <th style="padding: 8px; text-align: center; border-bottom: 2px solid #cbd5e1; font-size: 12px; color: #475569;">Qtd Notas</th>
                                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1; font-size: 12px; color: #475569;">Valor (R$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${detalhesHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        `;



        await sendMail({
            to: 'edsonmanoel2012@gmail.com',
            subject: `📊 Detalhamento para Verificação - Faturamento (${periodBr})`,
            html: htmlContent
        });
        
        console.log("Email detalhado enviado com sucesso!");
        process.exit(0);

    } catch(err) {
        console.error('Erro:', err);
        process.exit(1);
    }
}

forceSendDetailed();
