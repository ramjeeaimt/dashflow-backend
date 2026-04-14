const fs = require('fs');
const path = require('path');

const targetPath = path.join('c:', 'Users', 'Pc', 'Documents', 'DifmoProject', 'CRM', 'difmo_crm_backend', 'src', 'modules', 'mail', 'templates', 'welcome.hbs');

console.log('Target path:', targetPath);
try {
    if (fs.existsSync(targetPath)) {
        console.log('✅ File exists!');
        const content = fs.readFileSync(targetPath, 'utf8');
        console.log('✅ File is readable, length:', content.length);
    } else {
        console.log('❌ File does NOT exist!');
    }
} catch (e) {
    console.error('❌ Error reading file:', e);
}
