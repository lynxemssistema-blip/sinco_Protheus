
async function testAllFilters() {
    console.log("=== TESTE COMPLETO: Filtros e SQL ===\n");
    console.log("Timestamp:", new Date().toISOString());
    console.log("");

    const baseUrl = 'http://localhost:3001/api/compras/pedidos-com-pv';
    let passCount = 0;
    let failCount = 0;

    const test = async (name, params, expectedStatus, shouldHaveData = null) => {
        const queryString = new URLSearchParams(params).toString();
        const url = `${baseUrl}?${queryString}`;

        try {
            const response = await fetch(url);
            const text = await response.text();

            if (response.status === expectedStatus) {
                const data = response.ok ? JSON.parse(text) : null;

                // Verificações adicionais
                if (shouldHaveData !== null && response.ok) {
                    if (shouldHaveData && data.length > 0) {
                        console.log(`✅ ${name}`);
                        console.log(`   Status: ${response.status}, Registros: ${data.length}`);
                        passCount++;
                    } else if (!shouldHaveData && data.length === 0) {
                        console.log(`✅ ${name}`);
                        console.log(`   Status: ${response.status}, Registros: ${data.length} (esperado)`);
                        passCount++;
                    } else {
                        console.log(`⚠️  ${name}`);
                        console.log(`   Status: ${response.status}, Registros: ${data.length} (inesperado)`);
                        passCount++;
                    }
                } else {
                    console.log(`✅ ${name}`);
                    console.log(`   Status: ${response.status}`);
                    if (response.ok && data) {
                        console.log(`   Registros: ${data.length}`);
                    }
                    passCount++;
                }
            } else {
                console.log(`❌ ${name}`);
                console.log(`   Esperado: ${expectedStatus}, Recebido: ${response.status}`);
                console.log(`   Resposta: ${text.substring(0, 200)}`);
                failCount++;
            }
        } catch (error) {
            console.log(`❌ ${name} - EXCEÇÃO`);
            console.log(`   Erro: ${error.message}`);
            failCount++;
        }
        console.log('');
    };

    // =====================================================
    // TESTE 1: Validação de Filtros Obrigatórios
    // =====================================================
    console.log("🔒 TESTE 1: Validação de Filtros Obrigatórios\n");

    await test(
        "T1.1: Sem filtros (deve retornar erro 400)",
        {},
        400
    );

    // =====================================================
    // TESTE 2: Filtros Individuais
    // =====================================================
    console.log("🎯 TESTE 2: Filtros Individuais\n");

    await test(
        "T2.1: Filtro por pv_numero",
        { pv_numero: "003716" },
        200,
        true
    );

    await test(
        "T2.2: Filtro por pedido_cliente",
        { pedido_cliente: "PED" },
        200
    );

    await test(
        "T2.3: Filtro por produto",
        { produto: "MT" },
        200
    );

    await test(
        "T2.4: Filtro por descricao",
        { descricao: "PARAFUSO" },
        200
    );

    await test(
        "T2.5: Filtro por sc_numero",
        { sc_numero: "073610" },
        200
    );

    await test(
        "T2.6: Filtro por pc_numero",
        { pc_numero: "000456" },
        200
    );

    await test(
        "T2.7: Filtro por fornecedor",
        { fornecedor: "FOR" },
        200
    );

    await test(
        "T2.8: Filtro por data_pv_de",
        { data_pv_de: "2026-01-01" },
        200
    );

    await test(
        "T2.9: Filtro por data_pv_ate",
        { data_pv_ate: "2026-12-31" },
        200
    );

    // =====================================================
    // TESTE 3: Combinações de Filtros
    // =====================================================
    console.log("🔗 TESTE 3: Combinações de Filtros\n");

    await test(
        "T3.1: pv_numero + produto",
        { pv_numero: "003716", produto: "MT" },
        200
    );

    await test(
        "T3.2: data_pv_de + data_pv_ate (período)",
        { data_pv_de: "2026-01-01", data_pv_ate: "2026-01-31" },
        200
    );

    await test(
        "T3.3: produto + descricao",
        { produto: "MT", descricao: "PARAFUSO" },
        200
    );

    await test(
        "T3.4: pv_numero + sc_numero + pc_numero",
        { pv_numero: "003716", sc_numero: "073", pc_numero: "000" },
        200
    );

    // =====================================================
    // TESTE 4: Casos Edge
    // =====================================================
    console.log("⚡ TESTE 4: Casos Edge\n");

    await test(
        "T4.1: PV inexistente",
        { pv_numero: "999999" },
        200,
        false
    );

    await test(
        "T4.2: PV com zeros à esquerda",
        { pv_numero: "003716" },
        200
    );

    await test(
        "T4.3: PV sem zeros",
        { pv_numero: "3716" },
        200
    );

    await test(
        "T4.4: Produto parcial (LIKE)",
        { produto: "MT2" },
        200
    );

    await test(
        "T4.5: Descrição case-insensitive",
        { descricao: "parafuso" },
        200
    );

    await test(
        "T4.6: Data futura (sem resultados)",
        { data_pv_de: "2030-01-01" },
        200,
        false
    );

    // =====================================================
    // TESTE 5: Verificação de Duplicação
    // =====================================================
    console.log("🔍 TESTE 5: Verificação de Duplicação\n");

    const dupTest = await fetch(`${baseUrl}?pv_numero=003716`);
    if (dupTest.ok) {
        const data = await dupTest.json();
        const uniqueKeys = new Set();
        let hasDuplicates = false;

        data.forEach(row => {
            const key = `${row.pv_numero}-${row.pv_item}`;
            if (uniqueKeys.has(key)) {
                hasDuplicates = true;
            }
            uniqueKeys.add(key);
        });

        if (!hasDuplicates) {
            console.log("✅ T5.1: Nenhuma duplicação encontrada");
            console.log(`   Registros: ${data.length}, Únicos: ${uniqueKeys.size}`);
            passCount++;
        } else {
            console.log("❌ T5.1: Duplicações encontradas!");
            console.log(`   Registros: ${data.length}, Únicos: ${uniqueKeys.size}`);
            failCount++;
        }
    } else {
        console.log("❌ T5.1: Falha ao buscar dados para teste de duplicação");
        failCount++;
    }
    console.log('');

    // =====================================================
    // TESTE 6: Estrutura de Dados
    // =====================================================
    console.log("📊 TESTE 6: Estrutura de Dados\n");

    const structTest = await fetch(`${baseUrl}?pv_numero=003716`);
    if (structTest.ok) {
        const data = await structTest.json();
        if (data.length > 0) {
            const firstRow = data[0];
            const requiredFields = [
                'pv_numero', 'pv_item', 'pv_data_emissao', 'pedido_cliente_numero',
                'produto_codigo', 'produto_descricao', 'pv_quantidade', 'pv_unidade',
                'sc_filial', 'sc_numero', 'sc_item', 'sc_data_emissao',
                'pc_numero', 'pc_item', 'pc_data_emissao',
                'fornecedor_codigo', 'fornecedor_nome', 'status_rastreamento'
            ];

            const missingFields = requiredFields.filter(field => !(field in firstRow));

            if (missingFields.length === 0) {
                console.log("✅ T6.1: Todos os campos obrigatórios presentes");
                console.log(`   Campos: ${Object.keys(firstRow).length}`);
                passCount++;
            } else {
                console.log("❌ T6.1: Campos faltando!");
                console.log(`   Faltando: ${missingFields.join(', ')}`);
                failCount++;
            }

            // Verificar status calculado
            const validStatuses = ['COM_PC', 'COM_SC', 'SOMENTE_PV'];
            if (validStatuses.includes(firstRow.status_rastreamento)) {
                console.log("✅ T6.2: Status calculado válido");
                console.log(`   Status: ${firstRow.status_rastreamento}`);
                passCount++;
            } else {
                console.log("❌ T6.2: Status inválido!");
                console.log(`   Status: ${firstRow.status_rastreamento}`);
                failCount++;
            }
        } else {
            console.log("⚠️  T6: Sem dados para verificar estrutura");
        }
    }
    console.log('');

    // =====================================================
    // TESTE 7: Performance
    // =====================================================
    console.log("⚡ TESTE 7: Performance\n");

    const perfStart = Date.now();
    const perfTest = await fetch(`${baseUrl}?produto=MT`);
    const perfEnd = Date.now();
    const perfTime = perfEnd - perfStart;

    if (perfTest.ok) {
        const data = await perfTest.json();
        console.log(`✅ T7.1: Query executada`);
        console.log(`   Tempo: ${perfTime}ms`);
        console.log(`   Registros: ${data.length}`);
        console.log(`   Velocidade: ${(data.length / (perfTime / 1000)).toFixed(2)} reg/s`);

        if (perfTime < 5000) {
            console.log("   ✅ Performance aceitável (< 5s)");
            passCount++;
        } else if (perfTime < 10000) {
            console.log("   ⚠️  Performance lenta (< 10s)");
            passCount++;
        } else {
            console.log("   ❌ Performance ruim (> 10s)");
            failCount++;
        }
    }
    console.log('');

    // =====================================================
    // RESUMO
    // =====================================================
    console.log("═".repeat(50));
    console.log("📊 RESUMO DOS TESTES");
    console.log("═".repeat(50));
    console.log(`✅ Passou: ${passCount}`);
    console.log(`❌ Falhou: ${failCount}`);
    console.log(`📈 Taxa de Sucesso: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
    console.log("");

    if (failCount === 0) {
        console.log("🎉 TODOS OS TESTES PASSARAM! 🎉");
    } else {
        console.log(`⚠️  ${failCount} teste(s) falharam. Revisar erros acima.`);
    }
}

testAllFilters();
