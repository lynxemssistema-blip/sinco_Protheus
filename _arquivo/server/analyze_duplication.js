
async function analyzeDuplication() {
    console.log("=== ANÁLISE DE DUPLICAÇÃO: Pedidos com PV ===\n");

    // Teste 1: Contar registros sem JOIN
    console.log("📊 TESTE 1: Contagem base (SC5 + SC6 apenas)");
    const baseQuery = `
        SELECT COUNT(*) as total
        FROM sc5010 sc5
        JOIN sc6010 sc6
          ON TRIM(COALESCE(sc6.d_e_l_e_t_, '')) = ''
         AND sc6.c6_filial = sc5.c5_filial
         AND sc6.c6_num = sc5.c5_num
        WHERE TRIM(COALESCE(sc5.d_e_l_e_t_, '')) = ''
          AND sc5.c5_num LIKE '%3716%'
    `;

    // Teste 2: Com JOIN de produto (SB1)
    console.log("\n📊 TESTE 2: Com produto (+ SB1)");
    const withProduct = `
        SELECT COUNT(*) as total
        FROM sc5010 sc5
        JOIN sc6010 sc6
          ON TRIM(COALESCE(sc6.d_e_l_e_t_, '')) = ''
         AND sc6.c6_filial = sc5.c5_filial
         AND sc6.c6_num = sc5.c5_num
        LEFT JOIN sb1010 sb1
          ON TRIM(COALESCE(sb1.d_e_l_e_t_, '')) = ''
         AND sb1.b1_cod = sc6.c6_produto
        WHERE TRIM(COALESCE(sc5.d_e_l_e_t_, '')) = ''
          AND sc5.c5_num LIKE '%3716%'
    `;

    // Teste 3: Com JOIN de SC1 (via observação) - CAUSA MAIS PROVÁVEL DE DUPLICAÇÃO
    console.log("\n📊 TESTE 3: Com SC via observação (+ SC1) - ⚠️ CRÍTICO");
    const withSC = `
        SELECT COUNT(*) as total,
               COUNT(DISTINCT sc5.c5_num || sc6.c6_item) as pedidos_unicos,
               COUNT(*) - COUNT(DISTINCT sc5.c5_num || sc6.c6_item) as duplicados
        FROM sc5010 sc5
        JOIN sc6010 sc6
          ON TRIM(COALESCE(sc6.d_e_l_e_t_, '')) = ''
         AND sc6.c6_filial = sc5.c5_filial
         AND sc6.c6_num = sc5.c5_num
        LEFT JOIN sc1010 sc1
          ON TRIM(COALESCE(sc1.d_e_l_e_t_, '')) = ''
         AND NULLIF(BTRIM(sc1.c1_obs), '') IS NOT NULL
         AND (
                sc1.c1_obs ILIKE '%' || BTRIM(sc5.c5_num) || '%'
             OR sc1.c1_obs ILIKE '%' || LTRIM(BTRIM(sc5.c5_num), '0') || '%'
         )
        WHERE TRIM(COALESCE(sc5.d_e_l_e_t_, '')) = ''
          AND sc5.c5_num LIKE '%3716%'
    `;

    // Teste 4: Com JOIN de PC (via SC) - DUPLICAÇÃO EXTRA
    console.log("\n📊 TESTE 4: Com PC via SC (+ SC7) - ⚠️ CRÍTICO");
    const withPC = `
        SELECT COUNT(*) as total,
               COUNT(DISTINCT sc5.c5_num || sc6.c6_item) as pedidos_unicos,
               COUNT(*) - COUNT(DISTINCT sc5.c5_num || sc6.c6_item) as duplicados
        FROM sc5010 sc5
        JOIN sc6010 sc6
          ON TRIM(COALESCE(sc6.d_e_l_e_t_, '')) = ''
         AND sc6.c6_filial = sc5.c5_filial
         AND sc6.c6_num = sc5.c5_num
        LEFT JOIN sc1010 sc1
          ON TRIM(COALESCE(sc1.d_e_l_e_t_, '')) = ''
         AND NULLIF(BTRIM(sc1.c1_obs), '') IS NOT NULL
         AND (
                sc1.c1_obs ILIKE '%' || BTRIM(sc5.c5_num) || '%'
             OR sc1.c1_obs ILIKE '%' || LTRIM(BTRIM(sc5.c5_num), '0') || '%'
         )
        LEFT JOIN sc7010 sc7
          ON TRIM(COALESCE(sc7.d_e_l_e_t_, '')) = ''
         AND sc7.c7_filial = sc1.c1_filial
         AND sc7.c7_numsc = sc1.c1_num
         AND sc7.c7_itemsc = sc1.c1_item
        WHERE TRIM(COALESCE(sc5.d_e_l_e_t_, '')) = ''
          AND sc5.c5_num LIKE '%3716%'
    `;

    // Teste 5: Verificar quantas SCs referenciam o mesmo PV
    console.log("\n📊 TESTE 5: Quantas SCs diferentes mencionam o mesmo PV?");
    const scPerPV = `
        SELECT 
            sc5.c5_num as pv,
            COUNT(DISTINCT sc1.c1_num) as qtd_scs_diferentes,
            STRING_AGG(DISTINCT sc1.c1_num, ', ') as scs
        FROM sc5010 sc5
        LEFT JOIN sc1010 sc1
          ON TRIM(COALESCE(sc1.d_e_l_e_t_, '')) = ''
         AND NULLIF(BTRIM(sc1.c1_obs), '') IS NOT NULL
         AND (
                sc1.c1_obs ILIKE '%' || BTRIM(sc5.c5_num) || '%'
             OR sc1.c1_obs ILIKE '%' || LTRIM(BTRIM(sc5.c5_num), '0') || '%'
         )
        WHERE TRIM(COALESCE(sc5.d_e_l_e_t_, '')) = ''
          AND sc5.c5_num LIKE '%3716%'
        GROUP BY sc5.c5_num
        ORDER BY qtd_scs_diferentes DESC
    `;

    // Teste 6: Verificar múltiplos itens no PV
    console.log("\n📊 TESTE 6: Quantos itens tem cada PV?");
    const itemsPerPV = `
        SELECT 
            sc5.c5_num as pv,
            COUNT(*) as qtd_itens
        FROM sc5010 sc5
        JOIN sc6010 sc6
          ON TRIM(COALESCE(sc6.d_e_l_e_t_, '')) = ''
         AND sc6.c6_filial = sc5.c5_filial
         AND sc6.c6_num = sc5.c5_num
        WHERE TRIM(COALESCE(sc5.d_e_l_e_t_, '')) = ''
          AND sc5.c5_num LIKE '%3716%'
        GROUP BY sc5.c5_num
    `;

    console.log("\n📋 CAUSAS PROVÁVEIS DE DUPLICAÇÃO:");
    console.log("1️⃣  JOIN com SC1 via ILIKE na observação");
    console.log("   - Uma SC pode mencionar múltiplos PVs na observação");
    console.log("   - Match com zeros (003716) E sem zeros (3716) pode duplicar");
    console.log("   - Uma observação pode conter o número por acidente");
    console.log("");
    console.log("2️⃣  Múltiplas SCs para o mesmo PV");
    console.log("   - Várias SCs podem mencionar o mesmo PV");
    console.log("   - Cada SC gera uma linha na tabela");
    console.log("");
    console.log("3️⃣  Múltiplos PCs para a mesma SC");
    console.log("   - Uma SC pode ter múltiplos PCs");
    console.log("   - Cada PC gera uma linha adicional");
    console.log("");
    console.log("4️⃣  Múltiplos itens no PV");
    console.log("   - Cada item do PV é uma linha");
    console.log("   - Se cada item tiver SC/PC, multiplica ainda mais");
    console.log("");

    console.log("\n💡 SOLUÇÕES POSSÍVEIS:");
    console.log("A) Usar DISTINCT nos campos chave");
    console.log("B) Adicionar filtro para evitar match duplo (com/sem zeros)");
    console.log("C) Limitar JOIN de SC1 a apenas 1 registro por PV (usando DISTINCT ON)");
    console.log("D) Agrupar resultados no backend antes de retornar");
    console.log("E) Revisar lógica de match via observação (é confiável?)");
    console.log("");

    console.log("\n🔍 Para testar no banco, execute:");
    console.log("1. Teste base:", baseQuery);
    console.log("\n2. Com SC:", withSC);
    console.log("\n3. Com PC:", withPC);
    console.log("\n4. SCs por PV:", scPerPV);
    console.log("\n5. Itens por PV:", itemsPerPV);
}

analyzeDuplication();
