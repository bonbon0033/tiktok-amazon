#!/usr/bin/env node
// Read data/performance.json → compute strategy weights → write data/strategy.json.
// Used by product-picker / hook-generator to bias toward what works.
//
//   node agents/learn.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const perfPath = path.join(root, 'data/performance.json');
const compPath = path.join(root, 'data/competitors.json');
const stratPath = path.join(root, 'data/strategy.json');

const perf = JSON.parse(fs.readFileSync(perfPath, 'utf8'));
const posts = perf.posts || [];

const competitors = fs.existsSync(compPath)
  ? (JSON.parse(fs.readFileSync(compPath, 'utf8')).competitors || [])
  : [];

if (posts.length === 0) {
  console.log(`[learn] No posts logged yet. Writing baseline + competitor benchmark (${competitors.length} tracked).`);
  const b = competitorBenchmark(competitors);
  const base = baseline();
  base.competitorBenchmark = b;
  fs.writeFileSync(stratPath, JSON.stringify(base, null, 2));
  console.log(`  Wrote ${path.relative(root, stratPath)}`);
  if (competitors.length > 0) {
    console.log('\nCompetitor benchmark:');
    for (const [niche, s] of Object.entries(b.byNiche)) {
      console.log(`  ${niche}  n=${s.n}  medianViews=${fmt(s.medianViews)}  medianSave%=${(s.medianSaveRate * 100).toFixed(2)}  topBgm="${s.topBgm}"`);
    }
  }
  process.exit(0);
}

console.log(`[learn] Analyzing ${posts.length} posts...`);

const byFormula = groupAndScore(posts, p => p.hookFormulaId);
const byCategory = groupAndScore(posts, p => p.category);
const byVideoType = groupAndScore(posts, p => p.videoType);
const byPlatform = groupAndScore(posts, p => p.platform);

const topHooks = sortedKeys(byFormula).slice(0, 5);
const topCategories = sortedKeys(byCategory).slice(0, 5);
const topVideoTypes = sortedKeys(byVideoType).slice(0, 3);

const recs = buildRecommendations({ byFormula, byCategory, byVideoType, topHooks, topCategories, topVideoTypes, posts });

const benchmark = competitorBenchmark(competitors);
const gapRecs = competitorGapRecs(posts, benchmark);

const strategy = {
  updatedAt: new Date().toISOString(),
  basedOn: posts.length,
  windowDays: daysSpan(posts),
  byHookFormula: byFormula,
  byCategory: byCategory,
  byVideoType: byVideoType,
  byPlatform: byPlatform,
  topHooks,
  topCategories,
  topVideoTypes,
  competitorBenchmark: benchmark,
  recommendations: [...recs, ...gapRecs],
};

fs.writeFileSync(stratPath, JSON.stringify(strategy, null, 2));
console.log(`\nWrote ${path.relative(root, stratPath)}\n`);

console.log('Top hook formulas (by composite score):');
for (const k of topHooks) {
  const s = byFormula[k];
  console.log(`  ${k}  n=${s.n}  views=${fmt(s.avgViews)}  save%=${(s.avgSaveRate * 100).toFixed(2)}  cvr%=${(s.avgCvr * 100).toFixed(2)}  score=${s.score.toFixed(2)}`);
}
console.log('\nTop categories:');
for (const k of topCategories) {
  const s = byCategory[k];
  console.log(`  ${k}  n=${s.n}  cvr%=${(s.avgCvr * 100).toFixed(2)}  rev/post=¥${fmt(s.avgRevenue)}  score=${s.score.toFixed(2)}`);
}
if (competitors.length > 0) {
  console.log(`\nCompetitor benchmark (${competitors.length} tracked):`);
  for (const [niche, b] of Object.entries(benchmark.byNiche)) {
    console.log(`  ${niche}  n=${b.n}  medianViews=${fmt(b.medianViews)}  medianSave%=${(b.medianSaveRate * 100).toFixed(2)}  topBgm="${b.topBgm}"`);
  }
}

console.log('\nRecommendations:');
for (const r of [...recs, ...gapRecs]) console.log(`  • ${r}`);

// ─────────────────────────────────────────

function baseline() {
  return {
    updatedAt: new Date().toISOString(),
    basedOn: 0,
    windowDays: 0,
    byHookFormula: {},
    byCategory: {},
    byVideoType: {},
    byPlatform: {},
    // Cold-start defaults derived from research/docs (hook-formulas.md F06/F07/F09 are evidence-backed FOMO).
    topHooks: ['F06', 'F09', 'F07'],
    topCategories: ['books', 'stationery'],
    topVideoTypes: ['ranking', 'story'],
    recommendations: [
      'No posts logged yet — using cold-start defaults from research/docs.',
      'Log first 3-5 posts with scripts/log-post.mjs then re-run learn.',
    ],
  };
}

function groupAndScore(posts, keyFn) {
  const groups = {};
  for (const p of posts) {
    const k = keyFn(p);
    if (!k) continue;
    (groups[k] ||= []).push(p);
  }
  const out = {};
  for (const [k, arr] of Object.entries(groups)) {
    const n = arr.length;
    const sum = (sel) => arr.reduce((a, p) => a + sel(p), 0);
    const safeRate = (numer, denom) => denom > 0 ? numer / denom : 0;

    const avgViews = sum(p => p.metrics.views) / n;
    const avgSaveRate = sum(p => safeRate(p.metrics.saves, p.metrics.views)) / n;
    const avgCtr = sum(p => safeRate(p.metrics.linkClicks, p.metrics.views)) / n;
    const avgCvr = sum(p => safeRate(p.metrics.purchases, Math.max(p.metrics.linkClicks, 1))) / n;
    const avgRevenue = sum(p => p.metrics.revenueJpy) / n;
    const totalRevenue = sum(p => p.metrics.revenueJpy);

    // Composite: normalized save × ctr × cvr × revenue contribution.
    // Save rate is the strongest TikTok-algo signal; CVR captures monetization.
    const score = (avgSaveRate * 100) * (avgCtr * 100) * (avgCvr * 10) + Math.log10(totalRevenue + 1);

    out[k] = {
      n,
      avgViews: Math.round(avgViews),
      avgSaveRate: round4(avgSaveRate),
      avgCtr: round4(avgCtr),
      avgCvr: round4(avgCvr),
      avgRevenue: Math.round(avgRevenue),
      totalRevenue: Math.round(totalRevenue),
      score: round4(score),
    };
  }
  return out;
}

function sortedKeys(obj) {
  return Object.keys(obj).sort((a, b) => obj[b].score - obj[a].score);
}

function buildRecommendations({ byFormula, byCategory, byVideoType, topHooks, topCategories, topVideoTypes, posts }) {
  const recs = [];
  if (topHooks[0]) {
    const f = byFormula[topHooks[0]];
    recs.push(`${topHooks[0]} が score top (save%=${(f.avgSaveRate * 100).toFixed(2)}, cvr%=${(f.avgCvr * 100).toFixed(2)}) → 来週も主軸で固定`);
  }
  if (topHooks[1] && topHooks[2]) {
    recs.push(`次点 ${topHooks[1]}, ${topHooks[2]} を A/B/C のサブ候補で回す`);
  }
  if (topCategories[0]) {
    const c = byCategory[topCategories[0]];
    recs.push(`カテゴリ「${topCategories[0]}」が rev/post=¥${Math.round(c.avgRevenue)} top → 来週候補に必ず2つ以上`);
  }
  if (topVideoTypes[0] && topVideoTypes[1]) {
    const top = byVideoType[topVideoTypes[0]];
    const second = byVideoType[topVideoTypes[1]];
    const ratio = (top.score / Math.max(second.score, 0.001)).toFixed(2);
    if (Number(ratio) > 1.5) {
      recs.push(`${topVideoTypes[0]} type が ${topVideoTypes[1]} の ${ratio}x → 投入比率 7:3 推奨`);
    }
  }
  const losers = Object.entries(byFormula).filter(([, s]) => s.n >= 2 && s.avgSaveRate < 0.005);
  if (losers.length) {
    recs.push(`save%<0.5% の死に formula: ${losers.map(([k]) => k).join(', ')} → 当面除外`);
  }
  const totalRev = posts.reduce((a, p) => a + p.metrics.revenueJpy, 0);
  const winners = posts.filter(p => p.metrics.purchases > 0).length;
  if (posts.length >= 3) {
    recs.push(`累計 ${posts.length}本 / 売上 ¥${totalRev.toLocaleString()} / 売上発生 ${winners}本 (${Math.round(winners / posts.length * 100)}%)`);
  }
  return recs;
}

function daysSpan(posts) {
  if (posts.length === 0) return 0;
  const ts = posts.map(p => new Date(p.postedAt).getTime()).sort();
  return Math.round((ts[ts.length - 1] - ts[0]) / 86400000);
}

function round4(n) { return Math.round(n * 10000) / 10000; }
function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

function competitorBenchmark(competitors) {
  if (competitors.length === 0) {
    return { total: 0, byNiche: {}, overall: null };
  }
  const byNiche = {};
  for (const c of competitors) {
    const k = c.niche || 'unknown';
    (byNiche[k] ||= []).push(c);
  }
  const out = { total: competitors.length, byNiche: {}, overall: nicheStats(competitors) };
  for (const [k, arr] of Object.entries(byNiche)) {
    out.byNiche[k] = nicheStats(arr);
  }
  return out;
}

function nicheStats(arr) {
  const views = arr.map(c => c.metrics.views || 0).sort((a, b) => a - b);
  const saves = arr.map(c => safeRate(c.metrics.saves, c.metrics.views)).sort((a, b) => a - b);
  const likes = arr.map(c => safeRate(c.metrics.likes, c.metrics.views)).sort((a, b) => a - b);
  const shares = arr.map(c => safeRate(c.metrics.shares, c.metrics.views)).sort((a, b) => a - b);
  const bgmCount = {};
  for (const c of arr) {
    const b = (c.bgm || 'unknown').replace(/^original sound - .*/i, 'original sound');
    bgmCount[b] = (bgmCount[b] || 0) + 1;
  }
  const topBgm = Object.entries(bgmCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  const types = arr.reduce((a, c) => (a[c.type || 'video'] = (a[c.type || 'video'] || 0) + 1, a), {});
  return {
    n: arr.length,
    medianViews: median(views),
    medianSaveRate: round4(median(saves)),
    medianLikeRate: round4(median(likes)),
    medianShareRate: round4(median(shares)),
    types,
    topBgm,
  };
}

function safeRate(n, d) { return d > 0 ? n / d : 0; }

function median(arr) {
  if (arr.length === 0) return 0;
  const m = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
}

function competitorGapRecs(posts, benchmark) {
  if (benchmark.total === 0 || posts.length === 0) return [];
  const recs = [];
  const ourSave = posts.reduce((a, p) => a + safeRate(p.metrics.saves, p.metrics.views), 0) / posts.length;
  const compSave = benchmark.overall.medianSaveRate;
  if (compSave > 0 && ourSave < compSave * 0.5) {
    recs.push(`save率: 自分 ${(ourSave * 100).toFixed(2)}% vs 競合中央値 ${(compSave * 100).toFixed(2)}% → ${(compSave / Math.max(ourSave, 0.0001)).toFixed(1)}x の差。「保存させる理由」(リスト・まとめ・チェックリスト) を増やす`);
  } else if (compSave > 0 && ourSave > compSave * 1.5) {
    recs.push(`save率は競合超え ${(ourSave * 100).toFixed(2)}% (中央値 ${(compSave * 100).toFixed(2)}%) → 今の構成を継続`);
  }
  const ourViews = posts.reduce((a, p) => a + p.metrics.views, 0) / posts.length;
  const compViews = benchmark.overall.medianViews;
  if (compViews > 0 && ourViews < compViews * 0.2) {
    recs.push(`再生数: 自分 ${fmt(ourViews)} vs 競合中央値 ${fmt(compViews)} → ${(compViews / Math.max(ourViews, 1)).toFixed(1)}x の差。フック完走率を優先、BGM をトレンドに変える`);
  }
  // BGM strategy hint
  const oss = Object.values(benchmark.byNiche).filter(b => /original sound/i.test(b.topBgm)).length;
  if (oss > Object.keys(benchmark.byNiche).length / 2) {
    recs.push(`競合の過半数が "original sound" (自前音源) を採用 → トレンド音源に頼らず音声 + BGM 焼込で差別化可能`);
  }
  return recs;
}
