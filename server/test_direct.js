
async function directTest() {
    const url = 'http://localhost:3001/api/stock/balances?limit=5';
    console.log("=== DIRECT TEST ===");
    console.log("URL:", url);
    console.log("Time:", new Date().toISOString());

    try {
        const response = await fetch(url);
        console.log("\nResponse status:", response.status);
        console.log("Response headers:", Object.fromEntries(response.headers.entries()));

        const text = await response.text();
        console.log("\nResponse body:", text);

        try {
            const json = JSON.parse(text);
            console.log("\nParsed JSON:");
            console.log("Type:", Array.isArray(json) ? "Array" : typeof json);
            console.log("Length:", json.length);
        } catch (e) {
            console.log("Not JSON:", e.message);
        }
    } catch (e) {
        console.error("\nERROR:", e.message);
        console.error(e.stack);
    }
}

directTest();
