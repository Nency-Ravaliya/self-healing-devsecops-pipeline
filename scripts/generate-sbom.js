const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.4",
  serialNumber: `urn:uuid:${require('crypto').randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      name: pkg.name,
      version: pkg.version,
      type: "application"
    }
  },
  components: Object.entries(pkg.dependencies || {}).map(([name, version]) => ({
    name,
    version,
    type: "library",
    purl: `pkg:npm/${name}@${version}`
  }))
};

fs.writeFileSync(
  path.join(__dirname, '..', 'sbom.json'),
  JSON.stringify(sbom, null, 2)
);

console.log('CycloneDX SBOM generated at sbom.json');

