// 건축공사 공기산정 시스템 매뉴얼 화면 캡처 — usage: node capture_air.js <repoDir> <outDir>
// 규격: 1440×900 · DSF 1.25 · _marks.json(번호 배지 % 좌표) · _example.json(예제 검증값)
const {chromium}=require(process.env.MM_PW||'playwright');const fs=require('fs');const path=require('path');const {setup,server}=require('./serve');
const repo=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
const VW=1440,VH=900,DSF=1.25,PORT=8897;
/* 예제 A = 앱 초기값 + 착공 2027-03-02: 전주(146) · 일반건물 · 공사비 50억원 · 지상 5층/지하 1층 · 연면적 4,000㎡ · 철근콘크리트공사 기상조건 · 기타 건축물 산정공식
   예제 B = 공동주택: 서울(108) · 공사비 300억원 · 지상 15층/지하 2층 · 연면적 25,000㎡ · 착공 2027-04-01 */
const FREEZE=`(()=>{const T=new Date(2026,9,12,10,0,0).getTime();const D=Date;class F extends D{constructor(...a){if(a.length)super(...a);else super(T);}static now(){return T;}}window.Date=F;window.alert=()=>{};window.confirm=()=>true;try{localStorage.clear();sessionStorage.setItem('ib-dismissed','1')}catch(e){}})()`;
const HELP=`window.__vis=e=>e&&e.getClientRects().length>0;
window.__card=(t)=>{const h=[...document.querySelectorAll('.card-title')].find(e=>__vis(e)&&e.textContent.trim()===t);return h?h.closest('.card'):null;};
window.__find=(sel)=>{
 if(sel.startsWith('card:'))return __card(sel.slice(5));
 if(sel.startsWith('lc:'))return [...document.querySelectorAll('#tab-legal .legal-card')].filter(__vis)[+sel.slice(3)]||null;
 if(sel.startsWith('bst:'))return document.querySelectorAll('.bs-tab')[+sel.slice(4)]||null;
 for(const s of sel.split(',')){const e=[...document.querySelectorAll(s)].find(__vis);if(e)return e;}return null;};
window.__go=n=>{S.step=n;renderProg();renderStep();window.scrollTo(0,0);};
window.__A=()=>{S.proj={name:'만민 건축사 전주 신사옥 건립공사',type:'general',cost:50,fa:5,fb:1,area:4000,startDate:'2027-03-02',safetyPlan:false,stn:'146',preset:'rc',conds:[4,8,12,5,0],use:'etc'};S.prep.manual=false;S.cleanup.manual=false;S.work.custom=[];refresh();switchTab('input');__go(1);};
window.__B=()=>{S.proj={name:'만민 공동주택 신축공사',type:'apartment',cost:300,fa:15,fb:2,area:25000,startDate:'2027-04-01',safetyPlan:false,stn:'108',preset:'rc',conds:[4,8,12,5,0],use:'etc'};S.prep.manual=false;S.cleanup.manual=false;S.work.custom=[];refresh();switchTab('input');__go(1);};
window.__ex=()=>{const v=standardFormula(S.proj);return {proj:JSON.parse(JSON.stringify(S.proj)),prep:S.prep.days,work:S.work.total,nw:S.nw.total,clean:S.cleanup.days,tot:totalDays(),
  items:S.work.items.map(i=>[i.name,i.days]),months:S.nw.months.map(m=>[m.label,m.A,m.B,m.C,m.raw,m.nw,m.wk,m.used,m.appNW]),
  val:v?{name:v.F.name,f:v.F.f,out:v.out,Y:v.Y,std:v.std,calc:v.calc,dev:v.dev}:null,end:fmtDate(addDays(S.proj.startDate,totalDays()))};};`;
const N=(i,s)=>`#stepContent ${s}`;
const SHOTS=[
 {id:'s01_overview',pre:"__A()",clip:'viewport',m:[['.tab-bar-inner','작업 탭'],['.sum-bar-wrap','요약 스트립'],['#stepProg','단계 표시'],['card:공사 기본 정보','공사 기본 정보'],['card:기상 관측 지점','기상 관측 지점'],['#fab-group','계산방법 안내']]},
 {id:'s02_tabs',clip:'.app-header',union:'.tab-bar',m:[['.tb:nth-of-type(1)','입력·산출'],['.tb:nth-of-type(2)','A4 미리보기'],['.tb:nth-of-type(3)','법적근거'],['.tb-manual','매뉴얼'],['.hdr-right','근거 고시·가이드라인']]},
 {id:'s03_basic',clip:'card:공사 기본 정보',m:[['#iName','공사명'],['#iDate','착공 예정일'],['#iCost','총 공사비']]},
 {id:'s04_station',clip:'card:기상 관측 지점',m:[['#iStn','관측 지점']]},
 {id:'s05_type',clip:'card:공사 유형',m:[['.opt-card.sel','일반건물'],['.opt-grid .opt-card:nth-child(2)','공동주택 45일'],['.opt-grid .opt-card:nth-child(3)','고속도로공사 180일']]},
 {id:'s06_bldg',clip:'card:건물 규모',m:[['#iFA','지상 층수'],['#iFB','지하 층수'],['input[name=sp]','안전관리계획서'],['#iArea','연면적'],['#iUse','건축물 유형']]},
 {id:'s07_prep',pre:"__go(2)",clip:'card:준비기간 산정',union:'card:정리기간',m:[['#iPrep','준비기간 조정'],['#stepContent .legal-ref','근거 — 일반건물 참고값'],['#iClean','정리기간'],['#stepContent .card:nth-child(2) .legal-ref','근거 — 준공 전 1개월']]},
 {id:'s08_work',pre:"__go(3)",clip:'card:공종별 작업일수',m:[['#stepContent .alert-info','MANMIN 참고값 안내'],['#stepContent .tbl .cat-row','공종 묶음'],['#stepContent .tbl .stepper','일수 조정'],['#stepContent .tbl .sum-row','총 작업일수']]},
 {id:'s09_nwset',pre:"__go(4)",clip:'#stepContent .formula',union:'#stepContent .cond-grid',m:[['#stepContent .formula','A + B − C'],['#stepContent .frow .fgroup:nth-child(1) select','기상조건 묶음'],['#stepContent .frow .fgroup:nth-child(2) select','관측 지점'],['#stepContent .cond-grid','기상조건 13종']]},
 {id:'s10_nwtable',clip:'#stepContent .nw-tbl',m:[['#stepContent .nw-tbl tbody tr:nth-child(1)','첫 달 — 착수일 이후'],['#stepContent .nw-tbl tbody tr:nth-child(5)','7월 — 혹서기'],['#stepContent .nw-tbl tbody tr:nth-child(9)','11월 — 8일 적용'],['#stepContent .nw-tbl tr.sum-row','합계']]},
 {id:'s11_result',pre:"__go(5)",clip:'#stepContent .result-hero',union:'#stepContent .res-grid',m:[['#stepContent .rh-num','총 공사기간'],['#stepContent .rh-dates','착공 → 준공'],['#stepContent .res-item:nth-child(1)','준비기간'],['#stepContent .res-item:nth-child(2)','작업일수'],['#stepContent .res-item:nth-child(3)','비작업일수'],['#stepContent .res-item:nth-child(4)','정리기간']]},
 {id:'s12_compare',clip:'card:산정공식과 비교',m:[['#stepContent .tbl tr:nth-child(1)','산정공식'],['#stepContent .tbl tr:nth-child(2)','Y + 준비 + 정리'],['#stepContent .tbl tr:nth-child(3)','산정한 공사기간'],['#stepContent .tbl tr:nth-child(4)','차이']]},
 {id:'s13_spec',clip:'card:공사기간 산정근거 명세서',m:[['#stepContent .sumlist li:nth-child(1)','근거'],['#stepContent .sumlist li:nth-child(6)','기상 관측 지점'],['#stepContent .sumlist li:nth-child(13)','최종 공사기간'],['#stepContent .btn-blue','A4 미리보기']]},
 {id:'s14_a4',pre:"switchTab('a4');scrollTo(0,0)",wait:1200,clip:'viewport',m:[['.mm-btn-print','인쇄 / PDF 저장'],['#btn-jpg','JPG 저장'],['#a4-page','A4 근거서']]},
 {id:'s15_a4page',clip:'#a4-page',m:[['#a4-content .a4-section:nth-child(2)','01 공사 개요'],['#a4-content .a4-section:nth-child(3)','02 결과 요약'],['#a4-content .a4-section:nth-child(4)','03 간트'],['#a4-content .a4-section:nth-child(5)','04 공종별 작업일수'],['#a4-content .a4-section:nth-child(6)','05 비작업일수 내역'],['#a4-content .a4-section:nth-child(7)','06 산정공식 비교'],['#a4-content .a4-section:nth-child(8)','07 법적 근거']]},
 {id:'s16_legal',pre:"switchTab('legal');scrollTo(0,0)",wait:900,clip:'#tab-legal',m:[['lc:0','건설기술 진흥법 제45조의2'],['lc:1','고시 제2024-1021호'],['lc:2','2026년 가이드라인'],['lc:3','적정성 심의'],['lc:4','값의 출처']]},
 {id:'s17_help_howto',pre:"switchTab('input');openCalcGuide()",wait:1500,fixed:true,clip:'#calcModal',m:[['bst:0','이용방법'],['bst:1','전체 흐름'],['bst:2','준비기간'],['bst:3','작업일수'],['bst:4','비작업일수'],['bst:5','산정공식 비교'],['bst:6','기상조건']]},
 {id:'s18_help_prep',pre:"switchMTab('m_prep',document.querySelectorAll('.bs-tab')[2]);document.getElementById('bsBody').scrollTop=0",wait:1200,fixed:true,clip:'#calcModal',m:[]},
 {id:'s19_help_nw',pre:"switchMTab('m_nw',document.querySelectorAll('.bs-tab')[4]);document.getElementById('bsBody').scrollTop=0",wait:1200,fixed:true,clip:'#calcModal',m:[]},
 {id:'s20_help_verify',pre:"switchMTab('m_verify',document.querySelectorAll('.bs-tab')[5]);document.getElementById('bsBody').scrollTop=0",wait:1200,fixed:true,clip:'#calcModal',m:[]},
 {id:'s21_help_weather',pre:"switchMTab('m_weather',document.querySelectorAll('.bs-tab')[6]);document.getElementById('bsBody').scrollTop=0",wait:1200,fixed:true,post:"closeCalcGuide()",clip:'#calcModal',m:[]},
 {id:'s22_var_input',pre:"__B()",clip:'card:공사 유형',union:'card:건물 규모',m:[['.opt-card.sel','공동주택 — 준비 45일'],['#iFA','지상 15층'],['#iFB','지하 2층'],['#iArea','연면적']]},
 {id:'s23_var_nw',pre:"__go(4)",clip:'#stepContent .nw-tbl',m:[['#stepContent .nw-tbl tbody tr:nth-child(4)','7월 — 서울 혹서기'],['#stepContent .nw-tbl tr.sum-row','합계']]},
 {id:'s24_var_result',pre:"__go(5)",clip:'#stepContent .result-hero',union:'card:산정공식과 비교',m:[['#stepContent .rh-num','총 공사기간'],['#stepContent .tbl tr:nth-child(1)','공동주택 산정공식'],['#stepContent .tbl tr:nth-child(4)','차이']]},
 {id:'s25_var_a4page',pre:"switchTab('a4');scrollTo(0,0)",wait:1200,clip:'#a4-page',post:"__A()",m:[]},
];
(async()=>{
 const s=await server(repo,PORT);const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:VW,height:VH},deviceScaleFactor:DSF,serviceWorkers:'block'});await setup(ctx);
 const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(FREEZE);
 await pg.goto(`http://127.0.0.1:${PORT}/index.html`);await pg.evaluate(()=>document.fonts.ready);await pg.waitForTimeout(3000);
 await pg.addStyleTag({content:'#installBanner,#updateBanner{display:none!important}.bs-sheet:not(.open){display:none!important}'});
 await pg.evaluate(HELP);
 const ex={};const meta={};
 for(const S of SHOTS){
  if(S.pre){try{await pg.evaluate(S.pre);}catch(e){errs.push(S.id+' pre '+e.message);}}
  await pg.waitForTimeout(S.wait||700);
  if(S.id==='s01_overview')ex.A=await pg.evaluate('__ex()');
  if(S.id==='s22_var_input')ex.B=await pg.evaluate('__ex()');
  if(S.id==='s15_a4page')ex.A_a4=await pg.evaluate(()=>document.getElementById('a4-content').innerText.replace(/\s+/g,' '));
  const info=await pg.evaluate(({S,VW,VH})=>{
   const abs=e=>{const r=e.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height};};
   let clip;
   if(S.clip==='viewport'){clip={x:0,y:scrollY,width:VW,height:VH};}
   else{const el=__find(S.clip);if(!el)return {err:'clip '+S.clip};const a=abs(el);clip={x:a.x,y:a.y,width:a.w,height:a.h};
     if(S.union){const e2=__find(S.union);if(e2){const a2=abs(e2);const x0=Math.min(clip.x,a2.x),y0=Math.min(clip.y,a2.y),x1=Math.max(clip.x+clip.width,a2.x+a2.w),y1=Math.max(clip.y+clip.height,a2.y+a2.h);clip={x:x0,y:y0,width:x1-x0,height:y1-y0};}}
     const P=12;clip={x:Math.max(0,clip.x-P),y:Math.max(0,clip.y-P),width:clip.width+2*P,height:clip.height+2*P};}
   const marks=[];(S.m||[]).forEach(([sel,label],i)=>{const e=__find(sel);if(!e){marks.push({n:i+1,label,miss:sel});return;}const a=abs(e);
     marks.push({n:i+1,label,x:+((a.x-clip.x)/clip.width*100).toFixed(2),y:+((a.y-clip.y)/clip.height*100).toFixed(2),w:+(Math.min(a.w,clip.x+clip.width-a.x)/clip.width*100).toFixed(2),h:+(Math.min(a.h,clip.y+clip.height-a.y)/clip.height*100).toFixed(2)});});
   return {clip,marks};},{S,VW,VH});
  if(info.err){errs.push(S.id+' '+info.err);continue;}
  const c=info.clip;const cl={x:Math.max(0,c.x),y:Math.max(0,c.y),width:Math.min(c.width,VW-Math.max(0,c.x)),height:c.height};
  if(S.clip==='viewport'){await pg.screenshot({path:path.join(out,S.id+'.png'),clip:{x:0,y:0,width:VW,height:VH}});}
  else if(S.fixed){const sx=await pg.evaluate(()=>scrollX),sy=await pg.evaluate(()=>scrollY);await pg.screenshot({path:path.join(out,S.id+'.png'),clip:{x:c.x-sx,y:c.y-sy,width:Math.min(c.width,VW),height:Math.min(c.height,VH)}});}
  else{await pg.screenshot({path:path.join(out,S.id+'.png'),clip:cl,fullPage:true});}
  meta[S.id]={w:Math.round(cl.width),h:Math.round(Math.min(cl.height,S.fixed?VH:1e9)),marks:info.marks};
  if(S.post){try{await pg.evaluate(S.post);}catch(e){errs.push(S.id+' post '+e.message);}await pg.waitForTimeout(500);}
 }
 ex.after=await pg.evaluate('__ex()');
 const mctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block',isMobile:true,hasTouch:true});await setup(mctx);
 const mp=await mctx.newPage();await mp.addInitScript(FREEZE);
 await mp.goto(`http://127.0.0.1:${PORT}/index.html`);await mp.waitForTimeout(3000);
 await mp.addStyleTag({content:'#installBanner,#updateBanner{display:none!important}.bs-sheet:not(.open){display:none!important}'});await mp.evaluate(HELP);await mp.evaluate('__A()');await mp.waitForTimeout(600);
 await mp.screenshot({path:path.join(out,'s26_mobile_main.png')});meta['s26_mobile_main']={w:390,h:844,marks:[]};
 await mp.evaluate(()=>{__go(4);const t=document.querySelector('#stepContent .nw-tbl');window.scrollTo(0,t.getBoundingClientRect().top+scrollY-260);});await mp.waitForTimeout(700);
 await mp.screenshot({path:path.join(out,'s27_mobile_nw.png')});meta['s27_mobile_nw']={w:390,h:844,marks:[]};
 await mp.evaluate(()=>{switchTab('a4');window.scrollTo(0,0);});await mp.waitForTimeout(1200);
 await mp.screenshot({path:path.join(out,'s28_mobile_a4.png')});meta['s28_mobile_a4']={w:390,h:844,marks:[]};
 fs.writeFileSync(path.join(out,'_marks.json'),JSON.stringify(meta,null,1));fs.writeFileSync(path.join(out,'_example.json'),JSON.stringify(ex,null,1));
 const miss=[];Object.entries(meta).forEach(([k,v])=>v.marks.forEach(m=>{if(m.miss)miss.push(k+':'+m.miss);else if(m.x<0||m.y<0||m.x+m.w>100.5||m.y+m.h>100.5)miss.push(k+':OUT '+m.label+' '+m.x+','+m.y+','+m.w+','+m.h);}));
 console.log(JSON.stringify({A:{prep:ex.A.prep,work:ex.A.work,nw:ex.A.nw,clean:ex.A.clean,tot:ex.A.tot,val:ex.A.val,end:ex.A.end},B:{prep:ex.B.prep,work:ex.B.work,nw:ex.B.nw,clean:ex.B.clean,tot:ex.B.tot,val:ex.B.val,end:ex.B.end},same:JSON.stringify(ex.A)===JSON.stringify(ex.after),miss,errs:errs.slice(0,15)},null,1));
 await b.close();s.close();
})();
