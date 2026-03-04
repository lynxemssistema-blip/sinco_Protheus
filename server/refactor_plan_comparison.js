// REFACTOR PLAN for /tracking-comparison

/*
    GOAL: 
    1. Fix "Operation mixing with sequence": Group by Description/Resource, not Sequence.
    2. Fix "OP Number missing": Ensure logic handles OP context correctly even in aggregation.
    3. Fix "Calculation error": Ensure precise matching of Planned vs Realized by Process.

    STRATEGY:
    - Step 1: Fetch App Appointments (MySQL) with filters.
    - Step 2: Extract unique OP numbers from App results.
    - Step 3: Fetch Planned Data from Protheus (Postgres) for filters + INCLUDE the OPs found in App.
        - Important: Even if an OP is not in the Protheus filter scope (e.g. date range), if it has an appointment in the App date range, we need its metadata to know what "01" means.
    - Step 4: Build a "Routing Map": OP_NUM -> { Seq '01': 'Corte', Seq '02': 'Dobra' }.
    - Step 5: Process App Data:
        - For each appointment, lookup OP + Seq in Routing Map.
        - Determine "Real Operation Name" (e.g. 'Corte').
        - Add 'Qtd Apontada' to that Real Operation Name.
    - Step 6: Process Planned Data:
        - Iterate Protheus Data.
        - Determine "Real Operation Name".
        - Add 'Qtd Planejada' to that Real Operation Name.
    - Step 7: Calculate differences and return.
*/

router.get('/tracking-comparison', async (req, res) => {
    // ... filters ...

    // 1. Get Appointments (MySQL) - Select OP_NUM, OPERACAO_CODIGO, QUANTIDADE, DATA
    const appointmentsQuery = `SELECT op_numero, operacao_codigo, SUM(quantidade) as qtd FROM app_production_appointments ... GROUP BY op_numero, operacao_codigo`;
    // ... execute ...

    // 2. Extract Ops
    const uniqueOps = [...new Set(appointmentsData.map(a => a.op_numero))];

    // 3. Update Protheus Query to be broader or specific
    // We need SC2 (OP) and SG2 (Routing)
    // Query: SELECT c2_num, g2_operac, g2_descri, g2_recurso, c2_quant
    // WHERE ... filters ... OR c2_num IN (uniqueOps)

    // 4. Build Map and Aggregate
    const operationsMap = {}; // Key: "Resource - Description" (e.g. "CNC - Corte")
    const routingMap = {}; // Key: "OP_NUM" -> { "01": "CNC - Corte" }

    // First Pass: Build Routing Structure from Planned Data
    plannedData.forEach(row => {
        const opNum = row.c2_num;
        const seq = row.g2_operac; // '01'
        const realName = `${row.g2_recurso || ''} - ${row.g2_descri || ''}`.trim();

        // Save to Routing Map for App Data Lookup
        if (!routingMap[opNum]) routingMap[opNum] = {};
        routingMap[opNum][seq] = realName;

        // Add to Aggregation (Planned)
        if (!operationsMap[realName]) initOp(operationsMap, realName);
        operationsMap[realName].planejado += row.qtd;
    });

    // Second Pass: Process App Data
    appointmentsData.forEach(row => {
        const opNum = row.op_numero;
        const seq = row.operacao_codigo;

        // Lookup Real Name
        let realName = routingMap[opNum]?.[seq];

        // Fallback: If Protheus request didn't return this OP (maybe closed/archived?), 
        // we might not know the name. Use "OP {opNum} - Seq {seq}" or "Sem Cadastro".
        if (!realName) realName = `Apont. Sem Roteiro (${seq})`;

        if (!operationsMap[realName]) initOp(operationsMap, realName);
        operationsMap[realName].apontado += row.qtd;
    });

    // ... Calculate Metrics & Response ...
});
