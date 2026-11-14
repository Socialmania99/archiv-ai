/* Interactive product preview. Everything here is local and visual: nothing is saved, exported or sent. */
(function(){
var host=document.getElementById('mk');if(!host)return;
var P={grid:'<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
inbox:'<path d="M4 13l2-7h12l2 7v5H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>',doc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
folder:'<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',chev:'<path d="M6 9l6 6 6-6"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
swap:'<path d="M7 7h12l-3-3M17 17H5l3 3"/>',logo:'<rect x="4" y="5" width="16" height="5" rx="1.5"/><path d="M6 10v8a1 1 0 001 1h10a1 1 0 001-1v-8M10 14h4"/>'};
function I(n){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+P[n]+'</svg>'}
var COL={ChatGPT:'#10a37f',Claude:'#d97757',Gemini:'#4285f4',Perplexity:'#20808d',DeepSeek:'#4d6bfe'};
var S={view:'dash',dark:false,open:{ov:1,lib:1,tools:1},period:'Monthly',q:'',site:'',tag:'',folder:'',sel:{},prev:{},tagEdit:{},showPrev:true,
 ex:{id:'rome',src:'inbox',fmt:'PDF',theme:'Light',red:{key:true,mail:false,tel:false},off:{},size:11},sitesQ:'',cat:'',stat:'',sitePick:'',
 set:{detect:true,float:true,redact:true,shortcut:true},nid:10};
var chats=[
{id:'c1',site:'ChatGPT',title:'Plan a 3-day Kyoto trip',n:4,date:'11/11/2026',tags:['travel','sample'],folder:'Travel',words:429,pct:41},
{id:'c2',site:'Claude',title:'Fix React useEffect infinite loop',n:6,date:'11/11/2026',tags:['react','bug','sample'],folder:'Code',words:310,pct:59},
{id:'c3',site:'ChatGPT',title:'Cold email for a design agency',n:2,date:'11/10/2026',tags:['email','sample'],folder:'Writing',words:249,pct:22},
{id:'c4',site:'Gemini',title:'Kubernetes networking explained',n:6,date:'11/8/2026',tags:['devops','sample'],folder:'Learning',words:533,pct:63},
{id:'c5',site:'Perplexity',title:'Best budget mechanical keyboards',n:3,date:'11/7/2026',tags:['buying','sample'],folder:'Learning',words:188,pct:30},
{id:'c6',site:'DeepSeek',title:'SQL window functions cheat sheet',n:5,date:'11/6/2026',tags:['sql','sample'],folder:'Code',words:352,pct:48},
{id:'c7',site:'Claude',title:'Rewrite my cover letter',n:4,date:'11/5/2026',tags:['career','sample'],folder:'Writing',words:274,pct:36}];
var folders=[['Learning','linear-gradient(135deg,#ec4899,#a855f7)'],['Code','linear-gradient(135deg,#06b6d4,#3b82f6)'],['Writing','linear-gradient(135deg,#a855f7,#d946ef)'],['Travel','linear-gradient(135deg,#f59e0b,#ef4444)']];
var inbox={site:'ChatGPT',title:'Plan a 3-day Rome trip',n:4,tags:['travel'],words:78};
var ROME=[['you','Plan a relaxed 3-day trip to Rome. Include a budget table.'],
['ai','<b>3 days in Rome</b><br>A relaxed plan with the main sights spread out:<br>1. Day 1: Colosseum and Forum<br>2. Day 2: Vatican Museums<br>3. Day 3: Trastevere and Pantheon<table><tr><th>Item</th><th>Per day</th></tr><tr><td>Food</td><td>€55</td></tr><tr><td>Transport</td><td>€12</td></tr></table>'],
['you','Great, make day 3 shorter. Email it to anna.r@mail.com or call +1 555 0134. My key is sk-8f3a91c2d7e4b6.'],
['ai','Done. Day 3 is now a half day around Trastevere.']];
var SITES=[['ChatGPT','Chat','Built-in'],['Google Gemini','Chat','Built-in'],['Claude','Chat','Built-in'],['Microsoft Copilot','Chat','Beta'],['Meta AI','Chat','Auto'],['DeepSeek','Chat','Beta'],['Grok','Chat','Beta'],['Le Chat','Chat','Auto'],['Poe','Chat','Auto'],['YouChat','Chat','Auto'],['Pi','Chat','Auto'],['Perplexity','Search','Built-in'],['Phind','Search','Auto'],['Kagi Assistant','Search','Auto'],['Cursor','Coding','Beta'],['GitHub Copilot','Coding','Auto'],['Replit AI','Coding','Auto'],['Codeium','Coding','Auto'],['Jasper','Writing','Auto'],['Notion AI','Writing','Beta'],['Writesonic','Writing','Auto'],['HuggingChat','Chat','Auto'],['Duck.ai','Chat','Auto'],['Kimi','Chat','Beta']];
var DATA={Weekly:[1,0,2,1,3,2,2],Monthly:[0,1,1,2,2,4,6],Yearly:[2,5,3,8,6,11,14]};
var LBL={Weekly:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],Monthly:['Apr','May','Jun','Jul','Aug','Sep','Nov'],Yearly:['2020','2021','2022','2023','2024','2025','2026']};
var $=function(s,r){return (r||host).querySelector(s)},esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var tt;function toast(t,undo){var e=$('.toast');e.innerHTML='<span>'+t+'</span>'+(undo?'<button data-a="undo">Undo</button>':'');e.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){e.classList.remove('show')},2600)}
var last=null;
function go(v,extra){S.view=v;if(extra)for(var k in extra)S[k]=extra[k];draw()}
function words(){return chats.reduce(function(a,c){return a+c.words},0)}
function site(s){return '<span class="mico" style="background:'+COL[s]+'">'+s[0]+'</span>'}
function nav(id,ic,t,view,cnt,dot){return '<button class="it'+((S.view===view&&(!id||true))?' on':'')+'" data-go="'+view+'">'+(ic?I(ic):'')+t+(cnt!=null?'<b>'+cnt+'</b>':'')+'</button>'}
function shell(){
 var cnt=function(s){return chats.filter(function(c){return c.site===s}).length};
 var v=S.view;
 var rail=[['dash','grid'],['inbox','inbox'],['lib','doc'],['folders','folder'],['sites','globe'],['set','gear']].map(function(r){return '<button data-go="'+r[0]+'" class="'+(v===r[0]||(v==='export'&&r[0]===S.ex.src_rail)?'on':'')+'" aria-label="'+r[0]+'">'+I(r[1])+(r[0]==='inbox'&&inbox?'<span class="dot"></span>':'')+'</button>'}).join('');
 var sites=['ChatGPT','Claude','Gemini','Perplexity','DeepSeek'].map(function(s){return '<button class="it'+(v==='lib'&&S.site===s?' on':'')+'" data-site="'+s+'"><i class="sdot" style="background:'+COL[s]+'"></i>'+s+'<b>'+cnt(s)+'</b></button>'}).join('');
 var title={dash:'Dashboard',inbox:'Inbox',lib:'Library',folders:'Folders',sites:'Supported sites',set:'Settings',export:'Export'}[v];
 return '<div class="rail"><span class="lg">'+I('logo')+'</span>'+rail+'</div>'+
 '<aside class="side"><h3>'+title+'</h3>'+
 '<button class="grp'+(S.open.ov?'':' shut')+'" data-open="ov">Overview'+I('chev')+'</button><div class="sub"'+(S.open.ov?'':' hidden')+'>'+nav('','grid','Overview','dash')+nav('','inbox','Inbox','inbox',inbox?1:null)+'</div>'+
 '<button class="grp'+(S.open.lib?'':' shut')+'" data-open="lib">Library'+I('chev')+'</button><div class="sub"'+(S.open.lib?'':' hidden')+'><button class="it'+(v==='lib'&&!S.site?' on':'')+'" data-site="">'+I('doc')+'All chats<b>'+chats.length+'</b></button>'+sites+'</div>'+
 '<button class="it" data-go="folders" style="margin-top:6px;font-weight:600;color:var(--ink)">'+I('folder')+'Folders</button>'+
 '<button class="grp'+(S.open.tools?'':' shut')+'" data-open="tools">Tools'+I('chev')+'</button><div class="sub"'+(S.open.tools?'':' hidden')+'>'+nav('','globe','Supported sites','sites')+nav('','gear','Settings','set')+'</div>'+
 '<div class="bk"><b>Back up your vault</b><span>Everything lives in this browser. Keep a copy.</span><button data-a="backup">Download backup'+I('arrow')+'</button></div>'+
 '<div class="foot"><button class="coffee" data-a="coffee">☕ Buy me a coffee</button><span>GitHub</span></div></aside>'+
 '<main class="main"><div class="top"><span class="date">'+(v==='dash'?'Wednesday, Nov 11, 2026':title)+'</span><label class="sbox">'+I('search')+'<input id="gq" placeholder="Search every saved chat..." value="'+esc(S.q)+'" autocomplete="off"><button data-a="swap" aria-label="Search">'+I('swap')+'</button></label><span class="pill">'+I('lock')+'100% on-device</span><button class="tg" data-a="theme" role="switch" aria-checked="'+S.dark+'" aria-label="Light or dark"></button></div><div class="view" id="vw"></div></main><div class="toast" role="status"></div>';
}
var lv='';function draw(){S.ex.src_rail=S.ex.src==='inbox'?'inbox':'lib';host.className='mk'+(S.dark?' dark':'');host.innerHTML=shell();body();var vw=$('#vw');if(vw&&lv===S.view)vw.style.animation='none';lv=S.view}
function body(){var f={dash:dash,inbox:inboxV,lib:lib,folders:fold,sites:sitesV,set:settings,export:exportV}[S.view];$('#vw').innerHTML=f();if(S.view==='dash')chartHook();if(S.view==='lib')list();if(S.view==='sites')sgrid();if(S.view==='export')docUpd()}
/* dashboard */
function path(d){var w=300,h=80,m=Math.max.apply(null,d)||1;return d.map(function(v,i){return [i*w/(d.length-1),h-6-(v/m)*(h-14)]})}
function curve(p){var s='M'+p[0][0]+','+p[0][1];for(var i=1;i<p.length;i++){var a=p[i-1],b=p[i],cx=(a[0]+b[0])/2;s+=' C'+cx+','+a[1]+' '+cx+','+b[1]+' '+b[0]+','+b[1]}return s}
function chartSvg(){var d=DATA[S.period],p=path(d),c=curve(p),l=LBL[S.period];return '<div class="chart" id="ch"><svg viewBox="0 0 300 80" preserveAspectRatio="none"><defs><linearGradient id="mkg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="'+c+' L300,80 L0,80Z" fill="url(#mkg)" stroke="none"/><path d="'+c+'" fill="none" stroke="#fff" vector-effect="non-scaling-stroke"/></svg><span class="bub" id="bub" style="left:84%">'+l[l.length-1]+' · '+d[d.length-1]+' chats</span></div><div class="tagrow" style="justify-content:space-between;font-size:10px;opacity:.75;margin-top:2px">'+l.map(function(x){return '<span>'+x+'</span>'}).join('')+'</div>'}
function chartHook(){var ch=$('#ch');if(!ch)return;ch.addEventListener('mousemove',function(e){var r=ch.getBoundingClientRect(),d=DATA[S.period],l=LBL[S.period],i=Math.max(0,Math.min(d.length-1,Math.round((e.clientX-r.left)/r.width*(d.length-1))));var b=$('#bub');b.style.left=Math.max(14,Math.min(86,i/(d.length-1)*100))+'%';b.textContent=l[i]+' · '+d[i]+' chats'})}
function dash(){var q=S.q.toLowerCase(),res=chats.filter(function(c){return !q||c.title.toLowerCase().indexOf(q)>-1});
 var bars=function(a){var m=Math.max.apply(null,a);return a.map(function(v){return '<i title="'+v+'" style="height:'+Math.max(4,v/m*100)+'%"></i>'}).join('')};
 return '<div class="mstats"><div class="card mstat"><span class="mut">Chats saved</span><b>'+chats.length+'</b><span class="badge">+5 this week</span><div class="bars">'+bars([1,3,1,4,1,3,6])+'</div></div><div class="card mstat"><span class="mut">Words archived</span><b>'+(words()>=1000?(words()/1000).toFixed(1).replace('.0','')+'K':words())+'</b><span class="badge">+429 this week</span><div class="bars">'+bars([1,2,1,2,1,3,5])+'</div></div></div>'+
 '<div class="act"><div class="h"><span style="opacity:.85">Activity</span><select data-a="period" aria-label="Period">'+['Weekly','Monthly','Yearly'].map(function(p){return '<option'+(p===S.period?' selected':'')+'>'+p+'</option>'}).join('')+'</select></div><big>'+(inbox?2:chats.length-5)+' <small>saved today</small></big><span style="font-size:11px;opacity:.8">10 messages · ~207 tokens today</span>'+chartSvg()+'</div>'+
 '<div class="mtwo"><div style="display:grid;gap:8px;align-content:start"><div class="h"><h4>Recently saved</h4><button class="link" data-go="lib">View all</button></div>'+(res.slice(0,4).map(function(c){return '<button class="row" data-open-chat="'+c.id+'">'+site(c.site)+'<span class="t"><b>'+esc(c.title)+'</b><span class="mut">'+c.folder+' · '+c.n+' messages</span></span><span class="ring" style="--v:'+c.pct+'" data-v="'+c.pct+'%"></span></button>'}).join('')||'<div class="empty">No chats match.</div>')+'</div>'+
 '<div style="display:grid;gap:8px;align-content:start"><div class="h"><h4>Your folders</h4><button class="link" data-go="folders">View all</button></div><div class="fold">'+folders.slice(0,3).map(function(f){return '<button data-folder="'+f[0]+'"><i style="background:'+f[1]+'"></i><b>'+f[0]+'</b><br><span class="mut">'+chats.filter(function(c){return c.folder===f[0]}).length+' chats</span></button>'}).join('')+'</div></div></div>'}
/* inbox */
function inboxV(){if(!inbox)return '<div class="card empty">'+I('inbox')+'<b>Inbox is empty</b><span>Chats you send from the extension land here first. Nothing is stored until you save.</span><button class="mbtn p" data-a="newchat">Copy a chat from ChatGPT</button></div>';
 return '<div class="mut">Chats you sent from the extension land here as a recent copy. Save to the vault, export, or discard. Nothing is stored until you save.</div><div class="cc"><div class="h"><div><span style="color:var(--pri);font-size:10px;font-weight:600">Recent copy from '+inbox.site+'</span><br><b style="font-size:14px">'+esc(inbox.title)+'</b><div class="mut">'+inbox.n+' messages · just now</div></div><span class="badge">New chat</span></div>'+
 '<div class="tagrow"><span class="mut">Tags</span>'+inbox.tags.map(function(t){return '<button class="mchip" data-a="deltag" data-t="'+esc(t)+'">#'+esc(t)+' ×</button>'}).join('')+'<input class="f" id="addtag" placeholder="Add tag, press Enter" style="width:150px"></div>'+
 '<div class="tagrow"><button class="mbtn p" data-a="savevault">Save to vault</button><button class="mbtn" data-a="togprev">'+(S.showPrev?'Hide preview':'Show preview')+'</button><button class="mbtn" data-a="toexport">Export...</button><button class="mbtn d" data-a="discard">Discard</button></div>'+
 (S.showPrev?'<div class="msgs">'+ROME.map(function(m){return '<div class="msg'+(m[0]==='ai'?' ai':'')+'"><small>'+(m[0]==='ai'?'CHATGPT':'YOU')+'</small>'+m[1]+'</div>'}).join('')+'</div>':'')+'</div>'}
/* library */
function filt(){var q=S.q.toLowerCase();return chats.filter(function(c){return (!q||(c.title+' '+c.tags.join(' ')+' '+c.site).toLowerCase().indexOf(q)>-1)&&(!S.site||c.site===S.site)&&(!S.tag||c.tags.indexOf(S.tag)>-1)&&(!S.folder||c.folder===S.folder)})}
function lib(){var tags={};chats.forEach(function(c){c.tags.forEach(function(t){tags[t]=1})});
 return '<div class="tagrow"><select class="f" data-a="fsite" aria-label="Site"><option value="">All sites</option>'+Object.keys(COL).map(function(s){return '<option'+(S.site===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select><select class="f" data-a="ffold" aria-label="Folder"><option value="">All folders</option>'+folders.map(function(f){return '<option'+(S.folder===f[0]?' selected':'')+'>'+f[0]+'</option>'}).join('')+'</select><span id="lcount" class="mut" style="margin-left:auto"></span></div>'+
 '<div class="tagrow"><button class="mbtn p" id="comb" data-a="combined" disabled>Export combined (0)</button><button class="mbtn" data-a="selall">Select shown</button><button class="mbtn" data-a="clr">Clear</button></div>'+
 '<div class="tagrow">'+Object.keys(tags).filter(function(t){return t!=='sample'}).map(function(t){return '<button class="mchip'+(S.tag===t?' on':'')+'" data-tag="'+t+'">#'+t+'</button>'}).join('')+'</div><div id="ll" style="display:grid;gap:8px"></div>'}
function list(){var r=filt(),el=$('#ll');if(!el)return;$('#lcount').textContent=r.length+' of '+chats.length+' chats';
 el.innerHTML=r.map(function(c){return '<div class="item"><label class="tagrow" style="gap:8px"><input type="checkbox" data-sel="'+c.id+'"'+(S.sel[c.id]?' checked':'')+'><b style="font-size:13px">'+esc(c.title)+'</b></label><div class="mmeta">'+c.site+' · '+c.n+' messages · saved '+c.date+' · '+c.folder+' '+c.tags.map(function(t){return '<span class="mchip">#'+esc(t)+'</span>'}).join(' ')+'</div>'+
 '<div class="tagrow"><button class="mbtn msm" data-a="prev" data-id="'+c.id+'">'+(S.prev[c.id]?'Hide':'Preview')+'</button><button class="mbtn msm" data-a="exp" data-id="'+c.id+'">Export...</button><button class="mbtn msm" data-a="tf" data-id="'+c.id+'">Tags / folder</button><button class="mbtn msm d" data-a="del" data-id="'+c.id+'">Delete</button></div>'+
 (S.prev[c.id]?'<div class="msgs"><div class="msg"><small>YOU</small>'+esc(c.title)+'</div><div class="msg ai"><small>'+c.site.toUpperCase()+'</small>Sure. Here is a clear, step by step answer with the key points first, then the details.</div></div>':'')+
 (S.tagEdit[c.id]?'<div class="tagrow"><input class="f" data-addtag="'+c.id+'" placeholder="Add tag, press Enter" style="width:150px"></div>':'')+'</div>'}).join('')||'<div class="card empty">'+I('search')+'<b>No chats match</b><span>Try another word or clear the filters.</span><button class="mbtn" data-a="clrf">Clear filters</button></div>';
 var n=Object.keys(S.sel).filter(function(k){return S.sel[k]}).length,b=$('#comb');b.textContent='Export combined ('+n+')';b.disabled=!n}
function fold(){return '<div class="sg" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">'+folders.map(function(f){return '<button class="site" style="flex-direction:column;align-items:stretch" data-folder="'+f[0]+'"><i style="display:block;height:54px;border-radius:9px;background:'+f[1]+'"></i><b>'+f[0]+'</b><small>'+chats.filter(function(c){return c.folder===f[0]}).length+' chats</small></button>'}).join('')+'<button class="site" style="justify-content:center;color:var(--pri)" data-a="newfold"><b>+ New folder</b></button></div>'}
/* export */
function exChat(){var id=S.ex.id;if(id==='rome')return {title:'Plan a 3-day Rome trip',site:'ChatGPT',msgs:ROME,date:'2026-11-11'};var c=chats.filter(function(x){return x.id===id})[0]||chats[0];return {title:c.title,site:c.site,date:'2026-11-'+c.date.split('/')[1],msgs:[['you',c.title+'?'],['ai','Sure. Here is a clear answer.<br>1. Start with the basics<br>2. Then the details<br>3. Finish with a summary'],['you','Thanks, can you make it shorter?'],['ai','Done. Here is the short version.']]}}
var FM=[['PDF','#e5484d'],['Word','#3b82f6'],['Image','#16a34a'],['Markdown','#6b7280'],['HTML','#f97316'],['JSON','#eab308'],['Text','#94a3b8'],['Notion','#111827'],['Obsidian','#7c3aed']];
var TH={Light:['#fff','#1b1740','#6d4aff'],Dark:['#14112b','#ece9ff','#6d4aff'],Sepia:['#f6ecd6','#4a3b22','#9a6b1f'],Sakura:['#fff4f7','#4a2233','#e8517e']};
function exportV(){var c=exChat(),fm=FM.filter(function(f){return f[0]===S.ex.fmt})[0];
 return '<div class="mut">'+(S.ex.src==='inbox'?'Inbox › Recent copy from '+c.site:'Library › '+c.site)+'</div><div class="h"><h4>'+esc(c.title)+'</h4><span class="badge">'+(S.ex.src==='inbox'?'New chat':'Saved')+'</span></div>'+
 '<div class="card tagrow"><select class="f" data-a="fmt" aria-label="Format" style="font-weight:700">'+FM.map(function(f){return '<option'+(f[0]===S.ex.fmt?' selected':'')+'>'+f[0]+'</option>'}).join('')+'</select><button class="mbtn p" id="dl" data-a="download">Download</button><button class="mbtn" data-a="copymd">Copy Markdown</button>'+(S.ex.src==='inbox'?'<button class="mbtn" data-a="savevault">Save to vault</button><button class="mbtn d" data-a="discard">Discard</button>':'')+'<button class="mbtn" data-go="dash">Dashboard</button></div>'+
 '<div class="cols"><div class="card"><div class="lab" style="margin-top:0">Privacy</div><label class="opt"><input type="checkbox" data-red="key"'+(S.ex.red.key?' checked':'')+'>Redact API keys, tokens, passwords</label><label class="opt"><input type="checkbox" data-red="mail"'+(S.ex.red.mail?' checked':'')+'>Redact email addresses</label><label class="opt"><input type="checkbox" data-red="tel"'+(S.ex.red.tel?' checked':'')+'>Redact phone numbers</label><div class="mut" id="rinfo"></div>'+
 '<div class="lab">Style</div><div class="themes">'+Object.keys(TH).map(function(t){return '<button data-theme="'+t+'" class="'+(S.ex.theme===t?'on':'')+'"><i style="background:'+TH[t][0]+';border-color:'+TH[t][2]+'"></i>'+t+'</button>'}).join('')+'</div>'+
 '<div class="lab">Font size</div><select class="f" data-a="fsize" style="width:100%">'+[10,11,12,14].map(function(n){return '<option value="'+n+'"'+(S.ex.size===n?' selected':'')+'>'+n+' pt</option>'}).join('')+'</select><div class="mut" id="cnt" style="margin-top:8px"></div></div>'+
 '<div><div class="mut" style="margin-bottom:6px">Click a message header to include or exclude it.</div><div class="mdoc" id="doc"></div></div></div>'}
function docUpd(){var c=exChat(),t=TH[S.ex.theme],r=S.ex.red,n=0,inc=0,w=0;var el=$('#doc');el.style.background=t[0];el.style.color=t[1];el.style.fontSize=S.ex.size+'px';
 function rd(s){s=s.replace(/sk-[0-9a-f]{8,}/g,function(m){if(r.key){n++;return '<span class="rd">[redacted]</span>'}return m});s=s.replace(/[\w.]+@[\w.]+\.\w+/g,function(m){if(r.mail){n++;return '<span class="rd">[redacted]</span>'}return m});s=s.replace(/\+\d[\d ]{8,}/g,function(m){if(r.tel){n++;return '<span class="rd">[redacted]</span>'}return m});return s}
 var hits=0;c.msgs.forEach(function(m){hits+=(m[1].match(/sk-[0-9a-f]{8,}|[\w.]+@[\w.]+\.\w+|\+\d[\d ]{8,}/g)||[]).length});
 el.innerHTML='<h5>'+esc(c.title)+'</h5><div style="opacity:.65;margin-bottom:6px">Exported from '+c.site+' on '+c.date+'</div>'+c.msgs.map(function(m,i){var off=S.ex.off[i];if(!off){inc++;w+=m[1].replace(/<[^>]+>/g,' ').split(/\s+/).length}return '<div class="msg'+(m[0]==='ai'?' ai':'')+(off?' off':'')+'" data-m="'+i+'"><small style="color:inherit;opacity:.6">'+(off?'☐ ':'☑ ')+(m[0]==='ai'?c.site.toUpperCase():'YOU')+'</small>'+rd(m[1])+'</div>'}).join('');
 $('#rinfo').textContent=hits?(n?n+' item'+(n>1?'s':'')+' redacted':'Found '+hits+' sensitive item'+(hits>1?'s':'')):'Nothing sensitive found.';$('#cnt').textContent=inc+' messages · '+w+' words · ~'+Math.round(w*1.2)+' tokens'}
/* sites */
function sitesV(){return '<div class="mut">Open a chat on any listed site, then click the Archiv AI icon. Any other chat page works too: click the icon and, if needed, teach Archiv AI.</div><div class="tagrow"><input class="f" id="sq" placeholder="Search 230+ AI tools..." style="flex:1" value="'+esc(S.sitesQ)+'"><select class="f" data-a="cat" aria-label="Category"><option value="">All categories</option>'+['Chat','Search','Coding','Writing'].map(function(c){return '<option'+(S.cat===c?' selected':'')+'>'+c+'</option>'}).join('')+'</select><select class="f" data-a="stat" aria-label="Status"><option value="">All statuses</option>'+['Built-in','Auto','Beta'].map(function(c){return '<option'+(S.stat===c?' selected':'')+'>'+c+'</option>'}).join('')+'</select></div><div class="mut" id="scount"></div><div class="sg" id="sg"></div>'}
function sgrid(){var q=S.sitesQ.toLowerCase(),r=SITES.filter(function(s){return (!q||s[0].toLowerCase().indexOf(q)>-1)&&(!S.cat||s[1]===S.cat)&&(!S.stat||s[2]===S.stat)});$('#scount').textContent=(r.length===SITES.length?'230':r.length)+' of 230 tools';
 var pal=['#6d4aff','#10a37f','#d97757','#4285f4','#e5484d','#f59e0b','#20808d','#a855f7'];
 $('#sg').innerHTML=r.map(function(s,i){return '<button class="site'+(S.sitePick===s[0]?' sel':'')+'" data-pick="'+esc(s[0])+'"><span class="mico" style="background:'+pal[(s[0].charCodeAt(0)+i)%8]+'">'+s[0][0]+'</span><span><b>'+esc(s[0])+'</b><small>'+s[2]+' · '+s[1]+'</small></span></button>'}).join('')||'<div class="empty" style="grid-column:1/-1">No tools match.</div>'}
function settings(){var o=[['detect','Auto-detect chat pages','Find the conversation on any AI site.'],['float','Show the round Archiv AI button on chat pages','Quick access without opening the toolbar.'],['redact','Redact sensitive data by default','API keys, emails and phone numbers.'],['shortcut','Keyboard shortcut Alt+Shift+E','Open Archiv AI on the current chat.']];
 return '<div class="card">'+o.map(function(x){return '<div class="sw"><div><b>'+x[1]+'</b><div class="mut">'+x[2]+'</div></div><button class="tg'+(S.set[x[0]]?' on':'')+'" data-set="'+x[0]+'" role="switch" aria-checked="'+S.set[x[0]]+'" aria-label="'+x[1]+'"></button></div>'}).join('')+'</div>'}
/* events */
host.addEventListener('click',function(e){
 var t=e.target.closest('[data-go],[data-open],[data-site],[data-folder],[data-tag],[data-a],[data-open-chat],[data-theme],[data-set],[data-pick],[data-m],[data-red]');if(!t)return;
 var d=t.dataset;
 if(d.go){go(d.go);return}
 if(d.open){S.open[d.open]=!S.open[d.open];draw();return}
 if(d.site!==undefined&&t.hasAttribute('data-site')){S.site=d.site;S.tag='';S.folder='';S.view='lib';draw();return}
 if(d.folder){S.folder=d.folder;S.site='';S.view='lib';draw();return}
 if(d.tag){S.tag=S.tag===d.tag?'':d.tag;draw();return}
 if(d.openChat){S.ex={id:d.openChat,src:'lib',fmt:S.ex.fmt,theme:S.ex.theme,red:S.ex.red,off:{},size:S.ex.size};go('export');return}
 if(d.theme){S.ex.theme=d.theme;draw();return}
 if(d.set){S.set[d.set]=!S.set[d.set];t.classList.toggle('on');t.setAttribute('aria-checked',S.set[d.set]);toast(S.set[d.set]?'Turned on':'Turned off');return}
 if(d.pick){S.sitePick=S.sitePick===d.pick?'':d.pick;sgrid();if(S.sitePick)toast(d.pick+' is supported');return}
 if(d.m!==undefined&&t.classList.contains('msg')&&t.closest('#doc')){S.ex.off[d.m]=!S.ex.off[d.m];docUpd();return}
 if(d.red){S.ex.red[d.red]=t.checked;docUpd();return}
 var a=d.a,id=d.id;
 if(a==='theme'){S.dark=!S.dark;host.classList.toggle('dark',S.dark);t.setAttribute('aria-checked',S.dark)}
 else if(a==='backup')toast('Backup ready');
 else if(a==='coffee')toast('Thank you for the support ☕');
 else if(a==='swap'){var q=$('#gq').value;S.q=q;if(S.view==='dash'||S.view==='lib'){S.view='lib';draw()}else toast('Searching your library');}
 else if(a==='savevault'){if(inbox){var n={id:'c'+(S.nid++),site:inbox.site,title:inbox.title,n:inbox.n,date:'11/11/2026',tags:inbox.tags.concat(['sample']).filter(function(x,i,a){return a.indexOf(x)===i}),folder:'Travel',words:inbox.words,pct:35};chats.unshift(n);inbox=null;S.site='';S.tag='';S.folder='';S.q='';toast('Saved to vault');S.view='lib';draw()}}
 else if(a==='discard'){inbox=null;toast('Discarded');S.view='inbox';draw()}
 else if(a==='newchat'){inbox={site:'ChatGPT',title:'Plan a 3-day Rome trip',n:4,tags:['travel'],words:78};S.ex.id='rome';S.ex.src='inbox';draw()}
 else if(a==='togprev'){S.showPrev=!S.showPrev;body()}
 else if(a==='toexport'){S.ex.id='rome';S.ex.src='inbox';S.ex.off={};go('export')}
 else if(a==='deltag'){inbox.tags=inbox.tags.filter(function(x){return x!==d.t});body()}
 else if(a==='prev'){S.prev[id]=!S.prev[id];list()}
 else if(a==='exp'){S.ex.id=id;S.ex.src='lib';S.ex.off={};go('export')}
 else if(a==='tf'){S.tagEdit[id]=!S.tagEdit[id];list()}
 else if(a==='del'){var i=chats.findIndex(function(c){return c.id===id});last={c:chats[i],i:i};chats.splice(i,1);draw();toast('Chat deleted',true)}
 else if(a==='undo'){if(last){chats.splice(last.i,0,last.c);last=null;draw();toast('Restored')}}
 else if(a==='selall'){filt().forEach(function(c){S.sel[c.id]=true});list()}
 else if(a==='clr'){S.sel={};list()}
 else if(a==='clrf'){S.q='';S.site='';S.tag='';S.folder='';draw()}
 else if(a==='combined'){toast('Combined export ready')}
 else if(a==='newfold')toast('Folder created');
 else if(a==='download'){t.innerHTML='<span class="spin"></span>Preparing';t.disabled=true;setTimeout(function(){var b=$('#dl');if(b){b.disabled=false;b.textContent='Download'}toast(S.ex.fmt+' ready')},900)}
 else if(a==='copymd')toast('Markdown copied');
});
host.addEventListener('change',function(e){var t=e.target,a=t.dataset.a;
 if(t.dataset.sel){S.sel[t.dataset.sel]=t.checked;list();return}
 if(t.dataset.red){S.ex.red[t.dataset.red]=t.checked;docUpd();return}
 if(a==='period'){S.period=t.value;body()}else if(a==='fsite'){S.site=t.value;draw()}else if(a==='ffold'){S.folder=t.value;draw()}
 else if(a==='fmt'){S.ex.fmt=t.value;toast('Format: '+t.value)}else if(a==='fsize'){S.ex.size=+t.value;docUpd()}
 else if(a==='cat'){S.cat=t.value;sgrid()}else if(a==='stat'){S.stat=t.value;sgrid()}});
host.addEventListener('input',function(e){var t=e.target;
 if(t.id==='gq'){S.q=t.value;if(S.view==='lib')list();else if(S.view==='dash'){var p=t.selectionStart;body()}}
 else if(t.id==='sq'){S.sitesQ=t.value;sgrid()}});
host.addEventListener('keydown',function(e){var t=e.target;
 if(e.key==='Enter'&&t.id==='addtag'&&t.value.trim()){var v=t.value.trim().replace(/^#/,'');if(inbox.tags.indexOf(v)<0)inbox.tags.push(v);body();var n=$('#addtag');n&&n.focus()}
 else if(e.key==='Enter'&&t.dataset.addtag&&t.value.trim()){var c=chats.filter(function(x){return x.id===t.dataset.addtag})[0],v2=t.value.trim().replace(/^#/,'');if(c.tags.indexOf(v2)<0)c.tags.push(v2);S.tagEdit[c.id]=false;list();toast('Tag added')}
 else if(e.key==='Enter'&&t.id==='gq'){S.view='lib';draw()}});
draw();
})();
