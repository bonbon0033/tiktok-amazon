#!/usr/bin/env node
// Generate 3 hook candidates for the 0-3s opening of a TikTok video.
//   node agents/hook-generator.mjs <theme>
//
// Reads research/data/picked.json + docs/hook-formulas.md, writes research/data/hooks.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmAvailable, llmChat, parseJson } from './lib/llm.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const theme = process.argv[2] || '自己啓発';
const pattern = process.argv[3] || 'ranking'; // ranking | story

const pickedPath = path.join(root, 'research/data/picked.json');
const formulasPath = path.join(root, 'docs/hook-formulas.md');

if (!fs.existsSync(pickedPath)) {
  console.error(`Run product-picker first: node agents/product-picker.mjs ${theme}`);
  process.exit(1);
}

const picked = JSON.parse(fs.readFileSync(pickedPath, 'utf8'));

const stratPath = path.join(root, 'data/strategy.json');
const strategy = fs.existsSync(stratPath)
  ? JSON.parse(fs.readFileSync(stratPath, 'utf8'))
  : { topHooks: [], byHookFormula: {} };

console.log(`[hooks] Theme: ${theme} / Pattern: ${pattern}`);
if (strategy.basedOn > 0) {
  console.log(`[hooks] Strategy: top formulas = [${strategy.topHooks.slice(0, 3).join(', ')}] (from ${strategy.basedOn} posts)`);
}
const useLlm = await llmAvailable();
console.log(`[hooks] Ollama: ${useLlm ? 'available' : 'unavailable → rule-based'}`);

let result;
if (useLlm) {
  result = await llmGenerate(theme, pattern, picked.products, strategy);
} else {
  result = ruleBasedHooks(theme, pattern, picked.products, strategy);
}

const outPath = path.join(root, 'research/data/hooks.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`\nWrote ${path.relative(root, outPath)}`);
for (const h of result.hooks) {
  console.log(`  [${h.id}] (${h.formula_id}) 「${h.text}」 — ${h.rationale}`);
}

// ─────────────────────────────────────────

async function llmGenerate(theme, pattern, products, strategy) {
  const formulas = fs.readFileSync(formulasPath, 'utf8').slice(0, 4500);
  const top = products[0];
  const stratHint = strategy.basedOn > 0
    ? `\n過去実績で勝率が高い formula: [${strategy.topHooks.slice(0, 3).join(', ')}] — 3つのうち最低2つはこの中から選ぶこと。`
    : '';

  const system = `TikTok 用 30秒動画のフック生成 AI。
日本語のみ、15文字以内、煽り強め。
完走率を最大化することが唯一の目的。
出力は厳密に JSON のみ。`;

  const user = `テーマ: 「${theme}」
動画パターン: ${pattern === 'ranking' ? 'TOP5 ランキング型' : '1商品ストーリー型'}
主軸商品: ${top.name} (${top.price})

フック公式集（抜粋）:
${formulas}
${stratHint}

上記から最適な3パターン（A/B/C）のフックを生成。各フックは異なる formula を使う。
出力 JSON:
{
  "theme": "${theme}",
  "pattern": "${pattern}",
  "hooks": [
    {"id": "A", "formula_id": "F0X", "text": "15文字以内", "rationale": "なぜ刺さるか1行"},
    {"id": "B", "formula_id": "F0X", "text": "...", "rationale": "..."},
    {"id": "C", "formula_id": "F0X", "text": "...", "rationale": "..."}
  ]
}`;

  const out = await llmChat({ system, user, format: 'json', temperature: 0.9, maxTokens: 1024 });
  return parseJson(out);
}

function ruleBasedHooks(theme, pattern, products, strategy = {}) {
  // Evidence-based hooks. Mapped to docs/hook-formulas.md formulas F01-F05.
  if (pattern === 'story') {
    return {
      theme, pattern, generatedBy: 'rule-based',
      hooks: [
        { id: 'A', formula_id: 'F05', text: `3年悩んだ${theme}問題、これで解決した`, rationale: '課題解決型、共感+ビフォーアフター訴求' },
        { id: 'B', formula_id: 'F01', text: `${theme}でリピ買いしてる神品`, rationale: '実体験ソーシャルプルーフ、CVR↑' },
        { id: 'C', formula_id: 'F04', text: `Amazonで買って後悔した${theme}3選`, rationale: '逆張り損失喚起、完走率↑' },
      ],
    };
  }
  // 4-slide life-change story (パターン②モデル1)
  if (pattern === 'slide-life-change') {
    return {
      theme, pattern, generatedBy: 'rule-based',
      hooks: [
        { id: 'A', formula_id: 'F05', text: `私が月0→5万稼げた本当の理由`, rationale: '失敗→成功ストーリー、共感→保存率↑↑' },
        { id: 'B', formula_id: 'F05', text: `3年悩んだ${theme}問題が解決した話`, rationale: '課題解決ストーリー、感情移入で CVR↑' },
        { id: 'C', formula_id: 'F06', text: `これに気づかないと一生変われない話`, rationale: '損失予告 + 自己啓発、刺さる対象を絞る' },
      ],
    };
  }
  // Aspirational morning routine (パターン②モデル2)
  if (pattern === 'slide-routine') {
    return {
      theme, pattern, generatedBy: 'rule-based',
      hooks: [
        { id: 'A', formula_id: 'F01', text: `美意識高い人の朝はこれから始まる`, rationale: '憧れライフスタイル、シェア爆発' },
        { id: 'B', formula_id: 'F01', text: `6時起きの私のモーニングルーティン`, rationale: '時刻+実体験、信頼感' },
        { id: 'C', formula_id: 'F02', text: `${theme}が変わる朝の習慣5選`, rationale: 'リスト感 + 数字' },
      ],
    };
  }
  // Influencer/celebrity-style ranking (パターン①モデル2)
  if (pattern === 'ranking-influencer') {
    return {
      theme, pattern, generatedBy: 'rule-based',
      hooks: [
        { id: 'A', formula_id: 'F09', text: `芸能人も愛用Amazon${theme}TOP5`, rationale: '群衆プルーフ + 憧れ' },
        { id: 'B', formula_id: 'F09', text: `成功者の99%が使ってるAmazon${theme}`, rationale: '群衆プルーフ + 希少性' },
        { id: 'C', formula_id: 'F06', text: `知らないと取り残されるAmazon${theme}5選`, rationale: 'FOMO 損失' },
      ],
    };
  }
  // Hidden gem / niche ranking (パターン①モデル3)
  if (pattern === 'ranking-niche') {
    return {
      theme, pattern, generatedBy: 'rule-based',
      hooks: [
        { id: 'A', formula_id: 'F07', text: `Amazonで隠れ爆売れの${theme}TOP5`, rationale: '希少性 + ベストセラー' },
        { id: 'B', formula_id: 'F07', text: `知る人ぞ知るAmazon${theme}神品`, rationale: '希少性 + 神アイテム' },
        { id: 'C', formula_id: 'F02', text: `3000円以下で買える隠れた${theme}神品TOP5`, rationale: '価格縛り + 希少性' },
      ],
    };
  }

  if (pattern === 'top3-price') {
    // FOMO-loaded variants per docs/hook-formulas.md F06-F10
    return {
      theme, pattern, generatedBy: 'rule-based',
      hooks: [
        { id: 'A', formula_id: 'F06', text: `今買わないと一生損するAmazon神品TOP3`, rationale: '損失予告 (F06) で即時購買↑、最強 FOMO' },
        { id: 'B', formula_id: 'F07', text: `99%は気づいてないAmazon神品TOP3`, rationale: '希少性 (F07) + プライド刺激、保存率↑' },
        { id: 'C', formula_id: 'F08', text: `もうすぐ値上げかもAmazonコスパTOP3`, rationale: '値上げ煽り (F08) + 価格縛り、即決促進' },
      ],
    };
  }
  // Default ranking pattern — FOMO 寄りに強化
  // Reorder by learned strategy: if performance log exists, A = highest-scoring formula.
  const defaults = [
    { formula_id: 'F06', text: `今買い逃したら一生後悔するAmazon${theme}5選`, rationale: '損失予告 FOMO、最強の即時購買トリガー' },
    { formula_id: 'F07', text: `99%は知らないAmazon${theme}神品5選`, rationale: '希少性 FOMO、プライド刺激で保存↑' },
    { formula_id: 'F09', text: `TikTokで9割が買ってるAmazon${theme}TOP5`, rationale: '群衆プルーフ FOMO、信頼感↑' },
    { formula_id: 'F05', text: `3年悩んだ${theme}問題、これで解決した`, rationale: '課題解決ストーリー、共感+ビフォーアフター' },
    { formula_id: 'F08', text: `もうすぐ値上げかもAmazon${theme}TOP5`, rationale: '値上げ煽り、即決促進' },
  ];

  // If we have learned weights, sort defaults by topHooks rank, take 3.
  let chosen = defaults;
  if (strategy.topHooks && strategy.topHooks.length > 0 && strategy.basedOn > 0) {
    const order = new Map(strategy.topHooks.map((id, i) => [id, i]));
    chosen = [...defaults].sort((a, b) => {
      const ra = order.has(a.formula_id) ? order.get(a.formula_id) : 99;
      const rb = order.has(b.formula_id) ? order.get(b.formula_id) : 99;
      return ra - rb;
    });
  }

  return {
    theme, pattern,
    generatedBy: strategy.basedOn > 0 ? `rule-based (re-ranked by ${strategy.basedOn}-post strategy)` : 'rule-based',
    hooks: chosen.slice(0, 3).map((h, i) => ({ id: ['A', 'B', 'C'][i], ...h })),
  };
}
