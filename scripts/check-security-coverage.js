'use strict';

/**
 * セキュリティクリティカル整合性チェック（健診思想・fail-closed）
 *
 * context/skills.md のトリガーB（security-review）は「auth.js / crypto.js / トークン・
 * OAuth処理を変更したとき」という自然文で書かれており、実際にOAuthトークン交換を行う
 * supabase/functions/ebay-token/index.ts のようなファイルが文字列一致せず対象漏れに
 * なっていた（2026-06-25発見・仕入れインテリジェンスプロジェクトの同型バグから検証）。
 *
 * 本スクリプトは // @security-critical マーカーを実態側の単一ソースとし、
 * context/skills.md のトリガーB明示リストと双方向に突き合わせる。
 *
 * 終了コード：ERROR（①②）が1件でもあれば 1（fail-closed・手動実行必須・CI/pre-commit未整備）。
 * WARN（③）のみなら 0（開発摩擦を避けるため停止しない・人間判断に委ねる）。
 *
 * 注：仕入れインテリジェンス版（check-safety-coverage.js）と異なり、本プロジェクトには
 * test/ ディレクトリの規約が存在しないため、対応テスト保護チェック（④）は実装しない。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKILLS_MD = path.join(ROOT, 'context', 'skills.md');

// 付け忘れ検出（③）の対象境界ディレクトリ
const BOUNDARY_DIRS = ['js/core', 'js/features', 'supabase/functions'];
const BOUNDARY_EXTENSIONS = ['.js', '.ts'];

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walkFiles(dir, extensions) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, extensions));
    } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

function readMarker(filePath) {
  const head = fs.readFileSync(filePath, 'utf8').split('\n').slice(0, 5).join('\n');
  if (/^\s*\/\/\s*@security-critical\b/m.test(head)) return 'critical';
  if (/^\s*\/\/\s*@not-security-critical\b/m.test(head)) return 'not-critical';
  return null;
}

function extractSkillsMdList() {
  const text = fs.readFileSync(SKILLS_MD, 'utf8');
  const startIdx = text.indexOf('### トリガーB 対象ファイル明示リスト');
  const endIdx = text.indexOf('### 実行順序');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('skills.md の構造が想定と異なります（トリガーB対象ファイル明示リストの見出しが見つからない）。手動確認が必要。');
  }
  const region = text.slice(startIdx, endIdx);
  // (?<!\S) ＝ 直前が空白または行頭であることを要求する（地の文中の「auto-listing.js/settings.js」
  // のような連結表記から偽の "js/settings.js" を誤抽出するバグを防ぐ・2026-06-25発見）
  const matches = region.match(/(?<!\S)(?:js|supabase)\/[^\s,、。）)・]+\.(?:js|ts)/g) || [];
  return new Set(matches);
}

function main() {
  const errors = [];
  const warnings = [];

  let allFiles = [];
  for (const dir of BOUNDARY_DIRS) {
    allFiles.push(...walkFiles(path.join(ROOT, dir), BOUNDARY_EXTENSIONS));
  }
  allFiles = allFiles.map(f => toPosix(path.relative(ROOT, f)));

  const markedCritical = new Set();
  const markedNotCritical = new Set();
  const unmarked = [];

  for (const relPath of allFiles) {
    const marker = readMarker(path.join(ROOT, relPath));
    if (marker === 'critical') markedCritical.add(relPath);
    else if (marker === 'not-critical') markedNotCritical.add(relPath);
    else unmarked.push(relPath);
  }

  const skillsMdList = extractSkillsMdList();

  // ① 実態→リスト（漏れ検出）= ERROR
  for (const f of markedCritical) {
    if (!skillsMdList.has(f)) {
      errors.push(`[① 漏れ] ${f} は @security-critical だが、skills.md の明示リストに無い`);
    }
  }

  // ② リスト→実態（死リンク検出・未マーク検出）= ERROR
  // skills.md のリストには @security-critical（対象）と @not-security-critical（対象外・
  // ドキュメント目的で明記）の両方が載るため、②bはどちらのマーカーでも合格とする。
  for (const listed of skillsMdList) {
    const abs = path.join(ROOT, listed);
    if (!fs.existsSync(abs)) {
      errors.push(`[② 死リンク] skills.md に記載の "${listed}" が実在しない（リネーム/削除の可能性）`);
      continue;
    }
    if (!markedCritical.has(listed) && !markedNotCritical.has(listed)) {
      errors.push(`[②b 未マーク] skills.md に記載の "${listed}" は実在するが @security-critical / @not-security-critical のいずれのマーカーも無い`);
    }
  }

  // ③ 付け忘れ検出（境界ディレクトリ配下・マーカー無し）= WARN
  for (const relPath of unmarked) {
    warnings.push(`[③ 付け忘れ] ${relPath} は境界ディレクトリ配下だが @security-critical / @not-security-critical のいずれも無い`);
  }

  console.log(`[check-security-coverage] @security-critical: ${markedCritical.size}件 / skills.md明示リスト: ${skillsMdList.size}件`);
  console.log('');

  if (errors.length > 0) {
    console.error('❌ ERROR:');
    for (const e of errors) console.error(`  - ${e}`);
  } else {
    console.log('✅ ERROR項目なし（実態とskills.mdのリストは同期している）');
  }

  console.log('');

  if (warnings.length > 0) {
    console.warn('⚠️  WARN:');
    for (const w of warnings) console.warn(`  - ${w}`);
  } else {
    console.log('✅ WARN項目なし');
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main();
