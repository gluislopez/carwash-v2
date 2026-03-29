const fs = require('fs');
let code = fs.readFileSync('src/pages/DashboardPanel.jsx', 'utf8');

const replacement = `                                    onClick={async () => {
                                        try {
                                            await generateDailyReport({
                                                statsTransactions,
                                                expenses,
                                                getPRDateString,
                                                getServiceName,
                                                employees
                                            });
                                        } catch (error) {
                                            console.error("Error generating PDF:", error);
                                            alert("Error: " + error.message);
                                        }
                                    }}`;

const lines = code.split('\n');
const newLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
    // Look for the start of the block
    if (!skip && lines[i].includes('onClick={async () => {') && lines[i+1] && lines[i+1].includes('try {') && lines[i+2] && lines[i+2].includes('// 1. Gather Data')) {
        skip = true;
        newLines.push(replacement);
        continue;
    }
    
    // Look for the end of the block
    if (skip && lines[i].includes('} catch (error) {') && lines[i+1] && lines[i+1].includes('console.error("Error generating PDF:", error);')) {
        skip = false;
        i += 3; // skip catch, alert, }} 
        continue;
    }
    
    if (!skip) {
        newLines.push(lines[i]);
    }
}

const finalCode = newLines.join('\n').replace(
    "import ConfigModal from '../components/dashboard/ConfigModal';",
    "import ConfigModal from '../components/dashboard/ConfigModal';\nimport { generateDailyReport } from '../utils/dailyReportPdf';"
);

fs.writeFileSync('src/pages/DashboardPanel.jsx', finalCode);
console.log("Replaced successfully!");
