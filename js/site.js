const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const nav=$('#nav');let sct=false;addEventListener('scroll',()=>{const v=scrollY>10;if(v!==sct){sct=v;nav.classList.toggle('sc',v)}},{passive:true});
$('#bg').onclick=()=>$('#lk').classList.toggle('open');$$('#lk a').forEach(a=>a.addEventListener('click',()=>$('#lk').classList.remove('open')));
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;e.target.classList.add('in');io.unobserve(e.target)}),{threshold:.15});
$$('.rv').forEach(x=>io.observe(x));
const co=new IntersectionObserver(es=>{es.forEach((e,idx)=>{if(!e.isIntersecting)return;co.unobserve(e.target);const el=e.target,n=+el.dataset.n,p=el.dataset.p||'',s=el.dataset.s||'';const delay=idx*80,duration=n>100000?1800:1400;setTimeout(()=>{let t0=performance.now(),last=0;(function f(t){if(t-last<40&&t-t0<duration){requestAnimationFrame(f);return;}last=t;const elapsed=t-t0,k=Math.min(1,elapsed/duration),ease=1-Math.pow(1-k,3.5),raw=n*ease;let v;if(k>=0.85){v=Math.round(raw)}else if(n>=1000000){v=Math.round(raw/50000)*50000}else if(n>=100000){v=Math.round(raw/10000)*10000}else{v=Math.round(raw)}el.textContent=p+v.toLocaleString('en-IN')+s;if(k<1)requestAnimationFrame(f)})(t0)},delay)})},{threshold:.3});
$$('.n').forEach(x=>co.observe(x));
$$('.jn').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();$('#ok').style.display='none';$('#jd').showModal()}));
$('#cx').onclick=()=>$('#jd').close();
const HL=[{t:'நாளைய நம்பிக்கை',e:'The One: youth in action',l:['Salem 2024: 5,00,000+ youth','5 million+ anti-NEET signatures','AIIMS brick: Madurai delay exposed','Booth-level teams and fellowship']},
{t:'எல்லார்க்கும் எல்லாம்',e:'Everything for everyone',l:['Governor veto limited: Supreme Court, 2025','Free breakfast in primary schools, 2022','Free bus travel for women, 2021','7.5% quota for government school students']},
{t:'மாநில சுயாட்சி',e:'State autonomy',l:['Rajamannar Committee, 1969','State Autonomy Resolution, 1974','Tamil and English policy, 1968','Madras State renamed Tamil Nadu, 1969']},
{t:'சமூக நீதி',e:'Social justice',l:['BC quota raised from 25% to 31%, 1969','20% MBC quota, 1989: 69% in all','Sub-quotas: Muslims 2007, Arundhatiyar 2009','7.5% professional-course quota, 2021']},
{t:'சமத்துவம்',e:'Equality',l:["Daughters' equal property rights, 1989",'Samathuvapuram: all castes, one village','India\'s first Transgender Welfare Board, 2008','Priests from every caste: law of 2006']}];
const li=d=>d.l.map(x=>'<li>'+x+'</li>').join('');
$$('.pc').forEach((b,i)=>{const d=HL[[3,2,4,1,0][i]],L=$('#lb');b.setAttribute('aria-label',d.e+': open highlights');const h=b.querySelector('.hl');if(h)h.innerHTML='<b>'+d.e+'</b><ul>'+li(d)+'</ul>';
b.onclick=()=>{const im=b.querySelector('img'),x=L.querySelector('img');x.src=im.src;x.alt=im.alt;L.querySelector('.ta').textContent=d.t;L.querySelector('h4').textContent=d.e;L.querySelector('ul').innerHTML=li(d);L.showModal()}});
$('#lb').addEventListener('click',e=>{if(e.target.id==='lb'||e.target.id==='lc')$('#lb').close()});
/* ===== Supabase config: paste your project values (Project Settings > API) ===== */
const SB_URL='https://fktertkyldwviaqnjtmj.supabase.co',SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrdGVydGt5bGR3dmlhcW5qdG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MzcxNDYsImV4cCI6MjEwNjAxMzE0Nn0.iraWh8Ra7Re3T7PwxAGbFV-T4EBH7z7DSacNVKm-1GE';   // e.g. https://xxxx.supabase.co  and the anon public key
/* Aadhaar checksum (Verhoeff) */
const D=[[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]],
P=[[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
const vh=n=>{let c=0;[...n].reverse().forEach((d,i)=>c=D[c][P[i%8][+d]]);return c===0};
const bad=(el,m)=>{el.classList.add('bad');el.closest('.f').querySelector('.er').textContent=m;return 1};
const clr=f=>{$$(f+' .bad').forEach(x=>x.classList.remove('bad'));$$(f+' .er').forEach(x=>x.textContent='')};
const say=(m,t)=>{const o=$('#ok');o.className=t||'';o.textContent=m;o.style.display='block'};
$('#ad').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10)});
/* validate the join form -> data or null */
function readJoin(){clr('#fm');let n=0;const nm=$('#nm'),ds=$('#ds'),ct=$('#ct'),ad=$('#ad'),cs=$('#cs'),a=ad.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
if(nm.value.trim().length<2)n+=bad(nm,'Enter your full name.');
if(ds.value.trim().length<3)n+=bad(ds,'Enter your district.');
if(!/^\S+@\S+\.\S+$|^[+\d][\d\s-]{8,13}$/.test(ct.value.trim()))n+=bad(ct,'Enter a valid email or phone number.');
if(!/^[A-Z]{3}\d{7}$/.test(a))n+=bad(ad,'Enter a valid Voter ID (3 letters + 7 digits, e.g. ABC1234567).');
if(!cs.checked)n+=bad(cs,'Please give your consent to continue.');
return n?null:{name:nm.value.trim(),district:ds.value.trim(),contact:ct.value.trim(),voter:a}}
/* save: Supabase RPC (hashes Voter ID + checks duplicates server-side); falls back to demo mode if not configured */
async function save(d,k){save.mid='';
if(SB_URL&&SB_KEY){const r=await fetch(SB_URL+'/rest/v1/rpc/join_youth_wing',{method:'POST',headers:{'Content-Type':'application/json',apikey:SB_KEY,Authorization:'Bearer '+SB_KEY},
body:JSON.stringify({p_name:d.name,p_district:d.district,p_contact:d.contact,p_voter_id:d.voter,p_wants_kit:!!k,p_kit_size:k?k.size:null,p_kit_address:k?k.address:null,p_kit_pincode:k?k.pin:null})});
if(!r.ok)throw new Error('http '+r.status);const j=await r.json();save.mid=j.member_id||'';return j.status}
/* demo mode (no backend yet): local duplicate check on a SHA-256 hash */
const h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('yw:'+d.voter)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const a=JSON.parse(localStorage.getItem('ywj')||'[]');if(a.some(x=>x.h===h))return 'duplicate';
a.push({h,name:d.name,district:d.district,contact:d.contact,kit:k||null,at:new Date().toISOString()});localStorage.setItem('ywj',JSON.stringify(a));save.mid='YW-'+String(a.length).padStart(6,'0');return 'joined'}
async function go(d,k,btn){btn.disabled=true;$('#ok').style.display='none';
try{const st=await save(d,k);$('#kd').close();
if(st==='joined'){say((k?'Welcome, '+d.name+'. You are in, and your YW Kit is on its way.':'Welcome, '+d.name+'. You are in.')+(save.mid?' Your Member ID is '+save.mid+'. Keep it safe.':''),'good');$('#fm').reset();$('#kf').reset()}
else if(st==='duplicate')say('This Voter ID is already registered. Each member can join only once.','warn');
else say('Please check your details and try again.','warn')}
catch(_){say('Could not reach the server. Please try again.','warn')}
btn.disabled=false}
$$('#fm input,#kf input,#kf select,#kf textarea').forEach(x=>x.addEventListener(x.type==='checkbox'||x.tagName==='SELECT'?'change':'input',()=>{x.classList.remove('bad');x.closest('.f').querySelector('.er').textContent=''}));
/* Join now */
$('#fm').onsubmit=e=>{e.preventDefault();const d=readJoin();if(d)go(d,null,$('#jb'))};
/* Get YW Kit -> validate join form, then open kit popup */
$('#kb').onclick=()=>{$('#ok').style.display='none';if(readJoin()){clr('#kf');$('#kd').showModal()}};
$('#kx').onclick=()=>$('#kd').close();
$('#kf').onsubmit=e=>{e.preventDefault();clr('#kf');const d=readJoin();if(!d){$('#kd').close();return}let n=0;const sz=$('#sz'),pn=$('#pn'),ar=$('#ar');
if(!sz.value)n+=bad(sz,'Select a size.');if(!/^\d{6}$/.test(pn.value.trim()))n+=bad(pn,'6-digit pincode.');if(ar.value.trim().length<10)n+=bad(ar,'Enter your full delivery address.');if(n)return;
go(d,{size:sz.value,address:ar.value.trim(),pin:pn.value.trim()},$('#kg'))};
$('#kd').addEventListener('click',e=>{if(e.target.id==='kd')$('#kd').close()});
