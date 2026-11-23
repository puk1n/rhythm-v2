/* RHYTHM v2 — zero-dependency phone-first interface. */
(()=>{'use strict';
const C=window.RhythmCore;
const K='rhythm-shift-v2',OLD='rhythm-shift-v1';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,cls='')=>`<svg aria-hidden="true" class="icon ${cls}"><use href="#i-${name}"></use></svg>`;
const ICON={sleep:'moon',meal:'food',exercise:'activity',other:'pin',work:'clock'};
const NAME={sleep:'수면',meal:'식사',exercise:'운동',other:'개인 일정'};
const selectedDate=()=>C.today();
let state,storedOK=true,migrated=false;
try{
  const saved=localStorage.getItem(K);
  if(saved)state=C.normalize(JSON.parse(saved));
  else{
    const raw=localStorage.getItem(OLD);
    if(raw){state=C.migrateV1(JSON.parse(raw));migrated=true}
    else state=C.freshState();
  }
}catch(err){storedOK=false;state=C.freshState()}
let selected=C.today(),tab='home',monthCursor=selected.slice(0,7),routinePhase=0,statsRange='12',editing=null,focusAbs=null,sheetKind='',toastTimeout=null,endDateAuto=true;
const pad=n=>String(n).padStart(2,'0');
const timeNow=()=>{const d=new Date();return `${pad(d.getHours())}:${pad(d.getMinutes())}`};
const nowAbs=()=>C.absolute(C.today(),timeNow());
const dateLabel=s=>{const [y,m,d]=s.split('-').map(Number);return `${m}월 ${d}일 ${['일','월','화','수','목','금','토'][new Date(y,m-1,d,12).getDay()]}요일`};
const tinyDate=s=>`${Number(s.slice(5,7))}/${Number(s.slice(8))}`;
const readableHours=n=>n==null?'—':C.fmt(n);
const categoryBadge=(date)=>{const p=C.PHASES[C.cycleIndex(date,state.anchor)];return `<span class="tiny-badge ${p.kind}">${esc(p.name)}</span>`};
const phaseText=p=>p.kind==='day'?'09:00–21:00':p.kind==='night'?'21:00–익일 09:00':'근무 없음';
const generateId=()=>`r${Date.now().toString(36)}${Math.random().toString(36).slice(2,9)}`;
const save=()=>{try{localStorage.setItem(K,JSON.stringify(state));storedOK=true;return true}catch(err){storedOK=false;toast('저장 공간을 확인해 주세요. 백업 파일을 만들어 주세요.');return false}};
if(migrated){try{localStorage.setItem(K,JSON.stringify(state));storedOK=true}catch(e){storedOK=false}}
const toast=msg=>{let b=$('toast');if(!b)return;b.textContent=msg;b.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>b.classList.remove('show'),2500)};
const closeSheet=()=>{const s=$('sheet');s.classList.remove('open');s.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');sheetKind='';editing=null};
const openSheet=(body,kind)=>{const s=$('sheet');sheetKind=kind;$('sheetBody').innerHTML=body;s.classList.add('open');s.setAttribute('aria-hidden','false');document.body.classList.add('modal-open')};
const sheetHeading=(title)=>`<div class="sheet-heading"><strong class="sheet-title">${title}</strong><button class="sheet-close" type="button" data-act="close-sheet" aria-label="닫기">${icon('close')}</button></div>`;
function applyTheme(){const dark=state.theme==='dark'||state.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=dark?'dark':'light';document.querySelector('meta[name=theme-color]').content=dark?'#202121':'#f7f7f5';$('themeShortcut').innerHTML=icon(dark?'moon':'sun')}
function goDate(s){if(!C.validDate(s))return;selected=s;monthCursor=s.slice(0,7);focusAbs=null;render(true)}
function goTab(name){if(!['home','calendar','stats','routine','settings'].includes(name))return;tab=name;focusAbs=null;render(false);window.scrollTo({top:0,behavior:'instant'})}
function header(){
  $('dateDisplay').textContent=dateLabel(selected);
  $('dateEyebrow').textContent=selected===C.today()?'오늘의 일정':`${C.PHASES[C.cycleIndex(selected,state.anchor)].name} · 선택한 날짜`;
  const root=C.cycleStart(selected,state.anchor),ix=C.cycleIndex(selected,state.anchor);
  $('phaseStrip').innerHTML=C.PHASES.map((p,j)=>{const d=C.addDays(root,j);return `<button type="button" class="phase-pill ${j===ix?'selected':''}" data-act="pick-date" data-date="${d}" aria-label="${dateLabel(d)} ${p.name}" aria-current="${j===ix?'date':'false'}"><b>${p.short}</b><small>${Number(d.slice(8))}일</small></button>`}).join('');
  const active=$('phaseStrip').children[ix];if(active)$('phaseStrip').scrollLeft=Math.max(0,active.offsetLeft-$('phaseStrip').offsetLeft-$('phaseStrip').clientWidth/2+active.clientWidth/2);
  $('fab').classList.toggle('hidden',!['home','calendar'].includes(tab));
  document.querySelectorAll('.nav-item').forEach(x=>{x.classList.toggle('active',x.dataset.tab===tab);x.setAttribute('aria-current',x.dataset.tab===tab?'page':'false')});
}
function render(jump){
  const oldScroll=$('timelineScroller');const oldTop=oldScroll?.scrollTop;
  const previousRate=oldScroll?Number(oldScroll.dataset.rate):null;
  const focus=(oldScroll&&oldScroll.clientHeight&&Number.isFinite(previousRate))?Number(oldScroll.dataset.startAbs)+(oldTop+oldScroll.clientHeight/2)/previousRate:null;
  header();
  for(const name of ['home','calendar','stats','routine','settings'])$(`view-${name}`).classList.toggle('hidden',tab!==name);
  if(tab==='home'){
    $('view-home').innerHTML=renderHome();
    requestAnimationFrame(()=>{
      const sc=$('timelineScroller');if(!sc)return;
      const rate=Number(sc.dataset.rate),base=Number(sc.dataset.startAbs),target=focusAbs??(jump||!Number.isFinite(focus)?(selected===C.today()?nowAbs():C.absolute(selected,'00:00')):focus);
      sc.scrollTop=Math.max(0,(target-base)*rate-sc.clientHeight/2);
      focusAbs=null;
    });
  }else if(tab==='calendar')$('view-calendar').innerHTML=renderCalendar();
  else if(tab==='stats')$('view-stats').innerHTML=renderStats();
  else if(tab==='routine')$('view-routine').innerHTML=renderRoutine();
  else $('view-settings').innerHTML=renderSettings();
}
function upcomingSleep(date){
  const now=nowAbs();if(C.dayNum(date)<C.dayNum(C.today()))return 0;
  const all=C.eventsIn(state,C.addDays(date,-2),date).filter(e=>e.type==='sleep'&&e.status==='plan'&&C.sleepWakeDate(e)===date);
  return C.union(all.map(e=>{const st=C.absolute(e.date,e.time);return [Math.max(st,now),st+e.duration]}).filter(([x,y])=>y>x));
}
function todaySummary(){
  const actual=C.sleepMinutes(state,selected,'actual'),goal=C.sleepGoal(state,selected),future=upcomingSleep(selected),known=C.isKnown(state,selected,'sleep');
  const deficit=Math.max(0,goal-actual);
  const projected=Math.max(0,goal-actual-future);
  const p=C.PHASES[C.cycleIndex(selected,state.anchor)];
  const meals=C.actualMeal(state,selected),snacks=C.snackCount(state,selected),exercise=C.actualExercise(state,selected);
  const cyc=C.cycleStart(selected,state.anchor);
  const pill=categoryBadge(selected);
  const sleepLabel=known?C.fmt(actual):'미기록';
  const goalStatus=known?(actual>=goal?`오늘 목표를 충족했어요`:`목표까지 ${C.fmt(deficit)} 남았어요`):'실제 수면을 기록해 주세요';
  return `<div class="card">
     <div class="row"><div><div class="card-heading">오늘의 수면과 일정</div><div style="font-size:18px;font-weight:650;letter-spacing:-.045em;margin-top:4px">${esc(p.name)} <span class="sub" style="font-weight:420">${phaseText(p)}</span></div></div>${pill}</div>
     <div class="hero-stats">
       <div class="metric big"><div class="metric-label">실제로 잔 시간</div><div class="metric-value">${sleepLabel}</div><div class="metric-note">${goalStatus}</div></div>
       <div class="metric"><div class="metric-label">오늘의 목표</div><div class="metric-value">${C.fmt(goal)}</div><div class="metric-note"><button class="soft-button" type="button" data-act="day-goal" style="padding:0">날짜별 변경 ${icon('edit')}</button></div></div>
     </div>
     <div class="progress" aria-label="수면 목표 달성률"><span style="width:${Math.min(100,goal?actual/goal*100:0).toFixed(1)}%"></span></div>
     <div class="stated-line"><span class="sub">앞으로 계획된 수면</span><span>${C.fmt(future)}</span></div>
     <div class="stated-line"><span class="sub">계획대로 잘 경우</span><span>${projected?`${C.fmt(projected)} 부족`:'목표 달성 가능'}</span></div>
     <div class="divider"></div>
     <div class="row"><span class="sub">식사 <strong style="color:var(--ink)">${C.isKnown(state,selected,'meal')?meals+'회':'미기록'}</strong> / 목표 ${state.mealGoal}회${snacks?` · 간식 ${snacks}회`:''}</span><span class="sub">운동 <strong style="color:var(--ink)">${C.isKnown(state,selected,'exercise')?exercise.count+'회':'미기록'}</strong></span></div>
     <div class="fast-actions chips" style="margin-top:15px">
       <button class="chip" data-act="sleep-timer">${icon(state.runningSleep?'stop':'play')}${state.runningSleep?'수면 종료':'수면 시작'}</button>
       <button class="chip" data-act="new" data-type="sleep" data-status="actual">${icon('moon')}수면 기록</button>
       <button class="chip" data-act="new" data-type="meal" data-status="actual">${icon('food')}식사 기록</button>
       <button class="chip" data-act="review">${icon('check')}하루 확인</button>
     </div>
     ${state.runningSleep?`<div class="notice-card" style="margin-top:13px">${icon('moon')} 수면 기록 중 · <span id="sleepTimerValue">계산 중</span></div>`:''}
   </div>
   <div class="section-header"><h2 class="section-title">12일 근무 루틴</h2><span class="sub">${tinyDate(cyc)}–${tinyDate(C.addDays(cyc,11))}</span></div>
   <div class="quiet-note">이 루틴의 수면·식사·운동 통계는 다음 12일로 이월되지 않아요. ${C.PHASES[C.cycleIndex(selected,state.anchor)].kind==='night'?'야간근무는 다음 날 오전 9시까지 이어집니다.':''}</div>`;
}
function timelineData(){
  const first=C.addDays(selected,-1),last=C.addDays(selected,1);
  const minAbs=C.absolute(first,'12:00'),maxAbs=minAbs+48*60,rate=[.57,.98,1.45][state.scale];
  const user=C.eventsIn(state,C.addDays(selected,-2),C.addDays(selected,2)).filter(e=>{const a=C.absolute(e.date,e.time);return a<maxAbs&&a+e.duration>minAbs});
  const work=C.workEvents(state,C.addDays(selected,-1),C.addDays(selected,2)).filter(e=>{const a=C.absolute(e.date,e.time);return a<maxAbs&&a+e.duration>minAbs});
  const px=min=>Math.round(min*rate*10)/10;
  let grid='',blocks='',free='';
  for(let h=0;h<=48;h++){
    const n=minAbs+h*60,stamp=C.atAbs(n),mid=stamp.time==='00:00';
    grid+=`<div class="time-line ${mid?'midnight':''}" style="top:${px(h*60)}px"><span>${stamp.time}</span></div>`;
    if(mid)grid+=`<span class="time-date" style="top:${px(h*60)}px">${Number(stamp.date.slice(5,7))}월 ${Number(stamp.date.slice(8))}일</span>`;
  }
  const visible=e=>{const st=C.absolute(e.date,e.time),en=st+e.duration;return {st:Math.max(st,minAbs),en:Math.min(en,maxAbs)}};
  work.forEach(e=>{const v=visible(e);blocks+=`<div class="block work" style="top:${px(v.st-minAbs)}px;height:${Math.max(5,px(v.en-v.st)-2)}px;left:3px;width:calc(100% - 8px)" aria-label="${e.title}"><span class="block-name">${e.title}</span><small>${e.time}–${C.atAbs(C.absolute(e.date,e.time)+e.duration).time}</small></div>`});
  const sorted=user.map(e=>({...e,_visible:visible(e)})).sort((a,b)=>a._visible.st-b._visible.st||b._visible.en-a._visible.en);
  const lanes=[];for(const e of sorted){let track=lanes.findIndex(end=>end<=e._visible.st);if(track<0){track=lanes.length;lanes.push(0)}lanes[track]=e._visible.en;e._lane=track}
  for(const e of sorted){
    const v=e._visible,dur=v.en-v.st;if(dur<=0)continue;
    let maxConcurrent=1;
    for(const x of sorted){if(x===e)continue;if(x._visible.st<v.en&&v.st<x._visible.en)maxConcurrent=Math.max(maxConcurrent,x._lane+1,e._lane+1)}
    const cols=Math.min(3,maxConcurrent);let lane=e._lane%cols;
    const left=`calc(${(lane/cols*100).toFixed(2)}% + 3px)`,width=`calc(${(100/cols).toFixed(2)}% - 6px)`;
    const h=Math.max(7,px(dur)-2),f=e.status==='actual'?'actual':e.done===true?'done':e.done===false?'skip':'plan';
    blocks+=`<button class="block ${e.type} ${f}" type="button" data-act="edit" data-id="${esc(e.id)}" style="top:${px(v.st-minAbs)+1}px;height:${h}px;left:${left};width:${width}" title="${esc(e.title)}"><span class="block-name">${esc(e.title||NAME[e.type])}</span>${h>=33?`<small>${e.time} · ${C.fmt(e.duration)}</small>`:''}</button>`;
  }
  for(const [a,b] of C.freeGaps(state,minAbs,maxAbs)){
    const duration=b-a,h=px(duration);if(duration<90||h<24)continue;
    free+=`<button class="free-slot" type="button" data-act="free-add" data-start="${a}" style="top:${px(a-minAbs)+2}px;height:${h-5}px" title="빈 시간에 일정 추가">여유 ${C.fmt(duration)}</button>`;
  }
  const live=selected===C.today();const now=nowAbs();const pos=now>=minAbs&&now<=maxAbs?`<div id="nowLine" class="now-line" style="top:${px(now-minAbs)}px"><span class="now-label">현재</span></div>`:'';
  return {html:`<div class="timeline-scroll" id="timelineScroller" data-start-abs="${minAbs}" data-rate="${rate}"><div class="timeline-content" style="height:${px(48*60)}px">${grid}${free}${blocks}${pos}</div></div>`,rate,minAbs};
}
function dailyActivities(){
  const begin=C.absolute(selected,'00:00'),end=begin+1440;
  const items=C.eventsIn(state,C.addDays(selected,-2),C.addDays(selected,1)).filter(e=>{const a=C.absolute(e.date,e.time);return a<end&&a+e.duration>begin}).sort((a,b)=>C.absolute(a.date,a.time)-C.absolute(b.date,b.time));
  if(!items.length)return '<div class="empty">아직 등록한 일정이 없어요. 아래 + 버튼으로 추가해 보세요.</div>';
  return `<div class="activity-list">${items.map(e=>{
    const end=C.atAbs(C.absolute(e.date,e.time)+e.duration);
    const status=e.status==='actual'?'실제 기록':e.type==='sleep'?'수면 계획':e.done===true?'완료':e.done===false?'미완료':'계획';
    return `<button class="activity-line" type="button" data-act="edit" data-id="${esc(e.id)}"><span class="activity-icon ${e.type}">${icon(ICON[e.type])}</span><span class="activity-body"><div class="activity-name">${esc(e.title)}</div><div class="activity-detail">${tinyDate(e.date)} ${e.time} → ${tinyDate(end.date)} ${end.time} · ${C.fmt(e.duration)}</div></span><span class="activity-tail">${status} ${icon('chevron-right')}</span></button>`;
  }).join('')}</div>`;
}
function renderHome(){
  const t=timelineData();
  return `${todaySummary()}
  <div class="section-header"><h2 class="section-title">48시간 타임라인</h2><span class="sub">전날 12h · 오늘 24h · 다음 날 12h</span></div>
  <div class="card timeline-card"><div class="timeline-toolbar"><span class="micro">일정을 눌러 수정하세요</span><div class="timeline-tools"><button class="tool-btn" data-act="zoom" data-value="-1" aria-label="축소">${icon('minus')}</button><span class="tiny-badge">${['축소','기본','확대'][state.scale]}</span><button class="tool-btn" data-act="zoom" data-value="1" aria-label="확대">${icon('plus')}</button><button class="tool-btn" data-act="jump-now">${icon('clock')} ${selected===C.today()?'지금':'00시'}</button></div></div>
  <div class="timeline-legend"><span><i class="legend-dot" style="background:var(--work)"></i>근무</span><span><i class="legend-dot" style="background:var(--sleep)"></i>수면</span><span><i class="legend-dot" style="background:var(--meal)"></i>식사</span><span><i class="legend-dot" style="background:var(--exercise)"></i>운동</span><span>점선: 계획</span></div>${t.html}
  <div class="micro" style="margin-top:11px">일정이 없는 구간은 여유 시간으로 표시돼요. 화면에서 위아래로 스크롤하고, 끝에 도달하면 페이지 스크롤로 이어집니다.</div></div>
  <div class="section-header"><h2 class="section-title">이 날의 일정</h2><button class="soft-button" type="button" data-act="new" data-type="other" data-status="plan">+ 일정 추가</button></div>
  <div class="card">${dailyActivities()}</div>
  <div style="height:24px"></div>`;
}
function moveMonth(value,delta){const [y,m]=value.split('-').map(Number);return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7)}
function renderCalendar(){
  const [y,m]=monthCursor.split('-').map(Number),first=`${monthCursor}-01`,startWeek=new Date(y,m-1,1).getDay();
  const days=new Date(y,m,0).getDate(),cells=[];
  for(let j=0;j<startWeek;j++)cells.push('<div class="calendar-day blank" aria-hidden="true"></div>');
  for(let day=1;day<=days;day++){
    const d=`${monthCursor}-${pad(day)}`,p=C.PHASES[C.cycleIndex(d,state.anchor)];
    const known=C.isKnown(state,d,'sleep'),slept=known?C.sleepMinutes(state,d,'actual'):null;
    cells.push(`<button type="button" data-act="calendar-date" data-date="${d}" class="calendar-day ${d===selected?'selected':''} ${d===C.today()?'today':''}"><span class="number">${day}</span><span class="tiny ${p.kind}">${p.short}</span><span class="tiny">${known?Math.floor(slept/60)+'h'+(slept%60?Math.round(slept%60)+'m':''):'—'}</span></button>`);
  }
  const monthEnd=C.addDays(`${monthCursor}-01`,days-1);
  const recorded=C.report(state,first,monthEnd);
  return `<div class="section-header"><h2 class="section-title">월간 달력</h2><span class="sub">원하는 날짜를 선택하세요</span></div>
    <div class="card"><div class="month-header"><strong style="font-size:18px;font-weight:650">${y}년 ${m}월</strong><div class="head-actions"><button class="tool-btn" data-act="month" data-value="-1" aria-label="이전 달">${icon('chevron-left')}</button><button class="tool-btn" data-act="month" data-value="1" aria-label="다음 달">${icon('chevron-right')}</button></div></div>
     <div class="month-grid">${['일','월','화','수','목','금','토'].map(d=>`<div class="weekday">${d}</div>`).join('')}${cells.join('')}</div>
     <div class="divider"></div><div class="stated-line"><span class="sub">이달 실제 수면 기록이 있는 날짜</span><span>${recorded.sleepKnown}일</span></div>
     <div class="quiet-note">수면은 기상한 날짜에 표시됩니다. 날짜를 누르면 해당 날짜의 48시간 타임라인으로 이동해요.</div></div>`;
}
function renderStats(){
  const anchor=C.cycleStart(selected,state.anchor);let end=selected;
  let first,label,isMonth=statsRange==='month';
  if(isMonth){first=`${selected.slice(0,7)}-01`;const [y,m]=selected.slice(0,7).split('-').map(Number);end=`${selected.slice(0,7)}-${pad(new Date(y,m,0).getDate())}`;label=`${y}년 ${m}월`}
  else{const day=Number(statsRange),since=C.addDays(selected,1-day);first=C.dayNum(since)<C.dayNum(anchor)?anchor:since;label=`${statsRange}일 보기 · ${tinyDate(first)}–${tinyDate(end)}`}
  const r=C.report(state,first,end),cycleReport=C.report(state,anchor,selected);
  const sample=(num,den,suffix='')=>den?`${(num/den).toFixed(1)}${suffix}`:'미기록';
  const barMax=Math.max(state.baseSleep, ...r.dates.map(d=>d.sleep),1),graph=r.dates.map(d=>{
    const h=d.sleepKnown?Math.max(4,d.sleep/barMax*92):3;
    return `<div class="bar-col" title="${d.date} · ${d.sleepKnown?C.fmt(d.sleep):'미기록'}"><span class="bar ${d.sleepKnown?'':'unknown'}" style="height:${h}px"></span><span class="bar-label">${Number(d.date.slice(8))}</span></div>`;
  }).join('');
  const foot=isMonth?'월간 기록은 참고용 평균만 표시해요. 12일 루틴의 목표·부족분은 각각 따로 계산합니다.':'표시된 날짜는 현재 12일 루틴에 속합니다. 이전 루틴의 실적은 포함하지 않아요.';
  const goalStatus=!isMonth&&r.sleepKnown?`목표 대비 ${C.signed(r.sleep-r.sleepGoals)}`:'기록된 날짜만 평균 계산';
  return `<div class="section-header"><h2 class="section-title">생활 통계</h2><span class="sub">${label}</span></div>
  <div class="segmented" style="margin-bottom:13px">${[['3','3일'],['7','7일'],['12','12일'],['month','월간']].map(([k,t])=>`<button data-act="stats-range" data-value="${k}" class="${statsRange===k?'active':''}" type="button">${t}</button>`).join('')}</div>
  <div class="card"><div class="section-header" style="margin:0 0 10px"><h2 class="section-title">수면</h2><span class="tiny-badge">기상 날짜 기준</span></div>
    <div class="stats-grid"><div class="metric"><div class="metric-label">기록일 평균 수면</div><div class="stats-number">${r.sleepAverage===null?'—':C.fmt(Math.round(r.sleepAverage))}</div><div class="micro">${r.sleepKnown} / ${r.totalDays}일 기록</div></div><div class="metric"><div class="metric-label">실제 수면 합계</div><div class="stats-number">${r.sleepKnown?C.fmt(r.sleep):'—'}</div><div class="micro">${goalStatus}</div></div></div>
    <div class="inline-label" style="margin-top:18px">일별 수면 기록 (최대 ${Math.ceil(barMax/60)}시간 눈금)</div><div class="bars">${graph}</div>
    <div class="quiet-note">${foot}</div>
  </div>
  <div class="card" style="margin-top:12px"><div class="section-header" style="margin:0 0 12px"><h2 class="section-title">식사와 운동</h2><span class="tiny-badge">실제 날짜 기준</span></div>
    <div class="stats-grid"><div class="metric"><div class="metric-label">하루 평균 식사</div><div class="stats-number">${sample(r.meals,r.mealKnown,'회')}</div><div class="micro">${r.mealKnown} / ${r.totalDays}일 기록</div></div>
    <div class="metric"><div class="metric-label">운동 총 시간</div><div class="stats-number">${r.exerciseKnown?C.fmt(r.exerciseMinutes):'—'}</div><div class="micro">${r.exerciseCount}회 · ${r.exerciseKnown}일 기록</div></div></div>
    ${!isMonth?`<div class="divider"></div><div class="stated-line"><span class="sub">식사 일별 목표</span><span>${state.mealGoal}회</span></div><div class="stated-line"><span class="sub">현재 루틴 운동 실적</span><span>${cycleReport.exerciseCount}회 / ${state.exerciseCount}회</span></div><div class="stated-line"><span class="sub">현재 루틴 운동 시간</span><span>${C.fmt(cycleReport.exerciseMinutes)} / ${C.fmt(state.exerciseMinutes)}</span></div>`:''}
  </div>
  <div class="section-header"><h2 class="section-title">날짜별 기록</h2><span class="sub">미기록은 0으로 계산하지 않아요</span></div>
  <div class="card">${r.dates.length?r.dates.map(d=>`<div class="report-day"><div><strong>${tinyDate(d.date)}</strong><div class="micro">${C.PHASES[C.cycleIndex(d.date,state.anchor)].name}</div></div><div style="text-align:right"><div>${d.sleepKnown?C.fmt(d.sleep):'수면 미기록'}</div><div class="micro">식사 ${d.mealKnown?d.meal+'회':'—'} · 운동 ${d.exerciseKnown?d.exercise.count+'회':'—'}</div></div></div>`).join(''):'<div class="empty">표시할 기록이 없습니다.</div>'}</div>`;
}
function renderRoutine(){
  const day=C.PHASES[routinePhase],items=state.templates[routinePhase]||[];
  const list=items.map(t=>{
    const end=C.atAbs(C.absolute('2026-01-01',t.time)+t.duration);
    return `<button class="activity-line" type="button" data-act="edit-template" data-id="${esc(t.id)}"><span class="activity-icon ${t.type}">${icon(ICON[t.type])}</span><span class="activity-body"><div class="activity-name">${esc(t.title)}</div><div class="activity-detail">${t.offset===0?'해당 날짜':t.offset>0?'다음 날':'전날'} ${t.time} · ${C.fmt(t.duration)}</div></span><span class="activity-tail">${icon('chevron-right')}</span></button>`;
  }).join('');
  return `<div class="section-header"><h2 class="section-title">12일 기본 루틴</h2><span class="sub">반복되는 계획만 편집</span></div>
    <div class="routine-grid">${C.PHASES.map((p,i)=>`<button type="button" data-act="routine-phase" data-value="${i}" class="routine-pill ${routinePhase===i?'active':''}">${p.short}<span>${i+1}일차</span></button>`).join('')}</div>
    <div class="card" style="margin-top:13px"><div class="row"><h2 class="section-title">${day.name}</h2><span class="tiny-badge ${day.kind}">${phaseText(day)}</span></div><p class="sub" style="margin:7px 0 0">이곳에서 설정한 일정은 해당 루틴 일차가 돌아올 때마다 반복돼요.</p>
     <div class="divider"></div>${day.kind!=='off'?`<div class="activity-line" style="pointer-events:none"><span class="activity-icon">${icon('clock')}</span><span class="activity-body"><div class="activity-name">고정 ${day.kind==='day'?'주간':'야간'}근무</div><div class="activity-detail">${phaseText(day)} · 변경 불가</div></span><span class="tiny-badge">고정</span></div>`:''}
     <div class="activity-list">${list||'<div class="empty">아직 반복 일정이 없어요.</div>'}</div>
     <button class="secondary-btn full" type="button" data-act="new-template" style="margin-top:15px">${icon('plus')}반복 일정 추가</button>
    </div>
    <div class="quiet-note" style="margin-top:12px">기본 루틴을 고치면 앞으로의 계획에 반영됩니다. 이미 직접 입력한 실제 수면·식사·운동 기록은 변경되지 않아요. 특정 날짜만 수정하려면 ‘오늘’ 화면에서 해당 일정을 누르세요.</div>`;
}
function renderSettings(){
 const p=C.cycleIndex(C.today(),state.anchor);
 return `<div class="section-header"><h2 class="section-title">설정</h2><span class="sub">나에게 맞게 조정</span></div>
 <div class="card"><h2 class="section-title" style="margin-bottom:13px">기본 목표</h2>
   <div class="setting-row"><div><div class="setting-main">기본 수면 목표</div><div class="setting-sub">날짜별로 별도 변경 가능</div></div><strong>${C.fmt(state.baseSleep)}</strong></div>
   <div class="setting-row"><div><div class="setting-main">하루 식사 목표</div><div class="setting-sub">간식 제외</div></div><strong>${state.mealGoal}회</strong></div>
   <div class="setting-row"><div><div class="setting-main">12일 운동 목표</div><div class="setting-sub">새 루틴마다 실적 새로 계산</div></div><strong>${state.exerciseCount}회 · ${C.fmt(state.exerciseMinutes)}</strong></div>
   <button class="secondary-btn full" type="button" data-act="edit-settings" style="margin-top:14px">${icon('edit')}목표 변경하기</button>
 </div>
 <div class="card"><h2 class="section-title" style="margin-bottom:13px">화면과 근무표</h2>
   <div class="setting-row"><div><div class="setting-main">화면 테마</div><div class="setting-sub">휴대전화 설정 자동 연동 지원</div></div><select id="themeSelect" class="field-input" style="width:118px"><option value="system" ${state.theme==='system'?'selected':''}>자동</option><option value="light" ${state.theme==='light'?'selected':''}>라이트</option><option value="dark" ${state.theme==='dark'?'selected':''}>다크</option></select></div>
   <div class="setting-row"><div><div class="setting-main">오늘의 근무 일차</div><div class="setting-sub">현재 ${C.PHASES[p].name}</div></div><button class="chip" type="button" data-act="edit-anchor">변경 ${icon('chevron-right')}</button></div>
 </div>
 <div class="card"><h2 class="section-title" style="margin-bottom:13px">데이터 보관</h2>
   <div class="setting-row"><div><div class="setting-main">자동 저장</div><div class="setting-sub">이 기기 브라우저 저장소에 보관</div></div><span class="tiny-badge">${storedOK?'사용 가능':'저장 오류'}</span></div>
   <div class="chips"><button class="chip" type="button" data-act="export">${icon('download')}백업 내려받기</button><button class="chip" type="button" data-act="import">${icon('upload')}백업 복원하기</button></div>
   <div class="quiet-note" style="margin-top:13px">브라우저 데이터 삭제나 기기 초기화 시 기록이 사라질 수 있어요. JSON 백업 파일을 별도의 안전한 위치에 보관하세요. 이전 v1 기록이 있다면 초기 실행 시 복사해서 불러옵니다.</div>
 </div>
 <div class="card"><div class="row"><div><h2 class="section-title">앱 정보</h2><div class="sub" style="margin-top:5px">RHYTHM v2 · 개인용 오프라인 웹앱</div></div>${icon('sparkle')}</div><div class="divider"></div><div class="micro">수면시간 계산은 자기기록을 기준으로 합니다. 건강 상태를 진단하지 않으며, 자정에 걸친 수면은 기상 날짜 기준으로 집계합니다.</div></div>`;
}
function findEvent(id){
  let e=state.events.find(e=>e.id===id);
  if(e)return {...e};
  return C.eventsIn(state,C.addDays(selected,-3),C.addDays(selected,3)).find(e=>e.id===id)||null;
}
function openEntry(id=null,type='other',status='plan',startAbsolute=null){
  const existing=id?findEvent(id):null;
  if(id&&!existing){toast('일정을 찾지 못했어요');return}
  editing={kind:'event',event:existing};endDateAuto=true;
  const source=existing||{},from=startAbsolute!=null?C.atAbs(startAbsolute):null;
  const date=source.date||from?.date||selected;
  const time=source.time||from?.time||(date===C.today()?timeNow():type==='sleep'?'00:00':'12:00');
  const eType=source.type||type,realStatus=source.status||status;
  const duration=source.duration||(eType==='sleep'?240:eType==='meal'?30:eType==='exercise'?30:60);
  const until=C.atAbs(C.absolute(date,time)+duration);
  const actualMinutes=source.actualMinutes==null?duration:source.actualMinutes;
  const kind=existing?.virtual?'이 날짜의 반복 일정 수정':existing?'일정 수정':'새 일정';
  const title=source.title||NAME[eType];
  openSheet(`${sheetHeading(kind)}
    <form id="eventForm">
      <div class="field"><label class="field-label" for="eventType">일정 종류</label><select id="eventType" class="field-input">${Object.entries(NAME).map(([k,v])=>`<option value="${k}" ${eType===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label class="field-label" for="eventTitle">일정 이름 (자유 입력)</label><input id="eventTitle" class="field-input" maxlength="180" value="${esc(title)}" placeholder="예: 회식, 서울 방문, 친구와 약속" required></div>
      <div class="field"><label class="field-label">기록 유형</label><div class="segmented">${['plan','actual'].map((k)=>`<button type="button" class="${realStatus===k?'active':''}" data-act="entry-status" data-value="${k}" ${existing?.virtual?'disabled':''}>${k==='plan'?'계획':'실제 기록'}</button>`).join('')}</div><input id="eventStatus" type="hidden" value="${realStatus}"></div>
      <div class="field-row"><div class="field"><label class="field-label" for="eventStartDate">시작 날짜</label><input type="date" id="eventStartDate" class="field-input" value="${date}" required></div><div class="field"><label class="field-label" for="eventStartTime">시작 시간</label><input type="time" id="eventStartTime" class="field-input" value="${time}" required></div></div>
      <div class="field-row"><div class="field"><label class="field-label" for="eventEndDate">종료 날짜</label><input type="date" id="eventEndDate" class="field-input" value="${until.date}" required></div><div class="field"><label class="field-label" for="eventEndTime">종료 시간</label><input type="time" id="eventEndTime" class="field-input" value="${until.time}" required></div></div>
      <div class="field-help">자정을 넘어가는 수면이나 일정도 시작·종료 날짜를 각각 선택할 수 있어요.</div>
      <div class="field" id="doneArea"><label class="field-label" for="eventDone">계획 수행 상태</label><select id="eventDone" class="field-input"><option value="unknown" ${source.done==null?'selected':''}>미기록</option><option value="yes" ${source.done===true?'selected':''}>완료</option><option value="no" ${source.done===false?'selected':''}>미완료</option></select></div>
      <div class="field" id="snackArea"><label class="checkbox-line"><input type="checkbox" id="eventSnack" ${source.snack?'checked':''}> 간식으로 기록 (식사 횟수에서 제외)</label></div>
      <div class="field" id="actualMinutesArea"><label class="field-label" for="eventActualMinutes">실제 운동시간 (분, 선택)</label><input id="eventActualMinutes" class="field-input" type="number" min="0" max="2880" value="${Number(actualMinutes)}"><div class="field-help">비우면 일정의 시작·종료시간으로 계산해요.</div></div>
      <div class="button-group"><button type="submit" class="primary-btn">${icon('check')}저장하기</button>${existing?`<button type="button" class="danger-btn" data-act="delete-event">${icon('bin')}삭제</button>`:''}</div>
      ${existing?.virtual?'<div class="quiet-note" style="margin-top:12px">여기서 수정해도 해당 날짜에만 적용됩니다. 12일 반복 일정을 변경하려면 ‘루틴’ 탭을 이용하세요.</div>':''}
    </form>`,'event');
  updateEntryFields();
}
function updateEntryFields(){
  if(sheetKind!=='event')return;
  const type=$('eventType').value,actual=$('eventStatus').value==='actual';
  $('doneArea').classList.toggle('hidden',type==='sleep'||actual);
  $('snackArea').classList.toggle('hidden',type!=='meal');
  $('actualMinutesArea').classList.toggle('hidden',type!=='exercise'||actual);
}
function saveEntry(ev){ev.preventDefault();
  const type=$('eventType').value,status=$('eventStatus').value;
  const title=$('eventTitle').value.trim(),date=$('eventStartDate').value,time=$('eventStartTime').value;
  const endDate=$('eventEndDate').value,endTime=$('eventEndTime').value;
  if(!C.validDate(date)||!C.validDate(endDate)||!Number.isFinite(C.mins(time))||!Number.isFinite(C.mins(endTime))){toast('날짜와 시간을 확인해 주세요');return}
  const duration=C.absolute(endDate,endTime)-C.absolute(date,time);
  if(duration<1||duration>2880){toast('일정은 1분 이상 48시간 이내로 설정해 주세요');return}
  if(!title){toast('일정 이름을 입력해 주세요');return}
  const source=editing?.event;
  const e={id:source&&!source.virtual?source.id:generateId(),date,time,duration,type,status,title,done:status==='plan'&&type!=='sleep'?($('eventDone').value==='yes'?true:$('eventDone').value==='no'?false:null):null,snack:type==='meal'&&$('eventSnack').checked,actualMinutes:null};
  if(e.type==='exercise'&&e.status==='plan'&&e.done===true){const v=$('eventActualMinutes').value.trim();e.actualMinutes=v===''?null:Number(v);if(e.actualMinutes!=null&&(!Number.isInteger(e.actualMinutes)||e.actualMinutes<0||e.actualMinutes>2880)){toast('실제 운동시간을 확인해 주세요');return}}
  if(!C.validEvent(e)){toast('일정 형식을 확인해 주세요');return}
  const clash=status==='plan'?C.conflicts(state,e,source?.id):[];
  if(clash.length&&!confirm(`${clash.length}개의 일정과 시간이 겹칩니다.\n${clash.slice(0,3).map(c=>`· ${c.title} (${C.fmt(c.minutes)})`).join('\n')}\n\n그래도 저장할까요?`))return;
  if(source?.virtual){
    const occurrence=C.key(source.baseDate,source.templateId);
    if(Math.abs(C.dayNum(date)-C.dayNum(source.baseDate))>2){state.overrides[occurrence]=null;state.events.push(e)}
    else state.overrides[occurrence]=e;
  }
  else if(source){const i=state.events.findIndex(x=>x.id===source.id);if(i>=0)state.events[i]=e}
  else state.events.push(e);
  save();closeSheet();render(false);toast('일정을 저장했어요');
}
function deleteEntry(){
  const e=editing?.event;if(!e||!confirm('이 일정을 삭제할까요?'))return;
  if(e.virtual)state.overrides[C.key(e.baseDate,e.templateId)]=null;
  else state.events=state.events.filter(x=>x.id!==e.id);
  save();closeSheet();render(false);toast('일정을 삭제했어요');
}
function openTemplate(id=null){
 const source=id?(state.templates[routinePhase]||[]).find(t=>t.id===id):null;
 if(id&&!source){toast('반복 일정을 찾지 못했어요');return}
 editing={kind:'template',phase:routinePhase,template:source};
 const type=source?.type||'sleep',time=source?.time||'12:00',duration=source?.duration||60;
 const end=C.atAbs(C.absolute('2026-01-01',time)+duration),endOffset=C.dayNum(end.date)-C.dayNum('2026-01-01');
 openSheet(`${sheetHeading(source?'반복 일정 수정':'반복 일정 추가')}
   <form id="templateForm"><div class="field"><label class="field-label">적용되는 근무 일차</label><div class="quiet-note">${C.PHASES[routinePhase].name} · 12일마다 반복</div></div>
   <div class="field"><label class="field-label" for="templateType">일정 종류</label><select id="templateType" class="field-input">${Object.entries(NAME).map(([k,v])=>`<option value="${k}" ${type===k?'selected':''}>${v}</option>`).join('')}</select></div>
   <div class="field"><label class="field-label" for="templateTitle">이름</label><input id="templateTitle" class="field-input" required maxlength="180" value="${esc(source?.title||NAME[type])}"></div>
   <div class="field-row"><div class="field"><label class="field-label">시작하는 날</label><select id="templateOffset" class="field-input">${[[-1,'전날'],[0,'해당 날짜'],[1,'다음 날']].map(([n,t])=>`<option value="${n}" ${source?.offset===n||!source&&n===0?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label class="field-label">시작 시간</label><input id="templateStart" class="field-input" type="time" value="${time}" required></div></div>
   <div class="field-row"><div class="field"><label class="field-label">종료 시점</label><select id="templateEndOffset" class="field-input">${[[0,'같은 날'],[1,'다음 날'],[2,'이틀 뒤']].map(([n,t])=>`<option value="${n}" ${endOffset===n?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label class="field-label">종료 시간</label><input id="templateEnd" class="field-input" type="time" value="${end.time}" required></div></div>
   <div class="field" id="templateSnackArea"><label class="checkbox-line"><input id="templateSnack" type="checkbox" ${source?.snack?'checked':''}> 간식으로 등록</label></div>
   <div class="button-group"><button type="submit" class="primary-btn">${icon('check')}반복 일정 저장</button>${source?`<button type="button" class="danger-btn" data-act="delete-template">삭제</button>`:''}</div>
   <div class="quiet-note">반복되는 계획만 수정합니다. 실제로 수행한 기록은 별도로 보관됩니다.</div></form>`,'template');
 $('templateSnackArea').classList.toggle('hidden',type!=='meal');
}
function saveTemplate(ev){ev.preventDefault();
 const type=$('templateType').value,title=$('templateTitle').value.trim(),offset=Number($('templateOffset').value),time=$('templateStart').value;
 const until=$('templateEnd').value,endOffset=Number($('templateEndOffset').value);
 const duration=endOffset*1440+C.mins(until)-C.mins(time);
 if(!title||!Number.isFinite(duration)||duration<1||duration>2880){toast('종료 시각은 시작보다 늦어야 하고, 48시간 이내여야 해요');return}
 const source=editing?.template;
 const t={id:source?.id||`template-${generateId()}`,type,title,offset,time,duration,snack:type==='meal'&&$('templateSnack').checked};
 const arr=state.templates[routinePhase];if(source){const index=arr.findIndex(x=>x.id===source.id);if(index>=0)arr[index]=t}else arr.push(t);
 save();closeSheet();render(false);toast('기본 루틴에 저장했어요');
}
function deleteTemplate(){
 const e=editing?.template;if(!e||!confirm('이 반복 일정을 모든 주기에서 삭제할까요? 과거 실제 기록은 유지됩니다.'))return;
 state.templates[editing.phase]=state.templates[editing.phase].filter(x=>x.id!==e.id);
 save();closeSheet();render(false);toast('반복 일정을 삭제했어요');
}
function openDayGoal(){
 const goal=C.sleepGoal(state,selected);
 openSheet(`${sheetHeading('이 날의 수면 목표')}
  <form id="goalForm"><div class="quiet-note">${dateLabel(selected)}의 수면 목표만 바꿉니다. 다른 날짜의 목표는 그대로 유지돼요.</div>
  <div class="field" style="margin-top:17px"><label for="dayGoal" class="field-label">목표 수면시간 (시간)</label><input type="number" id="dayGoal" class="field-input" min="2" max="16" step="0.25" value="${goal/60}" required></div>
  <div class="button-group"><button type="submit" class="primary-btn">저장하기</button><button class="secondary-btn" type="button" data-act="reset-day-goal">기본값으로</button></div></form>`,'day-goal');
}
function editSettings(){
 openSheet(`${sheetHeading('기본 생활 목표')}
  <form id="settingsForm"><div class="field"><label class="field-label" for="settingSleep">하루 기본 수면 목표 (시간)</label><input id="settingSleep" class="field-input" type="number" min="2" max="16" step="0.25" value="${state.baseSleep/60}" required></div>
  <div class="field"><label class="field-label" for="settingMeal">하루 식사 목표 (회, 간식 제외)</label><input id="settingMeal" class="field-input" type="number" min="1" max="10" step="1" value="${state.mealGoal}" required></div>
  <div class="field-row"><div class="field"><label class="field-label" for="settingExerciseCount">12일 운동 목표 (회)</label><input id="settingExerciseCount" class="field-input" type="number" min="0" max="30" value="${state.exerciseCount}" required></div>
  <div class="field"><label class="field-label" for="settingExerciseMinutes">12일 운동시간 (분)</label><input id="settingExerciseMinutes" class="field-input" type="number" min="0" max="5000" value="${state.exerciseMinutes}" required></div></div>
  <button type="submit" class="primary-btn full">변경 저장</button></form>`,'settings');
}
function editAnchor(){
 const index=C.cycleIndex(C.today(),state.anchor);
 openSheet(`${sheetHeading('근무 주기 다시 지정')}
   <div class="quiet-note">오늘이 12일 주기의 몇 번째 날인지 선택하세요. 이후 날짜별 근무는 자동 계산됩니다. 이미 기록된 개인 일정은 삭제되지 않아요.</div>
   <div class="field" style="margin-top:17px"><label class="field-label" for="anchorPhase">오늘 근무 일차</label><select id="anchorPhase" class="field-input">${C.PHASES.map((p,i)=>`<option value="${i}" ${index===i?'selected':''}>${i+1}일차 · ${p.name}${p.kind==='off'?(i<6?' (주간 후)':' (야간 후)'):''}</option>`).join('')}</select></div>
   <button class="primary-btn full" data-act="save-anchor" type="button">변경 저장</button>`,'anchor');
}
function reviewDay(){
 const items=[['sleep','수면'],['meal','식사'],['exercise','운동']];
 const options=(status)=>[['unknown','미기록 · 알 수 없음'],['recorded','기록 확인 완료'],['zero','실제로 0']].map(([v,t])=>`<option value="${v}" ${status===v?'selected':''}>${t}</option>`).join('');
 const rows=items.map(([type,name])=>{
   const actual=type==='sleep'?C.sleepMinutes(state,selected,'actual'):type==='meal'?C.actualMeal(state,selected):C.actualExercise(state,selected).count;
   const hasActual=actual>0,current=state.checks[selected]?.[type]||(hasActual?'recorded':'unknown');
   return `<div class="field"><label class="field-label" for="review-${type}">${name} <span class="sub" style="font-weight:normal">· ${hasActual?(type==='sleep'?C.fmt(actual):actual+'회')+' 기록됨':'기록 없음'}</span></label><select class="field-input" id="review-${type}">${options(current)}</select></div>`;
 }).join('');
 openSheet(`${sheetHeading('하루 기록 확인')}
   <form id="reviewForm"><div class="quiet-note">${dateLabel(selected)} · 기록하지 않았다는 뜻과 실제로 하지 않았다는 뜻은 달라요. 기록 없는 항목은 확실한 경우에만 ‘실제로 0’을 선택하세요.</div>
     <div style="margin-top:17px">${rows}</div><button class="primary-btn full" type="submit">${icon('check')}확인 저장</button>
     <div class="field-help" style="margin-top:11px">기상한 날짜 기준 수면만 집계됩니다. 확인 후에도 언제든 다시 수정할 수 있어요.</div>
   </form>`,'review');
}
function saveReview(ev){ev.preventDefault();
 const result={};for(const type of ['sleep','meal','exercise']){
   const v=$(`review-${type}`).value;
   const count=type==='sleep'?C.sleepMinutes(state,selected,'actual'):type==='meal'?C.actualMeal(state,selected):C.actualExercise(state,selected).count;
   if(count>0&&v==='zero'){toast(`${NAME[type]} 기록이 있어 0으로 확정할 수 없어요`);return}
   if(count===0&&v==='recorded'){toast(`${NAME[type]} 기록을 먼저 추가하거나 ‘미기록’으로 두세요`);return}
   result[type]=v;
 }
 state.checks[selected]=result;save();closeSheet();render(false);toast('하루 기록을 확인했어요');
}
function sleepTimer(){
 if(!state.runningSleep){
   state.runningSleep={startMs:Date.now()};save();render(false);toast('수면 기록을 시작했어요. 일어난 후 종료해 주세요');return;
 }
 const startMs=state.runningSleep.startMs,endMs=Date.now(),duration=Math.max(1,Math.round((endMs-startMs)/60000));
 if(duration>2880){toast('48시간이 넘는 수면은 직접 시간 입력으로 기록해 주세요');return}
 const start=new Date(startMs),date=C.today(start),time=`${pad(start.getHours())}:${pad(start.getMinutes())}`;
 const evt={id:generateId(),date,time,duration,type:'sleep',status:'actual',title:'수면',done:null,snack:false,actualMinutes:null};
 if(!C.validEvent(evt)){toast('수면시간 계산에 문제가 있어요');return}
 state.events.push(evt);state.runningSleep=null;save();selected=C.sleepWakeDate(evt);monthCursor=selected.slice(0,7);render(true);toast(`수면 ${C.fmt(duration)}을 기록했어요. 실제 잠든 시각은 나중에 수정할 수 있어요`);
}
function saveDayGoal(ev){ev.preventDefault();const hours=Number($('dayGoal').value),min=Math.round(hours*60);
 if(!Number.isInteger(min)||min<120||min>960){toast('2~16시간 사이에서 설정해 주세요');return}
 state.goals[selected]=min;save();closeSheet();render(false);toast('이 날의 수면 목표를 변경했어요')
}
function saveSettings(ev){ev.preventDefault();
 const sleep=Math.round(Number($('settingSleep').value)*60),meal=Number($('settingMeal').value),count=Number($('settingExerciseCount').value),minutes=Number($('settingExerciseMinutes').value);
 if(!Number.isInteger(sleep)||sleep<120||sleep>960||!Number.isInteger(meal)||meal<1||meal>10||!Number.isInteger(count)||count<0||count>30||!Number.isInteger(minutes)||minutes<0||minutes>5000){toast('목표값 범위를 확인해 주세요');return}
 state.baseSleep=sleep;state.mealGoal=meal;state.exerciseCount=count;state.exerciseMinutes=minutes;save();closeSheet();render(false);toast('기본 목표를 변경했어요');
}
function exportBackup(){
 const payload={...state,format:'rhythm-backup-v2',exportedAt:new Date().toISOString()};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`rhythm-v2-${C.today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('백업 파일을 내려받았어요');
}
async function importBackup(file){
 if(!file)return;
 if(file.size>15*1024*1024){toast('백업 파일이 너무 커요 (최대 15MB)');return}
 try{
  const raw=JSON.parse(await file.text());
  if(!raw||typeof raw!=='object'||!Array.isArray(raw.events)||!C.validDate(raw.anchor))throw Error('형식 오류');
  const next=raw.format==='rhythm-backup-v1'||raw.version!==2&&raw.events.some(e=>Object.hasOwn(e,'start'))?C.migrateV1(raw):C.normalize(raw);
  if(!next.anchor)throw Error('근무표 기준 없음');
  if(!confirm('현재 저장된 모든 기록을 백업 파일 내용으로 교체할까요? 먼저 현재 기록을 백업해 두는 것을 권장합니다.'))return;
  state=next;save();selected=C.today();monthCursor=selected.slice(0,7);tab='home';applyTheme();render(true);toast('기록을 복원했어요');
 }catch(err){toast('올바른 RHYTHM 백업 파일인지 확인해 주세요')}
}
function showOnboard(){
 if(state.anchor)return;
 const div=document.createElement('div');div.className='onboard-full';div.id='onboard';
 div.innerHTML=`<div class="onboard-inner"><div class="onboard-mark">${icon('moon')}</div><h1 class="onboard-title">나만의 리듬을<br>설정해 볼까요?</h1><p class="onboard-desc">오늘이 12일 근무 주기 중 몇 번째 날인지 알려주세요. 이후 주간 4일, 휴무 2일, 야간 4일, 휴무 2일이 자동으로 반복돼요.</p>
 <div class="onboard-block"><div class="field-label" style="margin-bottom:12px">오늘의 근무 일차</div><div class="onboard-grid">${C.PHASES.map((p,i)=>`<button type="button" class="onboard-option" data-onboard-phase="${i}">${p.short}<small>${i+1}일차</small></button>`).join('')}</div></div>
 <div class="onboard-block"><label class="field-label" for="firstSleep">기본 수면 목표</label><select id="firstSleep" class="field-input" style="margin-top:8px"><option value="420">7시간</option><option value="460">7시간 40분</option><option value="480" selected>8시간</option><option value="540">9시간</option></select></div>
 <button id="finishOnboard" class="primary-btn full" type="button" disabled>RHYTHM 시작하기</button><p class="micro" style="text-align:center;margin-top:18px">모든 기록은 이 기기의 저장 공간에만 저장됩니다.</p></div>`;
 document.body.appendChild(div);
 let selectedPhase=null;
 div.addEventListener('click',ev=>{
  const phase=ev.target.closest('[data-onboard-phase]');if(phase){selectedPhase=Number(phase.dataset.onboardPhase);div.querySelectorAll('[data-onboard-phase]').forEach(x=>x.classList.toggle('selected',x===phase));div.querySelector('#finishOnboard').disabled=false}
  if(ev.target.closest('#finishOnboard')&&selectedPhase!==null){state.anchor=C.addDays(C.today(),-selectedPhase);state.baseSleep=Number(div.querySelector('#firstSleep').value);save();div.remove();render(true);toast('12일 근무 루틴이 연결되었어요')}
 });
}
function screenAction(ev){
 const btn=ev.target.closest('[data-act]');if(!btn)return;
 const act=btn.dataset.act;const id=btn.dataset.id;
 switch(act){
  case 'close-sheet':closeSheet();return;
  case 'pick-date':goDate(btn.dataset.date);return;
  case 'calendar-date':goDate(btn.dataset.date);goTab('home');return;
  case 'new':openEntry(null,btn.dataset.type||'other',btn.dataset.status||'plan');return;
  case 'edit':openEntry(id);return;
  case 'free-add':openEntry(null,'other','plan',Number(btn.dataset.start));return;
  case 'delete-event':deleteEntry();return;
  case 'day-goal':openDayGoal();return;
  case 'reset-day-goal':delete state.goals[selected];save();closeSheet();render(false);toast('기본 수면 목표를 적용했어요');return;
  case 'review':reviewDay();return;
  case 'sleep-timer':sleepTimer();return;
  case 'entry-status':{
    const s=$('eventStatus');s.value=btn.dataset.value;document.querySelectorAll('[data-act=entry-status]').forEach(b=>b.classList.toggle('active',b===btn));updateEntryFields();return;
  }
  case 'zoom':{
    const sc=$('timelineScroller');if(sc){const base=Number(sc.dataset.startAbs),rate=Number(sc.dataset.rate);focusAbs=base+(sc.scrollTop+sc.clientHeight/2)/rate}
    state.scale=C.between(state.scale+Number(btn.dataset.value),0,2);save();render(false);return;
  }
  case 'jump-now':{
    const sc=$('timelineScroller');if(!sc)return;const at=selected===C.today()?nowAbs():C.absolute(selected,'00:00');sc.scrollTo({top:Math.max(0,(at-Number(sc.dataset.startAbs))*Number(sc.dataset.rate)-sc.clientHeight/2),behavior:'smooth'});return;
  }
  case 'month':monthCursor=moveMonth(monthCursor,Number(btn.dataset.value));render(false);return;
  case 'stats-range':statsRange=btn.dataset.value;render(false);return;
  case 'routine-phase':routinePhase=Number(btn.dataset.value);render(false);return;
  case 'new-template':openTemplate();return;
  case 'edit-template':openTemplate(id);return;
  case 'delete-template':deleteTemplate();return;
  case 'edit-settings':editSettings();return;
  case 'edit-anchor':editAnchor();return;
  case 'save-anchor':{
    const index=Number($('anchorPhase').value);
    if(!Number.isInteger(index)||index<0||index>11)return;
    if(!confirm('근무표 기준을 변경할까요? 기존 일정 기록은 유지하지만 날짜별 근무 일차가 다시 계산됩니다.'))return;
    state.anchor=C.addDays(C.today(),-index);save();closeSheet();render(true);toast('근무 일차를 다시 설정했어요');return;
  }
  case 'export':exportBackup();return;
  case 'import':$('importFile').click();return;
 }
}
function setupHandlers(){
 document.addEventListener('click',ev=>{
  const nav=ev.target.closest('[data-tab]');if(nav){goTab(nav.dataset.tab);return}
  if(ev.target.closest('#datePrev')){goDate(C.addDays(selected,-1));return}
  if(ev.target.closest('#dateNext')){goDate(C.addDays(selected,1));return}
  if(ev.target.closest('#dateToday')){goDate(C.today());return}
  if(ev.target.closest('#fab')){openEntry();return}
  if(ev.target.closest('#themeShortcut')){state.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';save();applyTheme();if(tab==='settings')render(false);return}
  screenAction(ev);
 });
 $('sheet').addEventListener('click',ev=>{if(ev.target===$('sheet'))closeSheet()});
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&sheetKind)closeSheet()});
 document.addEventListener('submit',ev=>{
   if(ev.target.id==='eventForm')saveEntry(ev);
   else if(ev.target.id==='templateForm')saveTemplate(ev);
   else if(ev.target.id==='goalForm')saveDayGoal(ev);
   else if(ev.target.id==='settingsForm')saveSettings(ev);
   else if(ev.target.id==='reviewForm')saveReview(ev);
 });
 document.addEventListener('input',ev=>{
   if(sheetKind!=='event')return;
   if(ev.target.id==='eventEndDate'){endDateAuto=false;return}
   if(!endDateAuto||!['eventStartDate','eventStartTime','eventEndTime'].includes(ev.target.id))return;
   const startDate=$('eventStartDate').value,start=C.mins($('eventStartTime').value),end=C.mins($('eventEndTime').value);
   if(C.validDate(startDate)&&Number.isFinite(start)&&Number.isFinite(end))$('eventEndDate').value=C.addDays(startDate,end<=start?1:0);
 });
 document.addEventListener('change',ev=>{
   if(ev.target.id==='themeSelect'){state.theme=ev.target.value;save();applyTheme()}
   if(ev.target.id==='eventType'){
     const e=editing?.event,newType=ev.target.value,title=$('eventTitle');
     if(!e&&Object.values(NAME).includes(title.value))title.value=NAME[newType];updateEntryFields();
   }
   if(ev.target.id==='templateType'){
     const title=$('templateTitle'),newType=ev.target.value;
     if(!editing?.template&&Object.values(NAME).includes(title.value))title.value=NAME[newType];
     $('templateSnackArea').classList.toggle('hidden',newType!=='meal');
   }
 });
 $('importFile').addEventListener('change',async ev=>{await importBackup(ev.target.files?.[0]);ev.target.value=''});
 try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(state.theme==='system')applyTheme()})}catch(e){}
 setInterval(()=>{
   const live=$('nowLine'),sc=$('timelineScroller');if(live&&sc){const base=Number(sc.dataset.startAbs),rate=Number(sc.dataset.rate);live.style.top=`${(nowAbs()-base)*rate}px`}
   const txt=$('sleepTimerValue');if(txt&&state.runningSleep)txt.textContent=C.fmt(Math.max(0,Math.round((Date.now()-state.runningSleep.startMs)/60000)))+' 경과';
 },30000);
}
applyTheme();setupHandlers();render(true);showOnboard();
if('serviceWorker' in navigator&&location.protocol!=='file:'){
 window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
// Light-weight diagnostics used by automated in-browser smoke tests.
window.RhythmDebug={getState:()=>structuredClone(state),selectDate:goDate,goTab,report:(a,b)=>C.report(state,a,b)};
})();
