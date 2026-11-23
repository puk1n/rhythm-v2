/* RHYTHM v2 — pure scheduling and reporting rules (browser + Node tests). */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RhythmCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const DAY=1440;
  const PHASES=[
    ...Array.from({length:4},(_,i)=>({kind:'day',name:`주간 ${i+1}일차`,short:`주${i+1}`})),
    ...Array.from({length:2},(_,i)=>({kind:'off',name:`휴무 ${i+1}일차`,short:`휴${i+1}`})),
    ...Array.from({length:4},(_,i)=>({kind:'night',name:`야간 ${i+1}일차`,short:`야${i+1}`})),
    ...Array.from({length:2},(_,i)=>({kind:'off',name:`휴무 ${i+1}일차`,short:`휴${i+1}`}))
  ];
  const TYPES=['sleep','meal','exercise','other'];
  const pad=n=>String(n).padStart(2,'0');
  const today=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dayNum=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return NaN;const [y,m,d]=s.split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000)};
  const dateFromNum=n=>new Date(n*86400000).toISOString().slice(0,10);
  const validDate=s=>Number.isFinite(dayNum(s))&&dateFromNum(dayNum(s))===s;
  const addDays=(s,n)=>dateFromNum(dayNum(s)+n);
  const mins=t=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t||''))return NaN;const [h,m]=t.split(':').map(Number);return 60*h+m};
  const hhmm=n=>`${pad(Math.floor(((n%DAY)+DAY)%DAY/60))}:${pad(((n%60)+60)%60)}`;
  const absolute=(date,time)=>dayNum(date)*DAY+mins(time);
  const atAbs=n=>({date:dateFromNum(Math.floor(n/DAY)),time:hhmm(n)});
  const between=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const fmt=n=>{n=Math.max(0,Math.round(n));const h=Math.floor(n/60),m=n%60;return h?`${h}시간${m?` ${m}분`:''}`:`${m}분`};
  const signed=n=>`${n>0?'+':n<0?'−':''}${fmt(Math.abs(n))}`;
  const cycleIndex=(s,anchor)=>!validDate(anchor)?0:((dayNum(s)-dayNum(anchor))%12+12)%12;
  const cycleStart=(s,anchor)=>addDays(s,-cycleIndex(s,anchor));
  const defaultTemplates=()=>PHASES.map((p,i)=>i<4?[{id:`day-sleep-${i}`,type:'sleep',title:'주간 기본 수면',time:'00:00',duration:460,offset:0}]:[]);
  const freshState=()=>({version:2,anchor:null,baseSleep:480,mealGoal:3,exerciseCount:5,exerciseMinutes:150,theme:'system',scale:1,events:[],templates:defaultTemplates(),overrides:{},goals:{},checks:{},runningSleep:null});
  const validEvent=e=>!!e&&typeof e.id==='string'&&e.id.length<140&&validDate(e.date)&&Number.isFinite(mins(e.time))&&Number.isInteger(e.duration)&&e.duration>0&&e.duration<=2880&&TYPES.includes(e.type)&&['plan','actual'].includes(e.status)&&typeof e.title==='string'&&e.title.length<=180;
  const normalizeEvent=e=>({id:String(e.id).slice(0,140),date:e.date,time:e.time,duration:Number(e.duration),type:e.type,status:e.status,title:String(e.title||'').slice(0,180),done:e.done===true?true:e.done===false?false:null,snack:!!e.snack,actualMinutes:Number.isFinite(+e.actualMinutes)?between(Math.round(+e.actualMinutes),0,2880):null});
  const safePositive=(n,def,min,max)=>Number.isFinite(+n)&&+n>=min&&+n<=max?Math.round(+n):def;
  const validTemplate=t=>t&&typeof t.id==='string'&&TYPES.includes(t.type)&&Number.isFinite(mins(t.time))&&Number.isInteger(t.duration)&&t.duration>0&&t.duration<=2880&&[-1,0,1].includes(t.offset)&&typeof t.title==='string';
  const normalizeTemplate=t=>({id:String(t.id).slice(0,140),type:t.type,title:String(t.title).slice(0,180),time:t.time,duration:t.duration,offset:t.offset,snack:!!t.snack});
  function normalize(raw){
    const s=freshState();if(!raw||typeof raw!=='object')return s;
    s.anchor=validDate(raw.anchor)?raw.anchor:null;
    s.baseSleep=safePositive(raw.baseSleep,480,120,960);
    s.mealGoal=safePositive(raw.mealGoal,3,1,10);
    s.exerciseCount=safePositive(raw.exerciseCount,5,0,30);
    s.exerciseMinutes=safePositive(raw.exerciseMinutes,150,0,5000);
    s.theme=['system','light','dark'].includes(raw.theme)?raw.theme:'system';
    s.scale=[0,1,2].includes(raw.scale)?raw.scale:1;
    s.events=Array.isArray(raw.events)?raw.events.filter(validEvent).slice(0,30000).map(normalizeEvent):[];
    if(Array.isArray(raw.templates))s.templates=Array.from({length:12},(_,i)=>Array.isArray(raw.templates[i])?raw.templates[i].filter(validTemplate).slice(0,100).map(normalizeTemplate):[]);
    if(raw.overrides&&typeof raw.overrides==='object'&&!Array.isArray(raw.overrides))for(const [key,val] of Object.entries(raw.overrides).slice(0,50000)){
      if(/^\d{4}-\d{2}-\d{2}\|[a-zA-Z0-9_-]{1,140}$/.test(key)&&(val===null||validEvent(val)))s.overrides[key]=val===null?null:normalizeEvent(val);
    }
    if(raw.goals&&typeof raw.goals==='object')for(const [k,v] of Object.entries(raw.goals))if(validDate(k)&&Number.isInteger(v)&&v>=120&&v<=960)s.goals[k]=v;
    if(raw.checks&&typeof raw.checks==='object')for(const [k,v] of Object.entries(raw.checks))if(validDate(k)&&v&&typeof v==='object'){
      const statuses={};for(const type of ['sleep','meal','exercise'])statuses[type]=['recorded','zero','unknown'].includes(v[type])?v[type]:'unknown';
      s.checks[k]=statuses;
    }
    const r=raw.runningSleep;
    if(r&&Number.isFinite(r.startMs)&&r.startMs>0)s.runningSleep={startMs:r.startMs};
    return s;
  }
  function migrateV1(old){
    const s=freshState();s.anchor=validDate(old.anchor)?old.anchor:null;
    s.baseSleep=safePositive(Math.round(Number(old.target)*60),480,120,960);
    if(Array.isArray(old.events))for(const e of old.events){
      if(!validDate(e?.date)||!Number.isFinite(mins(e.start))||!Number.isFinite(mins(e.end))||!TYPES.includes(e.type)||!['plan','actual'].includes(e.status))continue;
      let duration=mins(e.end)-mins(e.start);if(duration<=0)duration+=DAY;
      const result={id:String(e.id||`legacy-${s.events.length}`),date:e.date,time:e.start,duration,type:e.type,status:e.status,title:String(e.title||e.type),done:null,snack:false,actualMinutes:null};
      if(validEvent(result))s.events.push(normalizeEvent(result));
    }
    if(s.anchor){
      const suppressed=new Set(Array.isArray(old.noDefaults)?old.noDefaults:[]);
      for(const e of s.events)if(e.type==='sleep'&&e.status==='plan')suppressed.add(e.date);
      for(const date of suppressed)if(validDate(date)){
        const i=cycleIndex(date,s.anchor);if(i<4)s.overrides[`${date}|day-sleep-${i}`]=null;
      }
    }
    return s;
  }
  const key=(base,templateId)=>`${base}|${templateId}`;
  const asEvent=(t,base)=>({id:`template:${key(base,t.id)}`,templateId:t.id,baseDate:base,virtual:true,date:addDays(base,t.offset),time:t.time,duration:t.duration,type:t.type,title:t.title,status:'plan',done:null,snack:!!t.snack,actualMinutes:null});
  function eventsIn(s,first,last){
    // Date boundaries are inclusive. Templates may be offset up to a day.
    const a=dayNum(first)*DAY,b=(dayNum(last)+1)*DAY;
    const all=[];
    for(const e of s.events){const st=absolute(e.date,e.time);if(st<b&&st+e.duration>a)all.push({...e})}
    if(!s.anchor)return all;
    for(let base=dayNum(first)-3;base<=dayNum(last)+1;base++){
      const date=dateFromNum(base),phase=cycleIndex(date,s.anchor);
      for(const t of s.templates[phase]||[]){
        const k=key(date,t.id),override=Object.prototype.hasOwnProperty.call(s.overrides,k)?s.overrides[k]:undefined;
        if(override===null)continue;
        const e=override===undefined?asEvent(t,date):{...override,virtual:true,templateId:t.id,baseDate:date,id:`template:${k}`};
        const st=absolute(e.date,e.time);if(st<b&&st+e.duration>a)all.push(e);
      }
    }
    return all;
  }
  const sleepWakeDate=e=>atAbs(absolute(e.date,e.time)+e.duration).date;
  const union=intervals=>{
    const a=intervals.filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&y>x).sort((x,y)=>x[0]-y[0]);
    let sum=0,start=null,end=null;
    for(const [x,y] of a){if(start===null){start=x;end=y}else if(x<=end)end=Math.max(end,y);else{sum+=end-start;start=x;end=y}}return sum+(start===null?0:end-start);
  };
  function sleepMinutes(s,date,status){
    const pool=eventsIn(s,addDays(date,-3),date).filter(e=>e.type==='sleep'&&e.status===status&&sleepWakeDate(e)===date);
    return union(pool.map(e=>{const st=absolute(e.date,e.time);return [st,st+e.duration]}));
  }
  const sleepGoal=(s,date)=>Object.hasOwn(s.goals,date)?s.goals[date]:s.baseSleep;
  function workEvents(s,first,last){
    if(!s.anchor)return [];
    const result=[];
    for(let n=dayNum(first)-1;n<=dayNum(last);n++){
      const date=dateFromNum(n),p=PHASES[cycleIndex(date,s.anchor)];
      if(p.kind==='day')result.push({id:`work:${date}`,date,time:'09:00',duration:720,type:'work',title:'주간근무',status:'fixed'});
      else if(p.kind==='night')result.push({id:`work:${date}`,date,time:'21:00',duration:720,type:'work',title:'야간근무',status:'fixed'});
    }
    return result;
  }
  function conflicts(s,e,except){
    const a=absolute(e.date,e.time),b=a+e.duration;
    const check=[...eventsIn(s,addDays(e.date,-2),addDays(e.date,2)).filter(x=>x.status==='plan'),...workEvents(s,addDays(e.date,-1),addDays(e.date,2))];
    return check.filter(x=>x.id!==except&&x.id!==e.id).filter(x=>{
      const x1=absolute(x.date,x.time),x2=x1+x.duration;
      return Math.max(0,Math.min(b,x2)-Math.max(a,x1))>0;
    }).map(x=>({title:x.title,minutes:Math.min(b,absolute(x.date,x.time)+x.duration)-Math.max(a,absolute(x.date,x.time))}));
  }
  function freeGaps(s,firstAbs,lastAbs){
    const a=atAbs(firstAbs).date,b=atAbs(lastAbs-1).date;
    const occupied=[...workEvents(s,a,b),...eventsIn(s,a,b).filter(e=>e.status==='plan')];
    const sorted=occupied.map(e=>{const st=absolute(e.date,e.time);return [Math.max(firstAbs,st),Math.min(lastAbs,st+e.duration)]}).filter(([x,y])=>y>x).sort((x,y)=>x[0]-y[0]);
    const gaps=[];let pointer=firstAbs;
    for(const [x,y] of sorted){if(x>pointer)gaps.push([pointer,x]);pointer=Math.max(pointer,y)}
    if(pointer<lastAbs)gaps.push([pointer,lastAbs]);return gaps;
  }
  function actualMeal(s,date){
    return s.events.filter(e=>e.date===date&&e.type==='meal'&&e.status==='actual'&&!e.snack).length+
      eventsIn(s,date,date).filter(e=>e.type==='meal'&&e.status==='plan'&&e.date===date&&e.done===true&&!e.snack).length;
  }
  function snackCount(s,date){
    return s.events.filter(e=>e.date===date&&e.type==='meal'&&e.status==='actual'&&e.snack).length+
      eventsIn(s,date,date).filter(e=>e.type==='meal'&&e.status==='plan'&&e.date===date&&e.done===true&&e.snack).length;
  }
  function actualExercise(s,date){
    const actual=s.events.filter(e=>e.date===date&&e.type==='exercise'&&e.status==='actual');
    const done=eventsIn(s,date,date).filter(e=>e.date===date&&e.type==='exercise'&&e.status==='plan'&&e.done===true);
    return {count:actual.length+done.length,minutes:actual.reduce((t,e)=>t+(e.actualMinutes??e.duration),0)+done.reduce((t,e)=>t+(e.actualMinutes??e.duration),0)};
  }
  function isKnown(s,date,type){
    const check=s.checks[date]?.[type];if(check==='zero'||check==='recorded')return true;
    if(type==='sleep')return sleepMinutes(s,date,'actual')>0;
    if(type==='meal')return actualMeal(s,date)>0;
    return actualExercise(s,date).count>0;
  }
  function report(s,start,end){
    const dates=[];for(let d=dayNum(start);d<=dayNum(end);d++)dates.push(dateFromNum(d));
    const out={dates:[],totalDays:dates.length,sleepKnown:0,mealKnown:0,exerciseKnown:0,sleep:0,sleepGoals:0,meals:0,mealGoals:0,exerciseCount:0,exerciseMinutes:0};
    for(const d of dates){
      const sleep=sleepMinutes(s,d,'actual'),meal=actualMeal(s,d),ex=actualExercise(s,d);
      const a=isKnown(s,d,'sleep'),b=isKnown(s,d,'meal'),c=isKnown(s,d,'exercise');
      if(a){out.sleepKnown++;out.sleep+=sleep;out.sleepGoals+=sleepGoal(s,d)}
      if(b){out.mealKnown++;out.meals+=meal;out.mealGoals+=s.mealGoal}
      if(c){out.exerciseKnown++;out.exerciseCount+=ex.count;out.exerciseMinutes+=ex.minutes}
      out.dates.push({date:d,sleep,meal,exercise:ex,sleepKnown:a,mealKnown:b,exerciseKnown:c});
    }
    out.sleepAverage=out.sleepKnown?out.sleep/out.sleepKnown:null;
    out.mealAverage=out.mealKnown?out.meals/out.mealKnown:null;
    return out;
  }
  function cycleReport(s,date,days=12){
    const first=cycleStart(date,s.anchor),last=addDays(date,1-days);
    return report(s,dayNum(first)>dayNum(last)?first:last,date);
  }
  return {DAY,PHASES,TYPES,today,dayNum,dateFromNum,validDate,addDays,mins,hhmm,absolute,atAbs,between,fmt,signed,cycleIndex,cycleStart,defaultTemplates,freshState,validEvent,normalizeEvent,normalize,migrateV1,key,asEvent,eventsIn,sleepWakeDate,union,sleepMinutes,sleepGoal,workEvents,conflicts,freeGaps,actualMeal,snackCount,actualExercise,isKnown,report,cycleReport};
});
