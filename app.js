(() => {
  'use strict';
  const DATA = window.STORYWORDS;
  const main = document.getElementById('main');
  if (!DATA || DATA.stories.length !== 100) {
    main.innerHTML = '<div class="page empty-state"><h1>故事暂时未能加载</h1><p>请检查网络并刷新页面。首次打开需要加载故事文件。</p><button onclick="location.reload()">重新加载</button></div>';
    return;
  }
  const stories = DATA.stories;
  const byId = new Map(stories.map(s => [s.id, s]));
  const vocabulary = new Set(stories.flatMap(s => s.words.map(w => w[0].toLowerCase())));
  const STORE_KEY = 'storywords:v1';
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const regexEsc = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keyOf = word => word.toLowerCase().trim();
  const wordIndex = new Map();
  for (const story of stories) for (const [word,meaning] of story.words) {
    const key=keyOf(word);
    if(!wordIndex.has(key))wordIndex.set(key,{word,meaning,storyId:story.id});
  }
  const num = n => Number(n).toLocaleString('en-US');
  const pad = n => String(n).padStart(2, '0');
  const paths = {
    book:'M4 3h6c2 0 2 1 2 2 0-1 0-2 2-2h6v16h-6c-2 0-2 1-2 2 0-1 0-2-2-2H4V3z M12 5v16',
    bookmark:'M6 3h12v18l-6-4-6 4V3z',
    check:'M5 12l4 4L19 6',
    arrow:'M5 12h14m-5-5 5 5-5 5',
    left:'M19 12H5m5-5-5 5 5 5',
    search:'M21 21l-5-5m-5 2a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
    volume:'M11 5 6 9H3v6h3l5 4V5z M15 8c3 2 3 6 0 8 M18 5c5 4 5 10 0 14',
    moon:'M20 14A8 8 0 0 1 10 4 9 9 0 1 0 20 14z',
    sun:'M12 3V1m0 22v-2M3 12H1m22 0h-2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
    clock:'M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
    shuffle:'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 5-6m3-4c1-1 2-2 4-2h3m-4-4 4 4-4 4',
    close:'M6 6l12 12M6 18 18 6',
    download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    upload:'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
    leaf:'M20 3C6 2 0 10 7 17s15-1 13-14z M5 20 16 9',
    target:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z M12 11v2',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.book}"/></svg>`;
  function freshState() { return {version:1, progress:{}, saved:{}, mastered:[], activity:{}, lastStory:1, settings:{theme:'light', font:19, mode:'learn'}}; }
  function validState(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== 1) throw new Error('不支持的备份格式');
    const next = freshState();
    if (raw.settings && typeof raw.settings === 'object') {
      next.settings = {theme:raw.settings.theme === 'dark' ? 'dark':'light', font:Math.min(25,Math.max(16,Number(raw.settings.font)||19)), mode:['learn','review','read'].includes(raw.settings.mode)?raw.settings.mode:'learn'};
    }
    next.lastStory = byId.has(Number(raw.lastStory)) ? Number(raw.lastStory) : 1;
    for (const [id,p] of Object.entries(raw.progress || {})) {
      if (!byId.has(Number(id)) || !p || typeof p !== 'object') continue;
      next.progress[id] = {done:p.done === true, paragraph:Math.min(byId.get(Number(id)).paragraphs.length-1,Math.max(0,Number(p.paragraph)||0)), lastReadAt:Number(p.lastReadAt)||0, startedAt:Number(p.startedAt)||0};
    }
    for (const entry of Object.values(raw.saved || {})) {
      if (!entry || typeof entry.word !== 'string' || !vocabulary.has(keyOf(entry.word)) || !byId.has(Number(entry.storyId))) continue;
      const source = byId.get(Number(entry.storyId));
      const original = source.words.find(w => keyOf(w[0]) === keyOf(entry.word));
      if (original) next.saved[keyOf(original[0])] = {word:original[0], meaning:original[1], storyId:source.id, addedAt:Number(entry.addedAt)||Date.now()};
    }
    next.mastered = [...new Set((Array.isArray(raw.mastered)?raw.mastered:[]).filter(w=>typeof w==='string' && vocabulary.has(w.toLowerCase())).map(w=>w.toLowerCase()))].filter(w=>!next.saved[w]);
    for (const [date,a] of Object.entries(raw.activity || {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && a && typeof a==='object') next.activity[date] = {stories:[...new Set((Array.isArray(a.stories)?a.stories:[]).filter(id=>byId.has(id)))], reviews:Math.max(0,Number(a.reviews)||0)};
    }
    return next;
  }
  let state = freshState();
  let persistenceAvailable = true;
  try { const raw = localStorage.getItem(STORE_KEY); if(raw) state = validState(JSON.parse(raw)); } catch { persistenceAvailable = false; }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); persistenceAvailable = true; }
    catch { if(persistenceAvailable) toast('浏览器无法保存记录，请导出备份后再关闭页面。'); persistenceAvailable = false; }
    const badge = $('#savedBadge'); const count = Object.keys(state.saved).length;
    badge.textContent = num(count); badge.hidden = count === 0;
    $('.save-status').innerHTML = `<i></i>${persistenceAvailable?'本地保存':'暂未保存'}`;
  }
  let toastTimer;
  function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),3200); }
  function applySettings() {
    document.documentElement.dataset.theme=state.settings.theme;
    document.documentElement.style.setProperty('--reading-size',state.settings.font+'px');
    const toggle=$('#themeToggle'); toggle.innerHTML=icon(state.settings.theme==='dark'?'sun':'moon');
    toggle.setAttribute('aria-label',state.settings.theme==='dark'?'切换浅色模式':'切换深色模式');toggle.title=toggle.getAttribute('aria-label');
  }
  function today() { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function activity(review=false,storyId=null) { const day=today(); state.activity[day] ||= {stories:[],reviews:0}; if(review)state.activity[day].reviews++; if(storyId && !state.activity[day].stories.includes(storyId))state.activity[day].stories.push(storyId); }
  const doneCount=()=>Object.values(state.progress).filter(p=>p.done).length;
  function plainText(text) { return text.replace(/（[^（）]*）/g,''); }
  const storyPattern = story => new RegExp('(?<![A-Za-z])('+[...new Set(story.words.map(w=>w[0]))].sort((a,b)=>b.length-a.length).map(regexEsc).join('|')+')（([^（）]+)）','gi');
  function tokenize(story,text) {
    const re=storyPattern(story); const pieces=[]; let index=0;
    for(const match of text.matchAll(re)){ if(match.index>index)pieces.push({text:text.slice(index,match.index)}); pieces.push({word:match[1],meaning:match[2],key:keyOf(match[1])}); index=match.index+match[0].length; }
    if(index<text.length)pieces.push({text:text.slice(index)}); return pieces;
  }
  function searchBox(id,placeholder,value='') { return `<label class="search-box">${icon('search')}<input id="${id}" type="search" placeholder="${placeholder}" aria-label="${placeholder}" value="${esc(value)}" autocomplete="off"></label>`; }
  const palettes=[['#e8ecdf','#718263'],['#ece7df','#9a8065'],['#e4eae5','#729083'],['#eae5e6','#927580'],['#e7e8dc','#8b8d67'],['#e3e8eb','#758693']];
  let filter='all',query='',page=1,notebookQuery='',notebookPage=1,notebookView='saved',hideNotebookMeanings=false;
  function storyCard(s) {
    const progress=state.progress[s.id]; const palette=palettes[Math.floor((s.id-1)/10)%palettes.length];
    return `<a class="story-card" href="#story/${s.id}" aria-label="阅读第 ${s.id} 篇：${esc(s.title)}" style="--card-bg:${palette[0]};--card-ink:${palette[1]}">
      ${progress?.done?`<span class="card-complete">${icon('check')} 已读完</span>`:''}
      <div class="card-top"><span class="card-number">${pad(s.id)}</span><span class="card-collection">STORY COLLECTION<span>VOL. ${pad(Math.floor((s.id-1)/10)+1)}</span></span><i class="card-art" aria-hidden="true"></i></div>
      <div class="card-body"><h3>${esc(s.title)}</h3><p>${esc(plainText(s.paragraphs[0]))}</p><div class="word-tags">${s.words.slice(0,3).map(w=>`<span>${esc(w[0])}</span>`).join('')}</div></div>
      <div class="card-bottom"><span>${s.words.length} 个重点词 <span aria-hidden="true">·</span> 约 ${s.minutes} 分钟</span><span class="card-action">${progress?.done?'再读一遍':progress?'继续阅读':'开始阅读'} ${icon('arrow')}</span></div></a>`;
  }
  function pagination(current,total,prefix) { if(total<=1)return ''; return `<div class="pagination"><button data-action="${prefix}-page" data-page="${current-1}" ${current===1?'disabled':''}>${icon('left')} 上一页</button><span>${current} / ${total}</span><button data-action="${prefix}-page" data-page="${current+1}" ${current===total?'disabled':''}>下一页 ${icon('arrow')}</button></div>`; }
  function library() {
    document.title='词境 · 让单词有故事可讲';
    const last=byId.get(state.lastStory)||stories[0];
    const hasStarted=Object.keys(state.progress).length>0;
    main.innerHTML=`<div class="page library-page"><section class="hero"><div><span class="eyebrow">A LITTLE STORY. A LASTING WORD.</span><h1>让单词，<br>有<em>故事</em>可讲。</h1><p>读一段故事，记住一种表达。<br>100 个故事，把单词放回有温度的语境里。</p><a class="button primary" href="#story/${hasStarted?last.id:1}">${icon('book')} ${hasStarted?'继续我的阅读':'翻开第一个故事'} ${icon('arrow')}</a></div><div class="hero-art" aria-hidden="true"><i class="art-orbit"></i><div class="art-book"><span>Words<br>& Stories</span><small>ONE STORY AT A TIME</small></div><span class="art-note">encounter <small>遇见</small></span><span class="art-star">✧</span><span class="art-small">READ · REMEMBER</span></div></section>
      <section class="stats-row" aria-label="书架概览">${[[100,'篇','精选故事','book'],[DATA.uniqueWords,'个','收录词汇（去重）','leaf'],[doneCount(),'篇','已读完故事','check'],[Object.keys(state.saved).length,'个','我的生词','bookmark']].map(([v,u,l,i])=>`<div class="stat"><span class="stat-icon">${icon(i)}</span><div><strong>${num(v)}<small>${u}</small></strong><label>${l}</label></div></div>`).join('')}</section>
      ${hasStarted?`<section class="continue-strip"><span>${icon('clock')}<small>上次读到</small>${pad(last.id)} · ${esc(last.title)}</span><a class="button" href="#story/${last.id}">继续阅读 ${icon('arrow')}</a></section>`:''}
      <section aria-labelledby="libraryTitle"><div class="section-heading"><h2 id="libraryTitle">故事书架<small>THE STORY LIBRARY</small></h2><button class="text-button" data-action="random">${icon('shuffle')} 随机遇见一篇</button></div>
      <div class="library-controls"><div class="tabs" role="group" aria-label="筛选故事">${[['all','全部故事',100],['reading','在读',Object.values(state.progress).filter(p=>!p.done).length],['done','已读完',doneCount()]].map(([v,l,c])=>`<button data-action="filter" data-filter="${v}" class="${filter===v?'active':''}" aria-pressed="${filter===v}">${l}<small>${c}</small></button>`).join('')}</div>${searchBox('storySearch','搜索故事、编号、英文单词或词义',query)}</div>
      <div id="libraryResults"></div></section></div>`;
    libraryResults();
  }
  function libraryResults(){
    const needle=query.trim().toLowerCase();
    let matches=stories.filter(s=>filter==='all'||(filter==='done'?state.progress[s.id]?.done:state.progress[s.id]&&!state.progress[s.id].done));
    if(needle) matches=matches.filter(s=>String(s.id)===needle||s.title.toLowerCase().includes(needle)||s.words.some(w=>w[0].toLowerCase().includes(needle)||w[1].includes(needle)));
    const total=Math.max(1,Math.ceil(matches.length/12));page=Math.min(page,total);
    $('#libraryResults').innerHTML=`${needle?`<p class="search-caption">找到 ${matches.length} 篇相关故事</p>`:''}${matches.length?`<div class="story-grid">${matches.slice((page-1)*12,page*12).map(storyCard).join('')}</div>${pagination(page,total,'library')}`:`<div class="empty-state">${icon('book')}<h2>${needle?'没有找到相关故事':filter==='done'?'读完的故事会出现在这里':'还没有正在阅读的故事'}</h2><p>${needle?'换一个单词、中文释义或故事编号试试。':'从一个故事开始，慢慢把陌生的词变成熟悉的表达。'}</p><button data-action="reset-filter">浏览全部故事</button></div>`}`;
  }
  let currentStory=null,selectedKey='',revealed=new Set(),observer=null,routeVersion=0;
  function reader(s){
    currentStory=s;revealed=new Set();selectedKey='';document.title=`${s.title} · 词境`;
    state.progress[s.id] ||= {done:false,paragraph:0,startedAt:Date.now(),lastReadAt:0};
    state.progress[s.id].lastReadAt=Date.now();state.lastStory=s.id;activity(false,s.id);save();
    const mode=state.settings.mode;
    main.innerHTML=`<div class="reader-page"><div class="reader-breadcrumb"><a href="#library">${icon('left')} 故事书架</a><span>/</span><span>STORY ${pad(s.id)}</span></div>
      <div class="reader-toolbar"><div class="mode-switch" role="group" aria-label="阅读模式">${[['learn','学习'],['review','复习'],['read','阅读']].map(([v,l])=>`<button data-action="mode" data-mode="${v}" class="${mode===v?'active':''}" aria-pressed="${mode===v}">${l}模式</button>`).join('')}</div><div class="reader-tools"><div class="font-control"><button data-action="font" data-delta="-1" aria-label="缩小字号">A−</button><span id="fontSize">${state.settings.font}</span><button data-action="font" data-delta="1" aria-label="放大字号">A+</button></div><select id="storySelect" aria-label="切换故事">${stories.map(x=>`<option value="${x.id}" ${x.id===s.id?'selected':''}>${pad(x.id)} · ${esc(x.title)}</option>`).join('')}</select></div></div>
      <div class="reader-layout"><article class="reading-paper" data-mode="${mode}"><header class="story-heading"><span class="eyebrow">STORY ${pad(s.id)} / 100</span><h1>${esc(s.title)}</h1><div class="story-meta"><span>${s.words.length} 个重点词</span><span>约 ${s.minutes} 分钟</span><span id="readStatus">${state.progress[s.id].done?'已读完':'阅读中'}</span></div></header><p class="mode-hint" id="modeHint">${modeHint(mode)}</p><div class="story-text">${s.paragraphs.map((p,i)=>`<p class="story-paragraph" id="paragraph-${i}" data-paragraph="${i}">${paragraphHTML(s,p)}</p>`).join('')}</div><p class="story-credit">故事原文 · ${esc(s.credit)}</p><div class="story-end"><span class="muted" style="font-size:11px">每读完一篇，都有新的收获。</span><button class="primary" data-action="complete">${icon('check')} ${state.progress[s.id].done?'已读完 · 点击标为未读':'标记为已读完'}</button></div><nav class="next-story" aria-label="相邻故事">${s.id>1?`<a href="#story/${s.id-1}">${icon('left')} ${esc(byId.get(s.id-1).title)}</a>`:'<span></span>'}${s.id<100?`<a href="#story/${s.id+1}">${esc(byId.get(s.id+1).title)} ${icon('arrow')}</a>`:'<a href="#library">回到书架 '+icon('arrow')+'</a>'}</nav></article>
      <aside class="reader-sidebar" aria-label="单词学习工具"><section class="side-box" id="wordPanel">${emptyWordPanel()}</section>
      <section class="side-box glossary-box"><div class="side-heading">本篇词汇<span>${s.words.length} words</span></div><input id="wordFilter" class="word-filter" type="search" placeholder="查找本篇单词" aria-label="查找本篇单词"><div id="wordList" class="word-list">${glossaryHTML(s)}</div></section><section class="side-box reader-summary"><span id="paragraphProgress">阅读位置</span><div class="progress-track"><i id="paragraphBar" style="width:0%"></i></div>点击「标记为已读完」记录完成。<br>进度与生词自动保存在当前浏览器。</section></aside></div></div>`;
    const version=routeVersion;
    requestAnimationFrame(()=>{
      if(version!==routeVersion)return;
      const p=state.progress[s.id].paragraph;
      if(p>0) document.getElementById('paragraph-'+p)?.scrollIntoView({behavior:'instant',block:'start'});
      if('IntersectionObserver' in window){
        observer=new IntersectionObserver(entries=>{
          if(currentStory?.id!==s.id)return;
          const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
          if(visible.length){const pos=Number(visible[0].target.dataset.paragraph);state.progress[s.id].paragraph=pos;const percent=Math.round((pos+1)/s.paragraphs.length*100);$('#paragraphProgress').textContent=`阅读位置 · 第 ${pos+1} / ${s.paragraphs.length} 段`;$('#paragraphBar').style.width=percent+'%';save();}
        },{rootMargin:'-90px 0px -45% 0px',threshold:0});
        $$('.story-paragraph').forEach(p=>observer.observe(p));
      }
    });
  }
  function modeHint(mode){return {learn:'学习模式：释义随文展示。点击英文单词，听发音或加入生词本。',review:'复习模式：点击单词查看释义，再点一次、关闭词卡或按 Esc 即可收起；查看下一个词时自动隐藏上一个。',read:'阅读模式：收起释义，沉浸阅读。遇到不熟悉的英文，仍可点击查看词卡。'}[mode];}
  function paragraphHTML(s,text){return tokenize(s,text).map(t=>t.word?`<button class="word-token${state.saved[t.key]?' saved':''}${selectedKey===t.key?' selected':''}${revealed.has(t.key)?' revealed':''}" data-action="word" data-word="${esc(t.word)}" data-meaning="${esc(t.meaning)}" aria-label="${esc(t.word)}，查看词卡"><span>${esc(t.word)}</span><span class="inline-meaning">${esc(t.meaning)}</span></button>`:esc(t.text)).join('');}
  function glossaryHTML(s,needle=''){return s.words.filter(w=>w[0].toLowerCase().includes(needle.toLowerCase())||w[1].includes(needle)).map(w=>`<button class="word-list-item${selectedKey===keyOf(w[0])?' active':''}" data-action="word" data-word="${esc(w[0])}" data-meaning="${esc(w[1])}"><strong>${esc(w[0])}</strong><small>${state.settings.mode==='learn'?esc(w[1]):'点击查看'}</small></button>`).join('')||'<p class="muted" style="font-size:11px">没有找到这个单词</p>';}
  function selectWord(word,meaning){
    const key=keyOf(word);
    if(state.settings.mode==='review' && selectedKey===key && revealed.has(key)){closeWord();return;}
    selectedKey=key;revealed.clear();revealed.add(key);
    $$('.word-token').forEach(el=>{const yes=keyOf(el.dataset.word)===selectedKey;el.classList.toggle('selected',yes);el.classList.toggle('revealed',yes);});
    renderWordPanel(word,meaning);$('.reader-sidebar').classList.add('mobile-open');
    $$('.word-list-item').forEach(el=>el.classList.toggle('active',keyOf(el.dataset.word)===selectedKey));
  }
  function emptyWordPanel(){return `<div class="side-heading">随读词卡</div><div class="empty-word-panel"><p class="selected-word">A word,<br>a new world.</p><p class="word-panel-caption">${state.settings.mode==='review'?'先回忆，再点一个英文单词查看释义。<br>再次点击、关闭词卡或按 Esc 收起。':'点击正文里的英文单词，<br>查看释义、听发音，或收入生词本。'}</p></div>`;}
  function closeWord(){
    selectedKey='';revealed.clear();
    $$('.word-token').forEach(el=>el.classList.remove('selected','revealed'));
    $$('.word-list-item').forEach(el=>el.classList.remove('active'));
    $('#wordPanel').innerHTML=emptyWordPanel();
    $('.reader-sidebar').classList.remove('mobile-open');
  }
  function renderWordPanel(word,meaning){
    const saved=!!state.saved[keyOf(word)],known=state.mastered.includes(keyOf(word));
    $('#wordPanel').innerHTML=`<div class="side-heading">随读词卡<button class="icon-button word-card-close" data-action="close-word" aria-label="关闭词卡">${icon('close')}</button></div><h2 class="selected-word">${esc(word)}</h2><button class="word-pronounce" data-action="speak" data-word="${esc(word)}">${icon('volume')} 听单词发音</button><p class="word-meaning">${esc(meaning)}</p><div class="word-panel-actions"><button class="primary" data-action="save-word" data-word="${esc(word)}" data-meaning="${esc(meaning)}">${icon(saved?'check':'bookmark')} ${saved?'已加入生词本':'加入生词本'}</button><button data-action="know-word" data-word="${esc(word)}" aria-pressed="${known}">${known?'已掌握 · 取消':'我认识'}</button></div><p class="word-panel-caption">${known?'已标记为掌握，再次点击可恢复未标记。':saved?'已收藏。你可以在「生词本」中结合原文复习。':'先放进故事里记，再带到生词本里复习。'}</p>`;
  }
  function addSaved(word,meaning,storyId){const key=keyOf(word);state.saved[key]={word,meaning,storyId,addedAt:Date.now()};state.mastered=state.mastered.filter(w=>w!==key);save();}
  function markKnown(word){const key=keyOf(word);delete state.saved[key];if(!state.mastered.includes(key))state.mastered.push(key);save();}
  function unmarkKnown(word){const key=keyOf(word);state.mastered=state.mastered.filter(w=>w!==key);save();}
  function notebookTabs(){return [['saved','生词本',Object.keys(state.saved).length],['mastered','已掌握',state.mastered.length]].map(([value,label,count])=>`<button data-action="notebook-view" data-view="${value}" class="${notebookView===value?'active':''}" aria-pressed="${notebookView===value}">${label}<small>${count}</small></button>`).join('');}
  function notebook(){
    document.title='我的生词本 · 词境';
    main.innerHTML=`<div class="page"><div class="page-heading"><div><span class="eyebrow">MY WORD COLLECTION</span><h1>慢慢，把生词变熟。</h1><p>从故事里收集的每一个词，都带着它原来的语境。</p></div><button class="button primary" data-action="review-saved" ${Object.keys(state.saved).length?'':'disabled'}>${icon('target')} 开始词卡复习</button></div><div class="tabs notebook-collections" id="notebookTabs" role="group" aria-label="词汇状态">${notebookTabs()}</div><div class="notebook-toolbar">${searchBox('notebookSearch','搜索单词或释义',notebookQuery)}<div class="notebook-actions"><span id="notebookCount" class="muted" style="font-size:11px"></span><button data-action="hide-meanings">${hideNotebookMeanings?'显示所有释义':'隐藏所有释义'}</button></div></div><div id="notebookResults"></div><p class="notebook-note">「已掌握」列表可以取消掌握状态，恢复为未标记；需要再次复习时，可回到原文加入生词本。学习记录保存在当前浏览器，建议定期导出备份。</p></div>`;notebookResults();
  }
  function notebookResults(){
    const needle=notebookQuery.trim().toLowerCase();
    const mastered=notebookView==='mastered';
    const all=mastered?[...state.mastered].reverse().map(key=>wordIndex.get(key)).filter(Boolean):Object.values(state.saved).sort((a,b)=>b.addedAt-a.addedAt);
    const entries=all.filter(w=>w.word.toLowerCase().includes(needle)||w.meaning.includes(needle));
    $('#notebookCount').textContent=`${entries.length} 个${mastered?'已掌握词汇':'生词'}`;
    $('#notebookTabs').innerHTML=notebookTabs();
    const total=Math.max(1,Math.ceil(entries.length/30));notebookPage=Math.min(notebookPage,total);
    $('#notebookResults').innerHTML=entries.length?`<table class="vocab-table"><thead><tr><th>英文单词</th><th>中文释义</th><th class="source-col">${mastered?'参考故事':'来自故事'}</th><th style="text-align:right">学习操作</th></tr></thead><tbody>${entries.slice((notebookPage-1)*30,notebookPage*30).map(w=>`<tr><td><div class="table-word">${esc(w.word)}</div></td><td class="meaning-col">${hideNotebookMeanings?`<button class="hidden-meaning" data-action="reveal-table" data-meaning="${esc(w.meaning)}">点击揭晓</button>`:esc(w.meaning)}</td><td class="source-col"><a class="table-source" href="#story/${w.storyId}">${pad(w.storyId)} · ${esc(byId.get(w.storyId).title)}</a></td><td><div class="table-action"><button class="icon-button" data-action="speak" data-word="${esc(w.word)}" aria-label="朗读 ${esc(w.word)}">${icon('volume')}</button><a class="icon-button" href="#story/${w.storyId}" aria-label="返回单词所在的故事">${icon('book')}</a><button data-action="${mastered?'unmark-saved':'know-saved'}" data-word="${esc(w.word)}">${icon(mastered?'left':'check')} ${mastered?'取消已掌握':'已掌握'}</button></div></td></tr>`).join('')}</tbody></table>${pagination(notebookPage,total,'notebook')}`:`<div class="empty-state">${icon(mastered?'check':'bookmark')}<h2>${needle?'没有找到这个单词':mastered?'还没有标记为掌握的词':'留一个位置，给新遇见的词。'}</h2><p>${needle?'换一个英文单词或中文释义试试。':mastered?'在词卡或生词复习中标记「我认识」后，可以在这里查看和取消。':'阅读时点击英文单词，再点「加入生词本」，就可以在这里复习。'}</p><a class="button primary" href="#library">去读一个故事 ${icon('arrow')}</a></div>`;
  }
  function progress(){
    document.title='学习记录 · 词境';
    const days=Object.keys(state.activity).length;
    const recent=Object.entries(state.progress).sort((a,b)=>b[1].lastReadAt-a[1].lastReadAt).slice(0,5);
    main.innerHTML=`<div class="page"><div class="page-heading"><div><span class="eyebrow">A LITTLE, EVERY DAY</span><h1>每一页，都算数。</h1><p>阅读、回忆，再相遇。用自己的节奏记住单词。</p></div></div><section class="summary-cards">${[[doneCount()+' / 100','读完的故事','在正文末尾标记完成'],[num(state.mastered.length),'已掌握词汇','亲自标记「我认识」的单词'],[days,'有学习记录的天数','从开始阅读或词卡复习记录']].map(([v,l,d])=>`<div class="summary-card"><label>${l}</label><strong>${v}</strong><p>${d}</p></div>`).join('')}</section><section class="progress-section"><h2>我的故事地图</h2><div class="collection-progress">${Array.from({length:10},(_,i)=>{const count=stories.slice(i*10,i*10+10).filter(s=>state.progress[s.id]?.done).length;return `<div><label>第 ${i+1} 卷 · ${pad(i*10+1)}—${pad(i*10+10)}<span>${count} / 10</span></label><div class="progress-track"><i style="width:${count*10}%"></i></div></div>`;}).join('')}</div></section><section class="progress-section"><h2>最近翻开的故事</h2>${recent.length?`<ul class="recent-list">${recent.map(([id,p])=>`<li><a href="#story/${id}">${pad(id)} · ${esc(byId.get(Number(id)).title)}</a><span>${p.done?'已读完':'阅读中'} · ${new Date(p.lastReadAt).toLocaleDateString('zh-CN')}</span></li>`).join('')}</ul>`:'<p class="reading-record-empty">打开第一个故事，你的阅读足迹就从这里开始。</p>'}</section><section class="progress-section backup-section"><div><h2>把学习记录，妥善留好。</h2><p>进度、生词与掌握状态保存在当前设备的当前浏览器，清理浏览器数据后会丢失。导出备份，可在另一台设备导入继续学习。</p></div><div class="backup-actions"><button data-action="export">${icon('download')} 导出备份</button><button data-action="import">${icon('upload')} 导入备份</button></div></section></div>`;
  }
  function navigate(){
    routeVersion++;if(observer){observer.disconnect();observer=null;}currentStory=null;selectedKey='';
    if('speechSynthesis' in window)window.speechSynthesis.cancel();
    const hash=location.hash.slice(1)||'library';const match=hash.match(/^story\/(\d+)$/);
    let nav=match?'library':hash;
    if(!['library','notebook','progress'].includes(nav))nav='library';
    $$('.main-nav a').forEach(a=>{a.classList.toggle('active',a.dataset.nav===nav);if(a.dataset.nav===nav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    window.scrollTo({top:0,behavior:'instant'});
    if(match && byId.has(Number(match[1])))reader(byId.get(Number(match[1])));
    else if(hash==='notebook')notebook();else if(hash==='progress')progress();else library();
  }
  function speak(word){
    if(!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)){toast('当前浏览器不支持发音，请使用 Chrome、Edge 或 Safari。');return;}
    const synth=window.speechSynthesis;synth.cancel();
    const utterance=new SpeechSynthesisUtterance(word);utterance.lang='en-US';utterance.rate=.82;
    const voices=synth.getVoices();const english=voices.find(v=>v.lang==='en-US')||voices.find(v=>/^en[-_]/i.test(v.lang));if(english)utterance.voice=english;
    utterance.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))toast('发音暂时不可用，请检查英语语音包或网络连接。');};
    synth.speak(utterance);
  }
  let review=null;
  function startReview(){
    const entries=Object.values(state.saved).sort((a,b)=>a.addedAt-b.addedAt);
    if(!entries.length){toast('先在故事里收藏几个生词吧。');return;}
    // A shuffled snapshot lets a remembered card leave the notebook without
    // skipping the next card in this review session.
    for(let i=entries.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[entries[i],entries[j]]=[entries[j],entries[i]];}
    review={entries,index:0,revealed:false,known:0,again:0};renderReview();$('#reviewDialog').showModal();
  }
  function reviewContext(entry){const s=byId.get(entry.storyId);const paragraph=s.paragraphs.find(p=>tokenize(s,p).some(t=>t.key===keyOf(entry.word)))||s.paragraphs[0];return tokenize(s,paragraph).map(t=>t.word?(t.key===keyOf(entry.word)?`<mark>${esc(t.word)}</mark>`:esc(t.word)):esc(t.text)).join('');}
  function renderReview(){
    const dialog=$('#reviewDialog');
    if(review.index>=review.entries.length){dialog.innerHTML=`<div class="dialog-top"><span>本轮复习完成</span><button class="icon-button" data-action="close-review" aria-label="关闭复习">${icon('close')}</button></div><div class="review-finish">${icon('check')}<h2 id="reviewTitle">又熟悉了一点。</h2><p>本轮回顾 ${review.entries.length} 个词，掌握 ${review.known} 个。<br>${review.again?`${review.again} 个还需复习的词，已留在生词本里。`:'所有词都已移入掌握记录。下次在故事里再见。'}</p><button class="button primary" data-action="close-review">回到生词本 ${icon('arrow')}</button></div>`;return;}
    const entry=review.entries[review.index];
    dialog.innerHTML=`<div class="dialog-top"><h2 id="reviewTitle">生词词卡</h2><span>${review.index+1} / ${review.entries.length}</span><button class="icon-button" data-action="close-review" aria-label="关闭复习">${icon('close')}</button></div><div class="review-progress"><i style="width:${review.index/review.entries.length*100}%"></i></div><h3 class="review-word">${esc(entry.word)}</h3><div class="review-speech"><button data-action="speak" data-word="${esc(entry.word)}">${icon('volume')} 听发音</button></div><p class="review-meaning">${review.revealed?esc(entry.meaning):'<span>先回忆一下，这个词在故事里是什么意思？</span>'}</p><div class="review-context">${reviewContext(entry)}</div><p class="review-source">来自 ${pad(entry.storyId)} · ${esc(byId.get(entry.storyId).title)}</p><div class="review-buttons">${review.revealed?'<button data-action="review-again">还不熟，再记一次</button><button class="primary" data-action="review-known">'+icon('check')+' 认识，已掌握</button>':'<button class="primary" data-action="review-reveal">显示释义</button>'}</div><p class="review-shortcut">空格：揭晓释义 · ←：还不熟 · →：已掌握 · Esc：退出</p>`;
  }
  function answerReview(known){if(!review||!review.revealed||review.index>=review.entries.length)return;const entry=review.entries[review.index];if(known){markKnown(entry.word);review.known++;}else review.again++;review.index++;review.revealed=false;activity(true);save();renderReview();}
  function exportBackup(){const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`storywords-backup-${today()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('学习记录已导出，请妥善保存备份文件。');}
  let pendingImport=null;
  $('#importFile').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    if(file.size>5*1024*1024){toast('备份文件过大，请选择从词境导出的 JSON 文件。');return;}
    try{
      pendingImport=validState(JSON.parse(await file.text()));
      const next=pendingImport;
      $('#importDialog').innerHTML=`<h2 id="importTitle">导入这份学习记录？</h2><p>备份包含 ${Object.keys(next.progress).length} 篇阅读记录、${Object.keys(next.saved).length} 个生词和 ${next.mastered.length} 个已掌握词汇。</p><p>导入后将替换当前浏览器的学习记录。你可以先取消并导出当前记录。</p><div class="review-buttons"><button data-action="cancel-import">取消</button><button class="primary" data-action="confirm-import">替换并导入</button></div>`;
      $('#importDialog').showModal();
    }catch{pendingImport=null;toast('无法读取备份，请选择从词境导出的有效 JSON 文件。');}
  });
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-action]');if(!el||el.disabled)return;
    const action=el.dataset.action;
    if(action==='random'){const pool=stories.filter(s=>!state.progress[s.id]?.done);const list=pool.length?pool:stories;location.hash='story/'+list[Math.floor(Math.random()*list.length)].id;}
    else if(action==='filter'){filter=el.dataset.filter;page=1;library();}
    else if(action==='reset-filter'){query='';filter='all';page=1;library();}
    else if(action==='library-page'){page=Number(el.dataset.page);libraryResults();$('#libraryTitle').scrollIntoView({block:'start'});}
    else if(action==='notebook-page'){notebookPage=Number(el.dataset.page);notebookResults();window.scrollTo({top:0,behavior:'instant'});}
    else if(action==='word')selectWord(el.dataset.word,el.dataset.meaning);
    else if(action==='close-word')closeWord();
    else if(action==='save-word'){const word=el.dataset.word,key=keyOf(word);if(state.saved[key]){delete state.saved[key];toast('已从生词本移除');}else{addSaved(word,el.dataset.meaning,currentStory.id);toast('已收入生词本');}save();renderWordPanel(word,el.dataset.meaning);$$('.word-token').filter(b=>keyOf(b.dataset.word)===key).forEach(b=>b.classList.toggle('saved',!!state.saved[key]));}
    else if(action==='know-word'){const word=el.dataset.word;if(state.mastered.includes(keyOf(word))){unmarkKnown(word);toast('已取消掌握，恢复为未标记');}else{markKnown(word);toast('已标记为掌握');}const meaning=currentStory.words.find(w=>keyOf(w[0])===keyOf(word))?.[1]||'';renderWordPanel(word,meaning);$$('.word-token').filter(b=>keyOf(b.dataset.word)===keyOf(word)).forEach(b=>b.classList.remove('saved'));}
    else if(action==='speak')speak(el.dataset.word);
    else if(action==='mode'){
      state.settings.mode=el.dataset.mode;save();$('.reading-paper').dataset.mode=state.settings.mode;$('#modeHint').textContent=modeHint(state.settings.mode);
      $$('.mode-switch button').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.settings.mode);b.setAttribute('aria-pressed',b.dataset.mode===state.settings.mode);});
      $('#wordList').innerHTML=glossaryHTML(currentStory,$('#wordFilter').value);
      closeWord();
    }
    else if(action==='font'){state.settings.font=Math.min(25,Math.max(16,state.settings.font+Number(el.dataset.delta)));applySettings();save();$('#fontSize').textContent=state.settings.font;}
    else if(action==='complete'){const p=state.progress[currentStory.id];p.done=!p.done;save();el.innerHTML=icon('check')+' '+(p.done?'已读完 · 点击标为未读':'标记为已读完');$('#readStatus').textContent=p.done?'已读完':'阅读中';toast(p.done?'这一篇读完了，收获留在故事里。':'已标为未读完');}
    else if(action==='know-saved'){markKnown(el.dataset.word);notebookResults();toast('已移出复习列表，计入掌握记录');const reviewButton=$('[data-action="review-saved"]');if(reviewButton)reviewButton.disabled=!Object.keys(state.saved).length;}
    else if(action==='unmark-saved'){unmarkKnown(el.dataset.word);notebookResults();toast('已取消掌握，恢复为未标记');}
    else if(action==='notebook-view'){notebookView=el.dataset.view;notebookPage=1;notebookResults();}
    else if(action==='hide-meanings'){hideNotebookMeanings=!hideNotebookMeanings;el.textContent=hideNotebookMeanings?'显示所有释义':'隐藏所有释义';notebookResults();}
    else if(action==='reveal-table'){const span=document.createElement('span');span.textContent=el.dataset.meaning;el.replaceWith(span);}
    else if(action==='review-saved')startReview();
    else if(action==='review-reveal'){review.revealed=true;renderReview();}
    else if(action==='review-again')answerReview(false);
    else if(action==='review-known')answerReview(true);
    else if(action==='close-review')$('#reviewDialog').close();
    else if(action==='export')exportBackup();
    else if(action==='import')$('#importFile').click();
    else if(action==='cancel-import'){$('#importDialog').close();pendingImport=null;}
    else if(action==='confirm-import' && pendingImport){state=pendingImport;pendingImport=null;save();applySettings();$('#importDialog').close();navigate();toast('学习记录已导入');}
  });
  document.addEventListener('input',e=>{if(e.target.id==='storySearch'){query=e.target.value;page=1;libraryResults();}else if(e.target.id==='wordFilter')$('#wordList').innerHTML=glossaryHTML(currentStory,e.target.value);else if(e.target.id==='notebookSearch'){notebookQuery=e.target.value;notebookPage=1;notebookResults();}});
  document.addEventListener('change',e=>{if(e.target.id==='storySelect')location.hash='story/'+e.target.value;});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && !$('#reviewDialog').open && currentStory && selectedKey){closeWord();return;}
    if(!$('#reviewDialog').open||!review)return;
    if(e.code==='Space' && !['BUTTON','INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName) && review.index<review.entries.length){e.preventDefault();review.revealed=true;renderReview();}
    if(e.code==='ArrowLeft'&&review.revealed){e.preventDefault();answerReview(false);}
    if(e.code==='ArrowRight'&&review.revealed){e.preventDefault();answerReview(true);}
  });
  $('#reviewDialog').addEventListener('close',()=>{review=null;if('speechSynthesis'in window)window.speechSynthesis.cancel();if(location.hash==='#notebook')notebook();});
  $('#themeToggle').addEventListener('click',()=>{state.settings.theme=state.settings.theme==='dark'?'light':'dark';applySettings();save();});
  $('.skip-link').addEventListener('click',e=>{e.preventDefault();main.focus();main.scrollIntoView({block:'start'});});
  window.addEventListener('hashchange',navigate);
  applySettings();save();navigate();
  if(!persistenceAvailable)toast('当前浏览器无法保存记录，请在学习结束时导出备份。');
  if('serviceWorker'in navigator && ['http:','https:'].includes(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
