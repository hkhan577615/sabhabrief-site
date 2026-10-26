/* Sabha Brief: shared helpers for every page. */
(function(){
const SB=window.SB={};
SB.TZ="Asia/Colombo";
SB.TRACKS={law:"Laws & rules",money:"Public money",oversight:"Oversight",record:"On the record"};
SB.TRACK_SUB={law:"Bills, orders and court rulings",money:"Budget, duties and debt",oversight:"Committees, audits, inquiries",record:"Figures and answers"};
SB.SRC={bh:"Daily record",gazette:"Gazette",act:"Act",hansard:"Hansard"};
SB.STAGES=["Published","First reading","Court or committee","Passed","Law"];
SB.$=id=>document.getElementById(id);
SB.esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
/* Official government sources only: parliament.lk, any gov.lk site, the Supreme Court. */
SB.official=u=>{try{const x=new URL(u);return x.protocol==="https:"&&/(^|\.)parliament\.lk$|(^|\.)gov\.lk$|(^|\.)supremecourt\.lk$/.test(x.hostname)}catch(e){return false}};
SB.tr=t=>SB.TRACKS[t]?t:"record";
SB.D=iso=>new Date(iso+"T00:00:00Z");
SB.F=(iso,o)=>new Intl.DateTimeFormat("en-GB",Object.assign({timeZone:"UTC"},o)).format(SB.D(iso));
SB.short=iso=>SB.F(iso,{weekday:"short",day:"numeric",month:"short"});
SB.long=iso=>SB.F(iso,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
SB.dm=iso=>SB.F(iso,{day:"numeric",month:"short"});
SB.dmy=iso=>SB.F(iso,{day:"numeric",month:"short",year:"numeric"});
SB.today=(()=>{try{return new Intl.DateTimeFormat("en-CA",{timeZone:SB.TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}catch(e){return new Date().toISOString().slice(0,10)}})();
SB.diff=(a,b)=>Math.round((SB.D(b)-SB.D(a))/864e5);
SB.addDays=(iso,n)=>{const d=SB.D(iso);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
SB.rel=iso=>{const n=SB.diff(SB.today,iso);return n>1?"in "+n+" days":n===1?"tomorrow":n===0?"today":"under way"};
SB.load=(...names)=>Promise.all(names.map(n=>fetch(n,{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(n+" "+r.status);return r.json()})));
SB.fail=(id,msg)=>{const el=SB.$(id);if(el)el.innerHTML=`<p class="empty">${SB.esc(msg||"This section could not load. Refresh the page to try again.")}</p>`};
SB.safe=(id,fn)=>{try{fn()}catch(e){SB.fail(id);if(window.console)console.error(e)}};

SB.link=s=>s&&SB.official(s.u)?`<a href="${SB.esc(s.u)}" target="_blank" rel="noopener">${SB.esc(s.t)}</a>`:SB.esc(s&&s.t);
SB.srcLinks=(arr,label)=>{const l=(arr||[]).filter(s=>s&&SB.official(s.u)).map(SB.link);return l.length?`<p class="src">${SB.esc(label||(l.length>1?"Official sources":"Official source"))}: ${l.join(" · ")}</p>`:""};
SB.figs=(list,track)=>(list||[]).length?`<div class="figs${list.length>4?" many":""}${track?" t-"+track:""}">${list.map(f=>`<div class="fig"><b>${SB.esc(f.v)}</b><span>${SB.esc(f.l)}</span></div>`).join("")}</div>`:"";
SB.voteBar=v=>{
  if(!v)return "";
  const f=+v.for||0,a=+v.against||0,x=+v.abstain||0,t=(f+a+x)||1;
  return `<div class="vote" role="img" aria-label="${f} for, ${a} against${x?", "+x+" abstained":""}"><div class="vb"><i class="vf" style="width:${f/t*100}%"></i><i class="va" style="width:${a/t*100}%"></i>${x?`<i class="vx" style="width:${x/t*100}%"></i>`:""}</div><div class="vl"><span><b>${f}</b>for</span><span><b>${a}</b>against</span>${x?`<span><b>${x}</b>abstained</span>`:""}</div></div>`;
};
SB.stageBar=st=>{
  st=Math.max(0,Math.min(4,st|0));
  return `<div class="stage s${st}"><div class="stage-bar" role="img" aria-label="Stage ${st+1} of 5: ${SB.esc(SB.STAGES[st])}">${SB.STAGES.map((_,i)=>`<span class="${i<=st?"on":""}"></span>`).join("")}</div><ol class="stage-l" aria-hidden="true">${SB.STAGES.map((s,i)=>`<li class="${i===st?"cur":""}">${SB.esc(s)}</li>`).join("")}</ol></div>`;
};
SB.implHTML=(im,opts)=>{
  if(!im)return "";
  opts=opts||{};
  const ch=(im.changes||[]).length?`<div><h4>${SB.esc(opts.changesLabel||"What changes")}</h4><ul>${im.changes.map(x=>`<li>${SB.esc(x)}</li>`).join("")}</ul></div>`:"";
  const who=(im.who||[]).length||im.when?`<div>${(im.who||[]).length?`<h4>Who is affected</h4><div class="who">${im.who.map(x=>`<span>${SB.esc(x)}</span>`).join("")}</div>`:""}${im.when?`<p class="when"><b>When it starts.</b> ${SB.esc(im.when)}</p>`:""}</div>`:"";
  return `<div class="impl">${im.sum?`<p class="sum">${SB.esc(im.sum)}</p>`:""}${SB.figs(im.figs,"law")}${SB.voteBar(im.votes)}${(ch||who)?`<div class="impl-g">${ch}${who}</div>`:""}${im.note?`<p class="note">${SB.esc(im.note)}</p>`:""}${SB.srcLinks(im.src)}</div>`;
};
/* One freshness line in the masthead. */
SB.fresh=(iso,prefix)=>{
  const el=SB.$("updated");if(!el||!iso)return;
  try{
    const dateOnly=/^\d{4}-\d\d-\d\d$/.test(iso);
    const t=dateOnly?SB.dm(iso):new Intl.DateTimeFormat("en-GB",{timeZone:SB.TZ,weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit",hour12:true}).format(new Date(iso));
    el.textContent=(prefix||"Updated")+" "+t;el.hidden=false;
  }catch(e){}
};
/* How far each official source runs behind today. */
SB.clock=(id,sources)=>{
  SB.$(id).innerHTML=`<div class="clock">${(sources||[]).map(s=>{
    const lag=Math.max(0,SB.diff(s.latest,SB.today));
    const w=Math.min(100,lag/30*100);
    const lbl=lag===0?"Up to date":lag===1?"1 day behind":lag+" days behind";
    const nm=SB.official(s.u)?`<a href="${SB.esc(s.u)}" target="_blank" rel="noopener">${SB.esc(s.name)}</a>`:SB.esc(s.name);
    return `<div class="sc"><div class="sc-l"><b>${nm}</b><span>${SB.esc(s.gives)}</span></div><div class="sc-bar" role="img" aria-label="${SB.esc(s.name)}: ${SB.esc(lbl)}"><i style="width:${w}%"></i></div><div class="sc-v">${SB.esc(lbl)}<small>Latest ${SB.esc(SB.dm(s.latest))}</small></div></div>`;
  }).join("")}</div>`;
};
/* Upcoming key dates as a diary list. */
SB.diary=(id,keyDates,srcs,limit)=>{
  const up=(keyDates||[]).filter(k=>(k.end||k.date)>=SB.today).sort((a,b)=>a.date<b.date?-1:1).slice(0,limit||8);
  if(!up.length){SB.$(id).innerHTML=`<p class="empty">No dates announced yet.</p>`;return;}
  const cols=up.length<=3?up.length:up.length===4?2:3;
  SB.$(id).innerHTML=`<ol class="diary-l" style="--cols:${cols}">${up.map(x=>{
    const t=SB.tr(x.track);
    const when=x.end?`${SB.short(x.date)} to ${SB.short(x.end)}`:SB.F(x.date,{weekday:"long"});
    return `<li class="t-${t}"><time class="dd" datetime="${SB.esc(x.date)}"><b>${SB.esc(SB.F(x.date,{day:"numeric"}))}</b><span>${SB.esc(SB.F(x.date,{month:"short"}))}</span></time><div><p class="dy-t">${SB.esc(x.label)}</p><p class="dy-r">${SB.esc(when)} · ${SB.esc(SB.rel(x.date))}</p></div></li>`;
  }).join("")}</ol>${SB.srcLinks(srcs)}`;
};
/* Mark the current page in the navigation. */
const mark=()=>{
  const page=document.querySelector("[data-page]");
  if(!page)return;
  document.querySelectorAll(".nav a").forEach(a=>{if(a.dataset.p===page.dataset.page)a.setAttribute("aria-current","page")});
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mark);else mark();
})();
