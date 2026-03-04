
async function testWithLogging() {
    console.log("Sending request to: http://localhost:3001/api/stock/balances?descricao=CHAP&limit=10");
    try {
        const response = await fetch('http://localhost:3001/api/stock/balances?descricao=CHAP&limit=10');
        const text = await response.text();
        console.log("Response status:", response.status);
        console.log("Response:", text);

        // Wait a couple seconds for server logs
        await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
        console.error("Error:", e);
    }
}

testWithLogging();
