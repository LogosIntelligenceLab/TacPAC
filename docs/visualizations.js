'use strict';
(() => {
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const taskNames = ['Plug','Fruit','Chip','Bottle','Card','Average'];
  const methodColors = ['#2f6a59','#54869a','#d29858','#8c80a6','#92aaa2','#c0bda3','#c8cfcb'];
  const phaseNames = ['Pre-contact','Contact transition','Sustained contact','Post-contact'];
  const phaseColors = ['#cfd8de','#e8a44f','#a9cbd8','#d8d2c6'];
  const componentRows = [
    {name:'Vision only',short:'Vision only',paths:[false,false,null],values:[15,30,60,5,0,22]},
    {name:'Without tactile prediction',short:'No prediction',paths:[false,true,false],values:[40,25,45,30,25,33]},
    {name:'Without tactile correction',short:'No correction',paths:[true,false,null],values:[35,50,65,20,15,37]},
    {name:'Without tactile cache',short:'No tactile cache',paths:[true,true,false],values:[40,50,75,40,30,47]},
    {name:'TacPAC (full)',short:'TacPAC',paths:[true,true,true],values:[80,65,90,40,45,64],ours:true}
  ];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const svgText = (x,y,value,cls='',anchor='start') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${escape(value)}</text>`;
  const line = (x1,y1,x2,y2,cls='gridline',extra='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" ${extra}/>`;
  const tooltip = document.createElement('div'); tooltip.className='chart-tip';tooltip.hidden=true;tooltip.id='chart-tooltip';tooltip.setAttribute('role','tooltip');document.body.appendChild(tooltip);
  function attachTooltips(container){
    container.querySelectorAll('[data-tip]').forEach(el=>{
      const show = event => {tooltip.textContent=el.dataset.tip;tooltip.hidden=false;el.setAttribute('aria-describedby','chart-tooltip');const b=el.getBoundingClientRect();const x=event?.clientX??b.x+b.width/2,y=event?.clientY??b.y;tooltip.style.left=Math.max(8,Math.min(x+12,window.innerWidth-tooltip.offsetWidth-10))+'px';tooltip.style.top=Math.max(8,Math.min(y-50,window.innerHeight-tooltip.offsetHeight-10))+'px';};
      const hide=()=>{tooltip.hidden=true;el.removeAttribute('aria-describedby');};
      el.addEventListener('pointerenter',show);el.addEventListener('pointermove',show);el.addEventListener('pointerleave',hide);el.addEventListener('focus',show);el.addEventListener('blur',hide);el.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
    });
  }
  window.addEventListener('scroll',()=>tooltip.hidden=true,{passive:true});
  function barMarkup(name,value,ours,max=100,suffix='%'){
    const tip=escape(`${name}: ${value}${suffix}`);
    return `<div class="bar-row ${ours?'ours':''}"><span class="bar-label">${escape(name)}</span><div class="bar-track"><div class="bar-fill" style="width:${value/max*100}%" tabindex="0" role="img" aria-label="${tip}" data-tip="${tip}"></div></div><span class="bar-value">${value}${suffix}</span></div>`;
  }
  // Teaser evidence uses the embedded photographs in the supplied editable PDF.
  qa('[data-teaser]').forEach(button=>button.addEventListener('click',()=>{
    const chip=button.dataset.teaser==='chip';
    const pictures=chip?['teaser-chip-failure','teaser-touch-failure','teaser-chip-success','teaser-touch-success']:['teaser-plug-failure','teaser-plug-touch-failure','teaser-plug-success','teaser-plug-touch-success'];
    ['fail-visual','fail-touch','success-visual','success-touch'].forEach((id,i)=>{const img=q('#teaser-'+id);img.src='assets/diagrams/'+pictures[i]+'.webp';img.alt=`${chip?'Fragile-object grasp':'Charger-plug insertion'}, ${i<2?'failed ablation':'successful TacPAC'} ${i%2?'tactile frame':'camera frame'}`;});
    q('#teaser-ablation').textContent=chip?'Without tactile prediction':'Without tactile correction';
    qa('[data-teaser]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  }));
  function syncTeaserMotion(){const moving=!reducedMotion.matches&&!document.hidden&&q('#teaser').classList.contains('in-view');q('#teaser').classList.toggle('motion-paused',!moving);q('.concept-svg')[moving?'unpauseAnimations':'pauseAnimations']();}
  syncTeaserMotion();
  // Explicit sequential steps make the architecture readable without animation.
  const flowSteps=[
    ['Predict and plan together.','The video and action experts jointly generate future visual and tactile observations and an action chunk through shared self-attention.'],
    ['Cache what the plan expects.','One clean prefill pass records the predicted tactile and action keys and values at every layer. This cache is reused for the whole chunk.'],
    ['Read the newest touch against the cache.','At offset m, the tactile expert attends to current tactile tokens and the cached prediction and plan. The base model does not need to run again.'],
    ['Correct only what can still change.','The expert predicts delta actions. Add them to the planned actions from m + d to H; executed actions and commands committed during latency stay fixed.']
  ];
  // A moving contact signal follows each existing wire, including its bends.
  const pipelineSVG=q('#pipeline-svg');
  qa('#pipeline-svg .flow-wire').forEach((wire,index)=>{
    wire.id=`pipeline-wire-${index}`;
    const packet=document.createElementNS('http://www.w3.org/2000/svg','g');
    packet.setAttribute('class','flow-packet');packet.setAttribute('aria-hidden','true');
    const duration=Math.max(1.35,Math.min(4.2,wire.getTotalLength()/100));
    packet.innerHTML=`<circle r="7" class="flow-packet-halo"/><circle r="3.3" class="flow-packet-core"/><animateMotion dur="${duration.toFixed(2)}s" repeatCount="indefinite" begin="indefinite"><mpath href="#${wire.id}"/></animateMotion>`;
    wire.after(packet);
  });
  let flowStep=0,flowTimer=null;
  function syncPipelineMotion(){
    const moving=!reducedMotion.matches&&!document.hidden&&q('#pipeline').classList.contains('in-view');
    q('#pipeline').classList.toggle('motion-paused',!moving);
    q('.flow-explanation').setAttribute('aria-live',reducedMotion.matches?'polite':'off');
    pipelineSVG[moving?'unpauseAnimations':'pauseAnimations']();
    clearTimeout(flowTimer);
    // Every selected or newly visible step gets its full reading time.
    if(moving)flowTimer=setTimeout(()=>{setFlow((flowStep+1)%4);syncPipelineMotion();},4500);
  }
  function setFlow(step){flowStep=step;qa('[data-flow-step]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.flowStep)===step)));qa('[data-flow]').forEach(g=>{g.classList.toggle('is-active',Number(g.dataset.flow)===step);g.classList.toggle('is-complete',Number(g.dataset.flow)<step);if(Number(g.dataset.flow)===step)g.querySelectorAll('animateMotion').forEach(a=>a.beginElement());});q('#flow-number').textContent=String(step+1).padStart(2,'0');q('#flow-title').textContent=flowSteps[step][0];q('#flow-description').textContent=flowSteps[step][1];}
  qa('[data-flow-step]').forEach(b=>b.addEventListener('click',()=>{setFlow(Number(b.dataset.flowStep));syncPipelineMotion();}));
  setFlow(0);syncPipelineMotion();
  // Execution timing uses the paper's horizon. d is an illustrative, user-controlled window.
  let inferencePhase=0;
  function renderTimeline(){
    const m=+q('#offset-slider').value,d=Math.min(+q('#latency-slider').value,48-m),boundary=m+d;
    q('#latency-slider').max=String(Math.min(8,48-m));q('#latency-slider').value=d;q('#offset-value').value=m;q('#latency-value').value=d;
    q('#action-timeline').innerHTML=Array.from({length:48},(_,i)=>`<span class="action-cell ${i<m?'executed':i<boundary?'latency':'future'} ${i===m?'at-offset':''} ${inferencePhase===2&&i>=boundary?'corrected':''}" title="Action ${i}: ${i<m?'already executed':i<boundary?'committed during latency':'eligible for correction'}"></span>`).join('');
    q('#action-timeline').setAttribute('aria-label',`48 actions: ${m} executed, ${d} committed during latency, ${48-boundary} eligible for correction.`);
    q('#timeline-m').style.left=`${Math.max(9,m/48*100)}%`;q('#timeline-m').textContent=`m = ${m}`;
    q('#timeline-boundary').style.left=`${Math.min(76,boundary/48*100)}%`;q('#timeline-boundary').textContent=`m + d = ${boundary}`;
    q('#correction-count').innerHTML=`${48-boundary}<span> / 48 actions</span>`;
    const descriptions=[`${48-m} actions remain; the correction can update ${48-boundary} actions after the ${d}-step latency window.`,`Computing from touch at m = ${m}. The robot continues executing ${d} committed ${d===1?'action':'actions'}.`,boundary===48?'The latency window reaches H. No remaining actions can be corrected in this chunk.':`Correction applied to actions ${boundary}–47. The first ${boundary} committed actions stay fixed.`];
    q('#inference-status').textContent=descriptions[inferencePhase];
  }
  ['#offset-slider','#latency-slider'].forEach(id=>q(id).addEventListener('input',()=>{inferencePhase=0;renderTimeline();}));
  setInterval(()=>{if(reducedMotion.matches||document.hidden||!q('#inference').classList.contains('in-view'))return;inferencePhase=(inferencePhase+1)%3;if(inferencePhase===0){const m=+q('#offset-slider').value;q('#offset-slider').value=m>=40?0:m+4;}renderTimeline();},1600);renderTimeline();
  // Figure 4: original success rates, always on a 0–100% scale.
  q('#method-highlight').innerHTML+=results.map((r,i)=>`<option value="${i}">${escape(r.name)}</option>`).join('');
  q('#main-legend').innerHTML=results.map((r,i)=>`<span><i style="--color:${methodColors[i]}"></i>${escape(r.name)}</span>`).join('');
  function renderMain(){
    const selected=q('#method-highlight').value,w=1060,h=365,left=52,top=26,plotH=258,base=top+plotH,groupW=162;
    let body=svgText(left,13,'Episode success rate (%)','axis-title');
    [0,20,40,60,80,100].forEach(v=>{const y=base-v/100*plotH;body+=line(left,y,w-18,y)+svgText(left-12,y+4,v,'','end');});
    taskNames.forEach((name,t)=>{
      const gx=left+t*groupW+14;if(t===5)body+=`<rect x="${gx-5}" y="18" width="154" height="304" fill="#f0f5ec" rx="5"/>`;
      results.forEach((r,i)=>{const value=r.values[t],bh=value/100*plotH,x=gx+i*19,y=base-bh,tip=`${name} · ${r.name}: ${value}%${t<5?` (${value/5}/20 trials)`:''}`;body+=`<g opacity="${selected==='all'||+selected===i?1:.2}"><rect class="chart-bar" x="${x}" y="${value?y:base-1}" width="14" height="${Math.max(1,bh)}" rx="2" fill="${methodColors[i]}" tabindex="0" role="img" aria-label="${escape(tip)}" data-tip="${escape(tip)}" style="animation-delay:${t*.05+i*.025}s"><title>${escape(tip)}</title></rect>${(selected==='all'&&i===0)||String(i)===selected?svgText(x+7,y-9,value,'value-label','middle'):''}</g>`;});
      body+=svgText(gx+64,base+27,name,'','middle');
    });
    q('#main-results-chart').innerHTML=`<svg class="data-chart" viewBox="0 0 ${w} ${h}" role="group" aria-label="Per-task and average success rates for seven methods">${body}</svg>`;attachTooltips(q('#main-results-chart'));
  }
  q('#method-highlight').addEventListener('change',renderMain);renderMain();
  const pathCell=v=>v===null?'<td aria-label="No corrector">–</td>':`<td class="${v?'pathway-yes':'pathway-no'}" aria-label="${v?'Enabled':'Removed'}">${v?'✓':'×'}</td>`;
  q('#pathway-table').innerHTML=`<table><thead><tr><th scope="col">Variant</th><th scope="col">Predict</th><th scope="col">Correct</th><th scope="col">Tac. cache</th></tr></thead><tbody>${componentRows.map(r=>`<tr><th scope="row">${r.short}</th>${r.paths.map(pathCell).join('')}</tr>`).join('')}</tbody></table>`;
  q('#ablation-table').innerHTML=componentRows.map(r=>`<tr class="${r.ours?'ours':''}"><th scope="row">${r.name}</th>${r.paths.map(pathCell).join('')}${r.values.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('');
  function renderAblations(){const t=+q('#ablation-task').value;q('#ablation-chart').innerHTML=componentRows.map(r=>barMarkup(r.name,r.values[t],r.ours)).join('');q('#ablation-chart').setAttribute('aria-label',`Component ablation: ${taskNames[t]} success rate`);attachTooltips(q('#ablation-chart'));}
  q('#ablation-task').addEventListener('change',renderAblations);renderAblations();
  // Figure 5: recover bars and their published error geometry, with explicit provenance.
  let phaseHighlight=-1;
  q('#phase-legend').innerHTML='<button data-phase="-1" aria-pressed="true">All phases</button>'+phaseNames.map((n,i)=>`<button data-phase="${i}" aria-pressed="false"><i style="--color:${phaseColors[i]}"></i>${n}</button>`).join('');
  function phaseChart(kind){
    const data=phaseData[kind],w=510,h=300,left=43,top=25,base=255,ph=230,max=kind==='change'?8:75,ticks=kind==='change'?[0,1,2,4,6,8]:[0,25,50,75];let body='';
    ticks.forEach(v=>{const y=base-v/max*ph;body+=line(left,y,w-5,y)+svgText(left-9,y+4,kind==='change'?v:v+'%','','end');});
    if(kind==='change')body+=line(left,base-ph/max,w-5,base-ph/max,'','stroke="#82958b" stroke-dasharray="4 4"');
    taskNames.slice(0,5).forEach((name,t)=>{const gx=left+13+t*92;phaseNames.forEach((phase,i)=>{const d=data.find(v=>v.task===t&&v.phase===i),x=gx+i*17,bh=d.value/max*ph,y=base-bh,err=d.error/max*ph,tip=`${name} · ${phase}: ≈${d.value.toFixed(kind==='change'?2:1)}${kind==='change'?' × episode mean':'% of frames'}; published error-bar extent ≈±${d.error.toFixed(2)}`;body+=`<g opacity="${phaseHighlight<0||phaseHighlight===i?1:.2}"><rect class="chart-bar" x="${x}" y="${y}" width="14" height="${bh}" rx="1" fill="${phaseColors[i]}" stroke="#73827d" stroke-width=".5" tabindex="0" role="img" aria-label="${escape(tip)}" data-tip="${escape(tip)}"><title>${escape(tip)}</title></rect><path d="M${x+7} ${y-err}V${y+err}M${x+4} ${y-err}H${x+10}M${x+4} ${y+err}H${x+10}" fill="none" stroke="#53645c" stroke-width="1"/></g>`;});body+=svgText(gx+31,base+23,name,'','middle');});
    return `<svg class="data-chart" viewBox="0 0 ${w} ${h}" role="group" aria-label="${kind==='change'?'Relative tactile change':'Share of episode frames'} by task and execution phase; digitized approximate values">${body}</svg>`;
  }
  function renderPhases(){q('#phase-change-chart').innerHTML=phaseChart('change');q('#phase-frames-chart').innerHTML=phaseChart('frames');attachTooltips(q('#phase-results'));}
  qa('[data-phase]').forEach(b=>b.addEventListener('click',()=>{phaseHighlight=+b.dataset.phase;qa('[data-phase]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderPhases();}));renderPhases();
  q('#phase-data-table').innerHTML=`<table><caption>Figure 5 digitized values (approximate). Error extents are in the downloadable data.</caption><thead><tr><th scope="col">Task</th><th scope="col">Phase</th><th scope="col">Relative change</th><th scope="col">Frames (%)</th></tr></thead><tbody>${taskNames.slice(0,5).map((n,t)=>phaseNames.map((p,i)=>`<tr><th scope="row">${n}</th><td>${p}</td><td>≈${phaseData.change.find(d=>d.task===t&&d.phase===i).value.toFixed(2)}</td><td>≈${phaseData.frames.find(d=>d.task===t&&d.phase===i).value.toFixed(1)}</td></tr>`).join('')).join('')}</tbody></table>`;
  // Table 2: a common linear scale retains the true speed difference.
  const efficiency=[{name:'Chunk generation',latency:628.6,rate:1.59},{name:'Cache prefill',latency:62.6,rate:15.97},{name:'Tactile correction',latency:30.4,rate:32.90}];
  function renderEfficiency(metric){const max=metric==='latency'?700:35,unit=metric==='latency'?'ms':'Hz';q('#efficiency-chart').innerHTML=efficiency.map(d=>{const value=`${d[metric].toFixed(metric==='latency'?1:2)} ${unit}`,tip=escape(`${d.name}: ${value}`);return `<div class="efficiency-row"><div class="efficiency-label"><span>${d.name}</span><strong>${value}</strong></div><div class="efficiency-track"><i style="--value:${d[metric]/max*100}%" tabindex="0" role="img" aria-label="${tip}" data-tip="${tip}"></i></div></div>`;}).join('')+`<p class="chart-footnote">Linear scale: 0–${max} ${unit}. ${metric==='latency'?'Lower is better.':'Higher is better.'}</p>`;qa('[data-latency-metric]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.latencyMetric===metric)));attachTooltips(q('#efficiency-chart'));}
  qa('[data-latency-metric]').forEach(b=>b.addEventListener('click',()=>renderEfficiency(b.dataset.latencyMetric)));renderEfficiency('latency');
  // Supplement: native SVG paths retain every segment from the published traces.
  const criteria={charger_plug:'Figure 7 · Success: the plug is seated in the target outlet.',fruit_transfer:'Figure 8 · Success: all three fruits reach the tray without visible damage.',potato_chip:'Figure 9 · Success: the chip reaches the target plate without visible damage.',empty_bottle:'Figure 10 · Success: the bottle remains stably upright after release.',expansion_card:'Figure 11 · Success: the card is seated in the target slot.'};
  let currentTrace=executionTraces[0];
  const tx=v=>70+v*920,ty=v=>40+v*220;
  function traceDuration(){const ticks=currentTrace.ticks.x;const a=ticks[0],b=ticks[ticks.length-1];return (+b[1]- +a[1])/(b[0]-a[0]);}
  function traceCursor(){const f=+q('#trace-cursor').value/1000,el=q('#trace-moving-cursor');if(el)el.setAttribute('transform',`translate(${tx(f)},0)`);q('#trace-readout').value=(f*traceDuration()).toFixed(1)+' s';}
  function renderTrace(){currentTrace=executionTraces.find(t=>t.key===q('#trace-task').value);const t=currentTrace;
    q('#trace-visual').src=`assets/diagrams/trace-${t.key}-visual.webp`;q('#trace-visual').alt=`Six visual observations from a separate successful ${tasks[t.key].title} rollout`;q('#trace-tactile').src=`assets/diagrams/trace-${t.key}-tactile.webp`;q('#trace-criterion').textContent=criteria[t.key];
    let body='<defs><clipPath id="trace-plot-clip"><rect x="70" y="40" width="920" height="220"/></clipPath></defs>';
    body+=svgText(70,19,'Tactile activity cₜ','axis-title')+svgText(990,19,'Gripper width (mm)','axis-title','end');
    body+=`<g clip-path="url(#trace-plot-clip)">${t.phases.map(d=>`<rect x="${tx(d.x)}" y="40" width="${d.w*920+0.5}" height="220" fill="${d.color}" opacity=".55"/>`).join('')}`;
    const path=points=>points.map((p,i)=>(i?'L':'M')+tx(p[0]).toFixed(2)+' '+ty(p[1]).toFixed(2)).join('');
    body+=`<path class="trace-path" d="${path(t.activity)}" stroke="#22404f"/><path class="trace-path" d="${path(t.width)}" stroke="#a64b2a" stroke-width="2"/></g>`;
    t.ticks.x.forEach(([v,label])=>{body+=line(tx(v),260,tx(v),266,'','stroke="#88958e"')+svgText(tx(v),285,label,'','middle');});
    t.ticks.left.forEach(([v,label])=>{body+=svgText(59,ty(v)+4,label,'','end');});t.ticks.right.forEach(([v,label])=>{body+=svgText(1001,ty(v)+4,label);});
    body+=svgText(530,316,'Time (s)','axis-title','middle')+`<g id="trace-moving-cursor" transform="translate(70,0)"><line x1="0" x2="0" y1="35" y2="264" class="trace-cursor-line"/><path d="M-5 29H5L0 37Z" fill="#173e40"/></g>`;
    q('#execution-trace-chart').innerHTML=`<svg class="data-chart" viewBox="0 0 1060 328" role="img" aria-label="Figure ${t.figure}, ${tasks[t.key].title}: tactile activity and measured gripper width during a representative training episode">${body}</svg>`;q('#trace-cursor').value=0;traceCursor();
  }
  q('#trace-task').addEventListener('change',renderTrace);q('#trace-cursor').addEventListener('input',traceCursor);
  setInterval(()=>{if(reducedMotion.matches||document.hidden||!q('#trace-results').classList.contains('in-view'))return;const current=+q('#trace-cursor').value;q('#trace-cursor').value=current>=1000?0:Math.min(1000,current+3);traceCursor();},35);renderTrace();
  // Pause offscreen work and honor the OS motion preference.
  const visibleObserver=new IntersectionObserver(entries=>{entries.forEach(e=>{e.target.classList.toggle('in-view',e.isIntersecting);if(e.isIntersecting)e.target.classList.add('has-entered');if(e.target.id==='teaser')syncTeaserMotion();if(e.target.id==='pipeline')syncPipelineMotion();});},{threshold:0});
  qa('.interactive-figure,.native-teaser,.result-panel').forEach(el=>visibleObserver.observe(el));
  reducedMotion.addEventListener('change',()=>{syncTeaserMotion();syncPipelineMotion();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)tooltip.hidden=true;syncTeaserMotion();syncPipelineMotion();});
})();
