#!/usr/bin/env python3
"""Fetch Google Trends interest for keywords (last 7 days, Japan).

Usage:
    python research/fetch-trends.py 自己啓発 集中力 朝活 副業

Requires: pip install pytrends
"""
import json
import sys
import time
from pathlib import Path
from datetime import datetime

try:
    from pytrends.request import TrendReq
except ImportError:
    print("pytrends not installed. Run: pip install pytrends", file=sys.stderr)
    sys.exit(1)

keywords = sys.argv[1:] or ['自己啓発', '集中力', '朝活', '副業', '習慣化']
keywords = keywords[:5]  # pytrends caps at 5 per query

print(f"[trends] Fetching for: {keywords}", file=sys.stderr)

try:
    pytrends = TrendReq(hl='ja-JP', tz=540)
    pytrends.build_payload(keywords, timeframe='now 7-d', geo='JP')
    time.sleep(2)  # politeness
    df = pytrends.interest_over_time()
except Exception as e:
    print(f"[trends] Error fetching: {e}", file=sys.stderr)
    print("[trends] Google may have rate-limited. Try again in ~10 minutes.", file=sys.stderr)
    sys.exit(2)

result = {
    'fetchedAt': datetime.now().isoformat(),
    'timeframe': 'now 7-d',
    'geo': 'JP',
    'keywords': {},
}

for k in keywords:
    if k in df.columns:
        series = df[k]
        result['keywords'][k] = {
            'recent_avg': round(float(series.tail(24).mean()), 2),
            'peak': int(series.max()),
            'momentum': round(float(series.tail(24).mean()) / max(1, int(series.max())) * 100, 1),
        }

out_dir = Path('research/data')
out_dir.mkdir(parents=True, exist_ok=True)
out_path = out_dir / f"trends-{datetime.now().strftime('%Y%m%d')}.json"
out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')

print(json.dumps(result, ensure_ascii=False, indent=2))
print(f"\nSaved to {out_path}", file=sys.stderr)
