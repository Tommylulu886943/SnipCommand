const { execFileSync } = require('child_process');
const pkg = require('../package.json');
const version = pkg.version;
const tag = `v${version}`;
const repo = (pkg.repository && pkg.repository.url)
    ? pkg.repository.url.replace(/^.*github\.com\//, '').replace(/\.git$/, '')
    : 'Tommylulu886943/SnipCommand';

const unwanted = [
    `SnipCommand-Setup-${version}.exe.blockmap`
];

for (const asset of unwanted) {
    try {
        execFileSync('gh', ['release', 'delete-asset', tag, asset, '-y', '-R', repo], { stdio: 'inherit' });
    } catch (e) {
        // Asset may not exist, ignore
    }
}

// Set clean release title
try {
    execFileSync('gh', ['release', 'edit', tag, '--title', tag, '-R', repo], { stdio: 'inherit' });
} catch (e) {
    // ignore
}
