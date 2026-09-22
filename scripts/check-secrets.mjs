import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// CI scans the Git index plus new, nonignored files. The filesystem fallback supports
// restricted local hosts where Node cannot launch child processes.
const excludedDirectories = new Set(['.git', 'node_modules', 'dist', '.next', 'build', '.dart_tool', '.local', 'coverage']);
function walk(directory = '.') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return excludedDirectories.has(entry.name) ? [] : walk(path);
    return entry.isFile() ? [relative('.', path).replaceAll('\\', '/')] : [];
  });
}
let paths;
let source = 'Git index and nonignored new files';
if (process.argv.includes('--stdin-nul')) {
  paths = readFileSync(0, 'utf8').split('\0').filter(Boolean);
  source = 'Git paths supplied on stdin';
} else {
  try {
    paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch (error) {
    if (error?.code !== 'EPERM') throw error;
    paths = walk().filter(path => !/(^|\/)\.env(\.|$)/.test(path) || path.endsWith('.env.example'));
    source = 'workspace fallback (Git subprocess unavailable)';
  }
}
const privatePath = /(^|\/)(?!\.env\.example$)\.env(?:\.[^/]+)?$|\.(?:pem|p8|p12|pfx|cer|crt|mobileprovision|jks|keystore|key|sqlite|db)$|(^|\/)key\.properties$/i;
const patterns = [
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ['cloud access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ['live payment key', /\b(?:sk_live|sk_test)_[A-Za-z0-9]{16,}\b/],
  ['embedded URL password', /(?:postgres(?:ql)?|rediss?|https?):\/\/[^\s/'"`:@]+:([^\s@/'"`]+)@/],
];
const placeholder = /^(?:replace[-_]|example|placeholder|dummy|test[-_]|pass(?:word)?$|homeclean$|<|\$\{|\{\{)/i;
const findings = [];
for (const path of paths) {
  if (privatePath.test(path) && !path.endsWith('.env.example')) findings.push(`${path}: private file path`);
  let content;
  try {
    if (statSync(path).size > 2_000_000) continue;
    const bytes = readFileSync(path);
    if (bytes.includes(0)) continue;
    content = bytes.toString('utf8');
  } catch {
    findings.push(`${path}: unreadable file`);
    continue;
  }
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    for (const [name, pattern] of patterns) {
      const match = pattern.exec(line);
      if (!match) continue;
      if (name === 'embedded URL password' && placeholder.test(match[1])) continue;
      findings.push(`${path}:${index + 1}: ${name}`);
    }
  }
}
if (findings.length) {
  console.error(`Secret scan FAIL (${source}):`);
  for (const finding of findings) console.error(finding);
  process.exitCode = 1;
} else console.log(`Secret scan PASS: ${paths.length} files checked (${source}); no high-confidence credentials or private files found.`);
