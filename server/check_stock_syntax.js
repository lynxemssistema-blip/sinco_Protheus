
try {
    const stockRouter = require('./routes/stock');
    console.log("✅ stock.js loaded successfully");
    console.log("Routes:", stockRouter.stack ? stockRouter.stack.map(r => r.route?.path) : "No routes");
} catch (e) {
    console.error("❌ Error loading stock.js:");
    console.error(e);
}
