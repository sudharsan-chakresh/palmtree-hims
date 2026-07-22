const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  let files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      filelist.push(path.join(dir, file));
    }
  });
  return filelist;
};

const replaceInFile = (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
    const original = fs.readFileSync(filePath, 'utf8');
    const updated = original.replace(/Jioplix/g, 'Palmtree Wellness')
                            .replace(/jioplix/g, 'palmtree')
                            .replace(/JIOPLIX/g, 'PALMTREE');
    if (original !== updated) {
      fs.writeFileSync(filePath, updated, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
};

const srcDir = path.join(__dirname, 'src');
const filesToProcess = walkSync(srcDir);
filesToProcess.forEach(replaceInFile);
console.log("Replacement complete.");
