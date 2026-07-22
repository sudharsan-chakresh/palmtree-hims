const { execSync } = require('child_process');
const fs = require('fs');

try {
  const output = execSync('npx playwright test tests/regression/tenant/billing_regression.spec.ts --reporter=json', { cwd: 'd:/Training/working/HIMS', encoding: 'utf-8', stdio: 'pipe' });
  fs.writeFileSync('d:/Training/working/HIMS/test-error.json', output);
} catch (e) {
  if (e.stdout) {
    fs.writeFileSync('d:/Training/working/HIMS/test-error.json', e.stdout);
  } else {
    fs.writeFileSync('d:/Training/working/HIMS/test-error.json', JSON.stringify({ error: e.message }));
  }
}
