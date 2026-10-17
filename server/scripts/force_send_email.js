const db = require('../db');
const { sendMail } = require('../services/mailService');

async function forceSendAccumulated() {
    try {
        const dateStartProtheus = `20260501`;
        const dateEndProtheus = `20260519`;
        const periodBr = `01/05/2026 até 19/05/2026`;

        // 1. Busca Totais de Faturamento do Mês
        const queryFaturamento = `
            SELECT 
                F2_TIPO as tipo,
                COUNT(*) as qtd_notas,
                SUM(F2_VALMERC) as total_valor
            FROM SF2010
            WHERE F2_EMISSAO >= $1 AND F2_EMISSAO <= $2 AND COALESCE(D_E_L_E_T_,' ') = ' '
            AND COALESCE(F2_CHVNFE, ' ') <> ' '
            AND COALESCE(F2_STATUS, ' ') NOT IN ('A', 'C')
            GROUP BY F2_TIPO
        `;
        const resFat = await db.query(queryFaturamento, [dateStartProtheus, dateEndProtheus]);
        
        const mapTipo = (tipo) => {
            const t = (tipo || '').trim().toUpperCase();
            if (t === 'N') return 'Faturamento';
            if (t === 'C') return 'Complemento';
            if (t === 'P') return 'Devolução';
            if (t === 'I') return 'Importação';
            if (t === 'B') return 'Beneficiamento';
            if (t === 'D') return 'Remessa';
            return t || 'Faturamento';
        };

        let faturamentoDetalhesHTML = '';
        let totalGeralFaturamento = 0;
        let qtdGeralFaturamento = 0;

        resFat.rows.forEach(r => {
            const val = parseFloat(r.total_valor || 0);
            totalGeralFaturamento += val;
            qtdGeralFaturamento += parseInt(r.qtd_notas || 0);
        });

        // 2. Busca Totais de Compras do Mês
        const queryCompras = `
            SELECT 
                COUNT(*) as qtd_pedidos,
                SUM(C7_TOTAL) as total_valor
            FROM SC7010
            WHERE C7_EMISSAO >= $1 AND C7_EMISSAO <= $2 AND COALESCE(D_E_L_E_T_,' ') = ' '
        `;
        const resComp = await db.query(queryCompras, [dateStartProtheus, dateEndProtheus]);
        const compras = resComp.rows[0];
        
        const totalGeralCompras = parseFloat(compras?.total_valor || 0);
        const qtdGeralCompras = parseInt(compras?.qtd_pedidos || 0);

        const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        faturamentoDetalhesHTML = resFat.rows.sort((a,b) => b.total_valor - a.total_valor).map(r => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #475569;">${mapTipo(r.tipo)} (${r.qtd_notas} notas)</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight:bold; color: #0f172a;">${formatBRL(r.total_valor)}</td>
            </tr>
        `).join('');



        const htmlContent = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #6366f1; color: #fff; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Acumulado do Mês - Faturamento e Compras (Novo Relatório)</h2>
                    <p style="margin: 5px 0 0 0;">${periodBr}</p>
                </div>
                <div style="padding: 20px;">
                    <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                        <div style="flex: 1; background: #f0fdf4; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #bbf7d0;">
                            <div style="font-size: 12px; color: #166534; text-transform: uppercase; font-weight: bold;">Total Faturado Líquido</div>
                            <div style="font-size: 24px; font-weight: bold; color: #14532d; margin-top: 5px;">${formatBRL(totalGeralFaturamento)}</div>
                            <div style="font-size: 11px; color: #166534; margin-top: 5px;">${qtdGeralFaturamento} notas de saída válidas</div>
                        </div>
                        <div style="flex: 1; background: #fef2f2; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #fecaca;">
                            <div style="font-size: 12px; color: #991b1b; text-transform: uppercase; font-weight: bold;">Total Compras</div>
                            <div style="font-size: 24px; font-weight: bold; color: #7f1d1d; margin-top: 5px;">${formatBRL(totalGeralCompras)}</div>
                            <div style="font-size: 11px; color: #991b1b; margin-top: 5px;">${qtdGeralCompras} pedidos de despesa</div>
                        </div>
                    </div>
                    <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">Detalhamento das Notas de Saída</h3>
                    <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
                        <tbody>
                            ${faturamentoDetalhesHTML}
                        </tbody>
                    </table>
                </div>
                <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
                    <p>Este é um e-mail automático gerado pelo MetalFisa ERP. Por favor, não responda.</p>
                </div>
            </div>
        `;

        await sendMail({
            to: 'edsonmanoel2012@gmail.com',
            subject: `📈 Acumulado do Mês (Validado) - ${periodBr}`,
            html: htmlContent
        });
        
        console.log("Email enviado com sucesso para edsonmanoel2012@gmail.com");
        process.exit(0);

    } catch(err) {
        console.error('Erro:', err);
        process.exit(1);
    }
}

forceSendAccumulated();
