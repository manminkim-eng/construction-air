# 공기산정 v5.1.0 계산 검증 — 앱(브라우저 실행) vs 파이썬 독립 구현 · 가이드라인 예시 재현
# usage: python3 verify_air_calc.py <repo>   (playwright 필요)
import sys, json, random, calendar, asyncio, os
from playwright.async_api import async_playwright
REPO = os.path.abspath(sys.argv[1]); HERE = os.path.dirname(os.path.abspath(__file__))
AX = json.load(open(os.path.join(HERE, '_appx3.json'), encoding='utf-8')); ST = {s['code']: s for s in AX['stations']}
HOL = {2026:[5,7,6,4,7,5,4,7,7,7,5,5],2027:[6,7,5,4,7,4,4,6,7,8,4,6],2028:[9,4,5,5,6,5,5,5,4,10,4,6],2029:[5,7,5,5,7,5,5,5,8,6,4,6],2030:[5,7,6,4,6,6,4,5,8,6,4,6],2031:[8,4,7,4,6,6,4,6,5,8,5,5],2032:[5,8,5,4,7,4,4,6,7,8,4,6],2033:[7,6,5,4,7,5,5,5,7,7,4,5],2034:[5,7,5,5,6,5,5,5,7,7,4,6],2035:[5,7,5,5,7,5,5,5,8,6,4,6]}
def r1(x): return float(f'{x:.10f}') and __import__('math').floor(x*10+0.5)/10 if x>=0 else -__import__('math').floor(-x*10+0.5)/10
def jsround(x): import math; return math.floor(x+0.5)
def nwd(start, prep, work, stn, conds):
    import datetime as dt
    y, m, d = map(int, start.split('-')); c = dt.date(y, m, d) + dt.timedelta(days=prep)
    yr, mo, first = c.year, c.month - 1, c.day; rem = work; tot = 0; out = []
    for _ in range(240):
        if rem <= 0: break
        dim = calendar.monthrange(yr, mo + 1)[1]
        A = r1(sum(ST[stn]['d'][k][mo] for k in conds)); hy = yr if yr in HOL else (2026 if yr < 2026 else 2035); B = HOL[hy][mo]
        C = jsround(A * B / dim); raw = r1(A + B - C); nw = max(raw, 8); wk = r1(dim - nw)
        cap = max(0, r1(wk * (dim - first + 1) / dim))
        if cap > 0:
            used = min(rem, cap); app = r1(nw * used / wk); out.append(app); tot += app; rem = r1(rem - used)
        mo += 1; first = 1
        if mo == 12: mo = 0; yr += 1
    return jsround(tot), out
async def main():
    random.seed(20261012); cases = []
    codes = list(ST)
    for i in range(400):
        cases.append(dict(start=f'{random.randint(2026,2036)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}', prep=random.choice([10,20,30,45,60,90,180]), work=random.randint(5,900),
                          stn=random.choice(codes), conds=random.sample(range(13), random.randint(0,6))))
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
        await pg.goto('file://' + REPO + '/index.html'); await pg.wait_for_timeout(800)
        res = await pg.evaluate('''cs=>cs.map(c=>{const r=calcNWD(c.start,c.prep,c.work,{stn:c.stn,conds:c.conds});return [r.total,r.months.map(m=>m.appNW)]})''', cases)
        # 가이드라인 예시: 서울 철근콘크리트공사 2026.7~2027.6 기후여건(A)
        ex = await pg.evaluate('''()=>{const s=MM_STN['108'][2],k=[4,8,12,5,0];return [6,7,8,9,10,11,0,1,2,3,4,5].map(m=>Math.round(k.reduce((a,c)=>a+s[c][m],0)*10)/10)}''')
        await b.close()
    bad = 0
    for c, (t, ms) in zip(cases, res):
        t2, ms2 = nwd(c['start'], c['prep'], c['work'], c['stn'], c['conds'])
        if t != t2 or [round(x,1) for x in ms] != [round(x,1) for x in ms2]: bad += 1; print('DIFF', c, t, t2)
    GL = [17.8, 20.5, 6.2, 3.9, 5.5, 9.0, 9.4, 6.0, 3.5, 5.8, 6.1, 6.6]
    print(f'무작위 {len(cases)}건 앱=독립구현: {"✓" if bad==0 else "✗ "+str(bad)}')
    print(f'가이드라인 예시(서울 철근콘크리트 기후여건 2026.7~2027.6) 재현: {"✓" if ex==GL else "✗ "+str(ex)}')
    sm = [sum(v) for v in HOL.values()]; print('부록1 연간 소계', sm, '✓' if sm == [69,68,68,68,67,68,68,67,67,68] else '✗')
    sys.exit(1 if bad or ex != GL else 0)
asyncio.run(main())
