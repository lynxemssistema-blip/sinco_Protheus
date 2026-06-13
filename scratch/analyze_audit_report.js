const fs = require('fs');

async function run() {
    try {
        const report = JSON.parse(fs.readFileSync('audit_report.json', 'utf8'));
        console.log(`Total files with issues: ${report.length}`);

        let totalTodos = 0;
        let filesWithTodos = 0;
        let totalCommentedBlocks = 0;
        let filesWithCommentedBlocks = 0;
        let totalOrphanFiles = 0;

        const todoBreakdown = [];
        const orphanBreakdown = [];

        report.forEach(item => {
            if (item.todos > 0) {
                totalTodos += item.todos;
                filesWithTodos++;
                todoBreakdown.push({ file: item.file, todos: item.todos });
            }
            if (item.commentedBlocks > 0) {
                totalCommentedBlocks += item.commentedBlocks;
                filesWithCommentedBlocks++;
            }
            if (item.isPotentiallyUnused) {
                totalOrphanFiles++;
                orphanBreakdown.push(item.file);
            }
        });

        console.log(`\n1. TODOs & FIXMEs:`);
        console.log(`- Total: ${totalTodos}`);
        console.log(`- Files with TODOs: ${filesWithTodos}`);
        todoBreakdown.sort((a, b) => b.todos - a.todos);
        console.log(`- Top 10 files with TODOs:`);
        console.table(todoBreakdown.slice(0, 10));

        console.log(`\n2. Commented out code blocks:`);
        console.log(`- Total blocks: ${totalCommentedBlocks}`);
        console.log(`- Files with commented blocks: ${filesWithCommentedBlocks}`);

        console.log(`\n3. Potentially orphan files (not imported):`);
        console.log(`- Total: ${totalOrphanFiles}`);
        console.log(`- Top 10 potential orphans:`);
        console.table(orphanBreakdown.slice(0, 10));

    } catch (err) {
        console.error(err);
    }
}

run();
