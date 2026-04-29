const fs = require('fs');
const path = require('path');
const mysql = require('../services/mysqlService');
const { calcularKPIMeuCanal } = require('../routes/meucanal');

async function calcularHistorico() {
    try {
        console.log('🔄 Iniciando cálculo histórico de KPI (últimos 60 dias)...');
        
        // 1. Buscar todos os usuários responsáveis por algum setor
        const [usuarios] = await mysql.query(`
            SELECT DISTINCT u.idUsuario, u.login, u.NomeCompleto 
            FROM usuario u
            JOIN pcp_setor_responsaveis sr ON sr.usuario_id = u.idUsuario
            WHERE u.status = 1 OR u.status IS NULL
        `);

        if (!usuarios || usuarios.length === 0) {
            console.log('Nenhum usuário responsável por setor encontrado.');
            process.exit(0);
        }

        console.log(`👥 Encontrados ${usuarios.length} usuários com setores vinculados.`);

        // 2. Gerar array de datas (últimos 60 dias)
        const datas = [];
        for (let i = 60; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            datas.push(d);
        }

        const relatorio = [];

        // 3. Iterar sobre as datas e usuários
        for (const dataAtual of datas) {
            const dataStr = dataAtual.toISOString().split('T')[0]; // YYYY-MM-DD
            console.log(`\n📅 Processando data: ${dataStr}`);

            for (const user of usuarios) {
                try {
                    const userName = user.NomeCompleto || user.login;
                    const kpiData = await calcularKPIMeuCanal(user.idUsuario, user.login, userName, dataAtual);
                    
                    // Só registrar se teve alguma atividade (pontos > 0) ou meta > 0
                    const teveApontamentos = kpiData.individual.total_pontos > 0;
                    const tevePlanejamento = kpiData.setores.some(s => s.producaoPlanejada > 0);

                    if (teveApontamentos || tevePlanejamento) {
                        relatorio.push({
                            Data: dataStr,
                            UsuarioID: user.idUsuario,
                            Usuario: userName,
                            PontosApontados: kpiData.individual.apontado,
                            PontosBonus: kpiData.individual.pontuacao_bonus,
                            TotalPontos: kpiData.individual.total_pontos,
                            PlanejadoSetores: kpiData.setores.reduce((acc, curr) => acc + curr.producaoPlanejada, 0),
                            RealizadoSetores: kpiData.setores.reduce((acc, curr) => acc + curr.producaoRealizada, 0)
                        });
                        console.log(`  ✅ [${user.login}] Pontos: ${kpiData.individual.total_pontos} | Setores (Plan/Real): ${kpiData.setores.reduce((a,c)=>a+c.producaoPlanejada,0)}/${kpiData.setores.reduce((a,c)=>a+c.producaoRealizada,0)}`);
                    }
                } catch (err) {
                    console.error(`  ❌ Erro no usuário ${user.login} para a data ${dataStr}: ${err.message}`);
                }
            }
        }

        // 4. Salvar CSV
        if (relatorio.length > 0) {
            const csvRows = ['Data;UsuarioID;Usuario;PontosApontados;PontosBonus;TotalPontos;PlanejadoSetores;RealizadoSetores'];
            for (const r of relatorio) {
                csvRows.push(`${r.Data};${r.UsuarioID};${r.Usuario};${r.PontosApontados};${r.PontosBonus};${r.TotalPontos};${r.PlanejadoSetores};${r.RealizadoSetores}`);
            }
            
            const filePath = path.join(__dirname, 'kpi_historico_60dias.csv');
            fs.writeFileSync(filePath, csvRows.join('\n'), 'utf8');
            console.log(`\n💾 Relatório salvo com sucesso em: ${filePath}`);
        } else {
            console.log('\n⚠️ Nenhum dado de produção encontrado nos últimos 60 dias.');
        }

    } catch (error) {
        console.error('Erro fatal no processamento:', error);
    } finally {
        process.exit(0);
    }
}

calcularHistorico();
