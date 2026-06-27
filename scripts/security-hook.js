'use strict';
// @not-security-critical (reads files for marker detection only, writes nothing)

/**
 * PostToolUse hook — @security-critical 変更検知
 *
 * 動作：Edit / Write ツールの実行後に Claude Code が呼び出す。
 * 変更ファイルの先頭10行に // @security-critical があれば
 * exit(2) で stderr にレビュー要求を送信する（"ブロック" ではなく
 * "強制フィードバック" — 編集はすでに通っており、Claude に次のアクションを
 * 強制的に提示する PostToolUse の正規の使い方）。
 *
 * パイプライン：
 *   Claude Code → JSON(stdin) → このスクリプト → exit(0|2)
 *
 * stdin JSON 構造（PostToolUse）：
 *   { tool_name: "Edit"|"Write", tool_input: { file_path: "..." }, ... }
 */

const fs   = require('fs');
const path = require('path');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  let filePath = null;

  try {
    const payload = JSON.parse(raw);
    filePath = payload?.tool_input?.file_path ?? payload?.tool_input?.path ?? null;
  } catch {
    process.exit(0);
  }

  if (!filePath) process.exit(0);

  // 相対パスの場合はプロジェクトルート（このスクリプトの親ディレクトリ）で解決
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.join(__dirname, '..', filePath);

  let head = '';
  try {
    const content = fs.readFileSync(resolved, 'utf8');
    head = content.split('\n').slice(0, 10).join('\n');
  } catch {
    process.exit(0);
  }

  if (/^\s*\/\/\s*@security-critical\b/m.test(head)) {
    process.stderr.write([
      '',
      '⚠  @security-critical ファイルの変更を検知しました',
      '',
      `    変更ファイル: ${filePath}`,
      '',
      '    次のアクションを手動で実行してください：',
      '      → Agent: everything-claude-code:security-reviewer',
      '',
      '    context/skills.md トリガーB を参照。確認後に作業を再開してください。',
      '',
    ].join('\n'));
    process.exit(2);
  }

  process.exit(0);
});
