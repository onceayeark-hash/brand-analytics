'use strict';
// @not-security-critical (test runner only)

/**
 * security-hook.js の動作検証スクリプト
 * npm run test:hook で実行。Claude Code のフック機構と同じ
 * プロセスレベルの stdin を使うため PowerShell パイプ問題を回避する。
 */

const { spawnSync } = require('child_process');
const path = require('path');

const HOOK = path.join(__dirname, 'security-hook.js');

function run(filePath, expectedCode) {
  const input = JSON.stringify({
    tool_name: 'Edit',
    tool_input: { file_path: filePath },
  });
  const result = spawnSync('node', [HOOK], { input, encoding: 'utf8' });
  const actual = result.status ?? 1;
  if (actual !== expectedCode) {
    console.error(`FAIL: ${filePath} → exit ${actual} (expected ${expectedCode})`);
    process.exit(1);
  }
  console.log(`ok: ${filePath} → exit ${actual}`);
}

// @security-critical → exit(2) であること
run('js/core/auth.js',   2);
run('js/core/crypto.js', 2);

// @not-security-critical → exit(0) であること
run('js/core/cache.js',  0);
run('js/core/i18n.js',   0);

// 存在しないファイル → exit(0)（サイレント）であること
run('nonexistent.js',    0);

console.log('\n✅ security-hook test passed');
