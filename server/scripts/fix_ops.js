const db = require('../db');

async function fix() {
    try {
        // Fix OP 005927: quantity 2, date 20260501
        await db.query(`UPDATE public.sc2010 SET c2_quant = 2, c2_datpri = '20260501', c2_datprf = '20260501' WHERE c2_num = '005927'`);
        
        // Fix OP 005928: quantity 3, date 20260506
        await db.query(`UPDATE public.sc2010 SET c2_quant = 3, c2_datpri = '20260506', c2_datprf = '20260506' WHERE c2_num = '005928'`);

        // Fix OP 005930: quantity 5, date 20260508
        await db.query(`UPDATE public.sc2010 SET c2_quant = 5, c2_datpri = '20260508', c2_datprf = '20260508' WHERE c2_num = '005930'`);

        console.log("FIX SUCCESSFUL!");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
fix();
