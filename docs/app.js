'use strict';
const tasks = {
  charger_plug: {title:'Charger-plug insertion',description:'Precise alignment under constrained contact.',baseline:'Dream-Tac',baselineFile:'dream_tac',ablation:'Without tactile correction',ablationFile:'ablation_no_tactile_correction',rates:[80,55,35]},
  expansion_card: {title:'Expansion-card insertion',description:'Tight tolerances demand careful alignment throughout insertion.',baseline:'Dream-Tac',baselineFile:'dream_tac',ablation:'Without tactile correction',ablationFile:'ablation_no_tactile_correction',rates:[45,20,15]},
  potato_chip: {title:'Fragile potato-chip transfer',description:'Grip firmly enough to lift, gently enough to avoid breaking.',baseline:'T-Rex',baselineFile:'t_rex',ablation:'Without tactile prediction',ablationFile:'ablation_no_tactile_prediction',rates:[90,75,45]},
  empty_bottle: {title:'Empty-bottle uprighting',description:'Regulate grip and release so a lightweight bottle settles upright.',baseline:'Dream-Tac',baselineFile:'dream_tac',ablation:'Without tactile correction',ablationFile:'ablation_no_tactile_correction',rates:[40,25,20]},
  fruit_transfer: {title:'Multi-object fruit transfer',description:'Complete a long sequence of transfers while avoiding damage.',baseline:'T-Rex',baselineFile:'t_rex',ablation:'Without tactile prediction',ablationFile:'ablation_no_tactile_prediction',rates:[65,35,25]}
};
const results = [
  {name:'TacPAC (ours)',values:[80,65,90,40,45,64],ours:true},
  {name:'T-Rex',values:[65,35,75,30,35,48]},
  {name:'Dream-Tac',values:[55,40,85,25,20,45]},
  {name:'π₀.₅',values:[60,50,70,0,0,36]},
  {name:'LingBot-VA',values:[10,40,70,20,0,28]},
  {name:'VITaL',values:[30,20,55,5,0,22]},
  {name:'ACT',values:[0,0,0,0,0,0]}
];
const $ = (selector) => document.querySelector(selector);
const all = (selector) => [...document.querySelectorAll(selector)];
let activeTask='charger_plug';
let playGeneration=0;
const comparisonVideos=()=>all('#comparison-videos video');
function updatePlaybackButton(){const anyPlaying=comparisonVideos().some(v=>!v.paused&&!v.ended);$('#play-all').textContent=anyPlaying?'Ⅱ Pause all':'▶ Play all';}
function selectTask(key){
  if(!tasks[key])return;
  playGeneration++;
  comparisonVideos().forEach(v=>{v.pause();v.removeAttribute('src');v.load();});
  activeTask=key;
  const task=tasks[key];
  all('[data-task]').forEach(tab=>{const selected=tab.dataset.task===key;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
  $('#task-panel').setAttribute('aria-labelledby','tab-'+key);
  $('#task-title').textContent=task.title;
  $('#task-description').textContent=task.description;
  const methods=[{name:'TacPAC',file:'tacpac',outcome:'success',ours:true},{name:task.baseline,file:task.baselineFile,outcome:'failure'},{name:task.ablation,file:task.ablationFile,outcome:'failure'}];
  $('#comparison-videos').innerHTML=methods.map((m,i)=>{
    const stem=key+'__'+m.file+'__'+m.outcome;
    return `<article class="rollout ${m.ours?'ours':''}"><div class="rollout-heading"><h4>${m.name}</h4>${m.ours?'<span class="tag">OURS</span>':''}</div><video controls muted playsinline preload="none" poster="assets/${stem}.webp" src="assets/videos/${stem}.mp4" aria-label="${task.title}: ${m.name}, selected ${m.outcome} rollout"></video><div class="rollout-footer"><span class="outcome">Selected ${m.outcome}</span><div class="rollout-rate"><strong>${task.rates[i]}%</strong>success rate</div></div></article>`;
  }).join('');
  comparisonVideos().forEach(video=>{video.playbackRate=Number($('#playback-speed').value);['play','pause','ended'].forEach(event=>video.addEventListener(event,updatePlaybackButton));video.addEventListener('error',()=>{$('#playback-status').classList.remove('sr-only');$('#playback-status').textContent='A video could not load. Please reload the page or try its native play control.';});});
  $('#play-all').disabled=false;
  updatePlaybackButton();
}
all('[data-task]').forEach((button,i,tabs)=>{
  button.addEventListener('click',()=>selectTask(button.dataset.task));
  button.addEventListener('keydown',event=>{
    let target;
    if(event.key==='ArrowRight')target=tabs[(i+1)%tabs.length];
    if(event.key==='ArrowLeft')target=tabs[(i-1+tabs.length)%tabs.length];
    if(event.key==='Home')target=tabs[0];
    if(event.key==='End')target=tabs[tabs.length-1];
    if(target){event.preventDefault();target.focus();selectTask(target.dataset.task);}
  });
});
all('[data-select-task]').forEach(link=>link.addEventListener('click',()=>selectTask(link.dataset.selectTask)));
$('#play-all').addEventListener('click',async()=>{
  const videos=comparisonVideos();
  if(videos.some(v=>!v.paused&&!v.ended)){videos.forEach(v=>v.pause());return;}
  const generation=++playGeneration;
  $('#play-all').disabled=true;
  $('#play-all').textContent='Loading…';
  if(videos.every(v=>v.ended))videos.forEach(v=>v.currentTime=0);
  const outcomes=await Promise.allSettled(videos.filter(v=>!v.ended).map(v=>v.play()));
  if(generation!==playGeneration)return;
  $('#play-all').disabled=false;
  updatePlaybackButton();
  if(outcomes.some(x=>x.status==='rejected')){$('#playback-status').classList.remove('sr-only');$('#playback-status').textContent='Use the play control on an individual video if your browser blocks group playback.';}
});
$('#restart-all').addEventListener('click',()=>{playGeneration++;comparisonVideos().forEach(v=>{v.pause();v.currentTime=0;});$('#play-all').disabled=false;updatePlaybackButton();$('#playback-status').textContent='All three rollouts reset to the beginning.';});
$('#playback-speed').addEventListener('change',()=>comparisonVideos().forEach(v=>v.playbackRate=Number($('#playback-speed').value)));
selectTask(activeTask);
$('#results-table').innerHTML=results.map(r=>`<tr class="${r.ours?'ours':''}"><th scope="row">${r.name}</th>${r.values.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('');
let pendingDemoTime=null;
const demoVideo=$('#demo-video');
demoVideo.addEventListener('loadedmetadata',()=>{if(pendingDemoTime!==null){demoVideo.currentTime=pendingDemoTime;pendingDemoTime=null;}});
all('[data-time]').forEach(button=>button.addEventListener('click',()=>{
  const time=Number(button.dataset.time);
  if(demoVideo.readyState>=1){demoVideo.currentTime=time;}else{pendingDemoTime=time;}
  demoVideo.play().catch(()=>{});
}));
$('#copy-citation').addEventListener('click',async()=>{
  const text=$('#bibtex').textContent;
  try{await navigator.clipboard.writeText(text);$('#copy-citation').textContent='Copied ✓';$('#copy-status').textContent='Citation copied to clipboard.';setTimeout(()=>{$('#copy-citation').innerHTML='Copy citation <span aria-hidden="true">⧉</span>';},2200);}catch{const selection=window.getSelection();const range=document.createRange();range.selectNodeContents($('#bibtex'));selection.removeAllRanges();selection.addRange(range);$('#copy-status').textContent='Citation selected. Press Control+C or Command+C to copy.';$('#copy-status').classList.remove('sr-only');}
});
const dialog=$('#figure-dialog');
all('[data-figure]').forEach(button=>button.addEventListener('click',()=>{$('#expanded-figure').src=button.dataset.figure;$('#expanded-figure').alt=button.querySelector('img').alt;$('#expanded-caption').textContent=button.dataset.caption;dialog.showModal();}));
$('#close-figure').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();}});
const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){all('.site-header nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+entry.target.id));}});},{rootMargin:'-15% 0px -65% 0px'});
all('section[id]').forEach(section=>observer.observe(section));
document.addEventListener('visibilitychange',()=>{if(document.hidden)all('video').forEach(v=>v.pause());});
