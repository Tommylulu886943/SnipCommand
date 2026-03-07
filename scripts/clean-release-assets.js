const { execSync } = require('child_process');
const pkg = require('../package.json');
const version = pkg.version;
const tag = `v${version}`;
const repo = pkg.repository || 'Tommylulu886943/SnipCommand';

const unwanted = [
    'latest.yml',
    `SnipCommand-Setup-${version}.exe.blockmap`
];

for (const asset of unwanted) {
    try {
        execSync(`gh release delete-asset ${tag} "${asset}" -y -R ${repo}`, { stdio: 'inherit' });
    } catch (e) {
        // Asset may not exist, ignore
    }
}
