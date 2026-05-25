const fs = require('fs');
const path = require('path');

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  const entries = fs.readdirSync(from, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const srcTemplates = path.resolve(__dirname, '..', 'src', 'modules', 'mail', 'templates');
const distTemplates = path.resolve(__dirname, '..', 'dist', 'src', 'modules', 'mail', 'templates');

if (fs.existsSync(srcTemplates)) {
  copyFolderSync(srcTemplates, distTemplates);
  console.log('Mail templates copied to dist successfully.');
} else {
  console.warn('Source mail templates directory does not exist:', srcTemplates);
}
