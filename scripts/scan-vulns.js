const fs = require('fs');
const path = require('path');

const sbomPath = path.join(__dirname, '..', 'sbom.json');
if (!fs.existsSync(sbomPath)) {
  console.error('SBOM not found. Please run "npm run sbom" first.');
  process.exit(1);
}

const sbom = JSON.parse(fs.readFileSync(sbomPath, 'utf8'));
const vulns = [];

// Support both old format {dependencies:{}} and new CycloneDX format {components:[]}
const components = sbom.components
  ? Object.fromEntries(sbom.components.map(c => [c.name, c.version]))
  : (sbom.dependencies || {});

// --- MOCK VULNERABILITY DETECTION ---
// We simulate finding a critical vulnerability in 'lodash' if version is < 4.17.21
if (components.lodash) {
  const current = components.lodash;
  // Simple version check: if it starts with 4.17.1 (like 4.17.15, 4.17.19), it's vulnerable
  if (current.startsWith('4.17.1') && current !== '4.17.1') {
    vulns.push({
      package: 'lodash',
      currentVersion: current,
      cve: 'CVE-2020-8203',
      severity: 'HIGH',
      description: 'Lodash versions prior to 4.17.21 are vulnerable to Prototype Pollution via the merge function.',
      recommendedVersion: '4.17.21'
    });
  }
}

const report = {
  project: sbom.name,
  scanTimestamp: new Date().toISOString(),
  vulns
};

const outputPath = path.join(__dirname, '..', 'vuln-report.json');
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

console.log('--------------------------------------------------');
console.log('🛡️  DevSecOps Vulnerability Scan Report');
console.log('--------------------------------------------------');
if (vulns.length > 0) {
  console.log(`⚠️  FOUND ${vulns.length} VULNERABILITY(S)`);
  vulns.forEach(v => {
    console.log(`   - [${v.severity}] ${v.package}: ${v.cve}`);
    console.log(`     Description: ${v.description}`);
    console.log(`     Recommendation: Upgrade to ${v.recommendedVersion}`);
  });
} else {
  console.log('✅ No vulnerabilities found in dependencies.');
}
console.log('--------------------------------------------------');
console.log(`Full report saved to: ${outputPath}`);

