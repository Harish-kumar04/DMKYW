/* ===== YW START: Youth Wing tab logic (self-contained, no globals) ===== */
(()=>{
'use strict';
const BASE=(typeof SB_URL==='string'?SB_URL:'').replace(/\/rest\/v1\/?$/,'').replace(/\/+$/,''),KEY=typeof SB_KEY==='string'?SB_KEY:'';
const root=document.getElementById('yw-root'),V=document.getElementById('yw-view');
if(!root||!V)return;
const q=(s,el)=>(el||V).querySelector(s),qa=(s,el)=>[...(el||V).querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>{try{const x=new URL(u);return /^https?:$/.test(x.protocol)?x.href:''}catch(_){return ''}};
const fdate=d=>d?new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'';
const DIST=['Ariyalur','Chengalpattu','Chennai','Coimbatore','Cuddalore','Dharmapuri','Dindigul','Erode','Kallakurichi','Kanchipuram','Kanyakumari','Karur','Krishnagiri','Madurai','Mayiladuthurai','Nagapattinam','Namakkal','Nilgiris','Perambalur','Pudukkottai','Ramanathapuram','Ranipet','Salem','Sivaganga','Tenkasi','Thanjavur','Theni','Thoothukudi','Tiruchirappalli','Tirunelveli','Tirupathur','Tiruppur','Tiruvallur','Tiruvannamalai','Tiruvarur','Vellore','Viluppuram','Virudhunagar'];
const opts=(arr,ph)=>(ph?'<option value="">'+esc(ph)+'</option>':'')+arr.map(a=>Array.isArray(a)?'<option value="'+esc(a[0])+'">'+esc(a[1])+'</option>':'<option>'+esc(a)+'</option>').join('');
let tok=sessionStorage.getItem('yw_tok')||'',isAdmin=false,ACT=null;

/* ---------- Supabase REST helpers (existing URL + anon key) ---------- */
async function api(path,o={}){
  if(!o.auth&&(!o.method||/^rpc\/yw_(leaderboard|seva_star_current|member_points)$/.test(path))){try{return await api_(path,o)}catch(e){const fb=local(path,o.body);if(fb!==undefined)return fb;throw e}}
  return api_(path,o);
}
async function api_(path,o={}){
  if(!BASE||!KEY)throw new Error('Backend is not configured.');
  const r=await fetch(BASE+'/rest/v1/'+path,{method:o.method||'GET',body:o.body?JSON.stringify(o.body):undefined,
    headers:Object.assign({apikey:KEY,Authorization:'Bearer '+(o.auth&&tok?tok:KEY),'Content-Type':'application/json'},o.headers||{})});
  const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(_){}
  if(!r.ok){if(r.status===401&&o.auth){tok='';sessionStorage.removeItem('yw_tok');isAdmin=false}throw new Error((j&&(j.message||j.error_description))||('Error '+r.status))}
  return j;
}
const rpc=(fn,args,auth)=>api('rpc/'+fn,{method:'POST',body:args||{},auth});
async function acts(){if(!ACT)ACT=await api('yw_activity_types?select=*&order=sort');return ACT}
/* Built-in content: shown when the database is not reachable yet (before the SQL is run). */
const dAgo=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10)};
const L={
 act:[{id:1,name:'Books reading / review',points:1,sort:1},{id:2,name:'Blood donation camp',points:5,sort:2},{id:3,name:'School / children related camp',points:5,sort:3},{id:4,name:'Book donation to libraries',points:5,sort:4},{id:5,name:'E-Sevai type free camp for public',points:5,sort:5}],
 feeds:[
  ['இரத்தான முகாம் — உதயநிதி ஸ்டாலின் பிறந்தநாள்','உதயநிதி ஸ்டாலின் பிறந்தநாளை முன்னிட்டு பொள்ளாச்சியில் திமுக இளைஞரணி சார்பில் இரத்தான முகாம் நடைபெற்றது. கோவை மாவட்டத்தில் நடைபெற்ற இந்த முகாமில் ஏராளமான இளைஞர்கள் தன்னார்வலர்களாக இரத்தம் கொடுத்தனர்.','Coimbatore',2,1,'இளைஞரணி கோவை குழு',['https://i.ibb.co/RBMBVMW/kovai-blood-donation.jpg']],
  ['Blood Donation Camp — DMK & Youth Wing, A&N Islands','DMK & Youth Wing – Andaman & Nicobar Islands organised a voluntary blood donation camp at Kalaignar Arivalayam, Sri Vijaya Puram on 7 December 2024, to celebrate the 48th birthday of Deputy CM Udhayanidhi Stalin. 22 units of blood were collected with support from G.B. Pant Hospital and ANACS.','Chennai',2,2,'AL Kulandai (State Organiser)',['https://www.andamanchronicle.net/wp-content/uploads/2024/12/Blood-Donation-camp-by-DMK-Youth-Wing-Andaman.jpg']],
  ['DMK organises Blood Donation Camp on MK Stalin\'s Birthday','DMK Party organised a grand blood donation camp across Tamil Nadu in celebration of Party President and Chief Minister Mr. MK Stalin\'s birthday. Youth Wing members led the drive in every district, with hundreds of volunteers donating blood at local centres.','Salem',2,3,'DMK Youth Wing',['https://i.ytimg.com/vi/YmNVyxhsHuo/maxresdefault.jpg']],
  ['Blood donation camp at Government College','Our Salem team organised a blood donation camp with the college NSS unit. 64 students and staff donated blood, and the district blood bank collected every unit.','Salem',2,2,'Karthik'],
  ['120 books donated to the town library','Members collected 120 books from homes across Madurai: stories, science and Tamil literature. The town library has opened a new shelf for young readers.','Madurai',4,4,'Priya'],
  ['Painting and games day for school children','A full day of painting, quiz and outdoor games for 80 children of a panchayat union school. Every child went home with a drawing kit.','Coimbatore',3,6,'Arun'],
  ['Free e-Sevai help camp for villagers','Volunteers helped villagers apply for certificates, pensions and scheme benefits online, free of cost. Over 150 applications were filed in a single day.','Tiruchirappalli',5,8,'Meena'],
  ['Review: "Pavalar Kavithaigal"','A short review of the poetry collection, with three poems that speak to young people today. The full review was shared in our district reading circle.','Chennai',1,10,'Vignesh'],
  ['Second blood donation camp this month','Our Erode team held its second blood donation camp this month at the community hall. 48 donors came forward, many for the first time.','Erode',2,13,'Divya'],
  ['Pension and certificate help desk','A Sunday help desk at the panchayat office for senior citizens. Volunteers filed 90 pension and income certificate applications online.','Vellore',5,15,'Sanjay'],
  ['Notebooks and story books for a village school','Members donated 200 notebooks and 60 story books to a primary school, and spent the afternoon reading stories with the children.','Thanjavur',3,18,'Keerthana']
 ].map((f,i)=>({id:'s'+i,title:f[0],description:f[1],district:f[2],activity_id:f[3],activity_date:dAgo(f[4]),members:f[5],photos:Array.isArray(f[6])?f[6]:[],is_sample:true,created_at:dAgo(f[4])})),
 eps:[
  ['pSS4aWEoDEw','தேவை பிரதமர் நாற்காலியல்ல; இந்தியா முழுமைக்கும் சமூகநீதி | ஜெயரஞ்சன் | Jeyaranjan |','Jeyaranjan',false,'book'],
  ['FDePiJkDURg','காலத்தின் நிறம் கருப்பு சிவப்பு நூல் வெளியீடு: திரு. பன்னீர் பெருமாள் அவர்களின் பேச்சுரை','திரு. பன்னீர் பெருமாள்',false,'general'],
  ['7RSsijRK430','காலத்தின் நிறம் கருப்பு சிவப்பு நூல் வெளியீடு: வழக்கறிஞர் திருமதி அ. அருள்மொழி அவர்களின் பேச்சுரை','திருமதி அ. அருள்மொழி',false,'general'],
  ['g8KoNBzhNo8','காலத்தின் நிறம் கருப்பு சிவப்பு: எழுத்தாளர் வே. மதிமாறன் அவர்களின் கட்டுரை','வே. மதிமாறன்',false,'general'],
  ['ZvC-hpSpK2c','Live: திமுக75 அறிவுத்திருவிழாவில் காலத்தின் நிறம் கருப்பு சிவப்பு நூல் வெளியீடு, சிறப்புரை','',true,'general']
 ].map((e,i)=>({id:'e'+i,category:e[4]||'general',title:e[1],speaker:e[2],ep_date:null,thumbnail:'https://i.ytimg.com/vi/'+e[0]+'/hqdefault.jpg',youtube:e[3]?'https://www.youtube.com/live/'+e[0]:'https://youtu.be/'+e[0],spotify:null,instagram:null,is_live:e[3]})),
 books:[
  ['Kalathin Niram: Karuppu Sivappu','Tho. Paramasivan','An acclaimed Tamil novel on identity, colour and society.','Beginner','Tamil Literature','https://www.panuval.com/kalathin-niram-karuppu-sivappu-10028476','https://assets2.panuval.com/image/cache/catalog/1003/kalathin-niram-karuppu-sivappu-10028476-250x250h.jpeg'],
  ['தீ பரவட்டும்','முகமது யூசுப்','திராவிட இயக்க வரலாற்றின் தீ நிறைந்த பக்கங்கள்.','Beginner','History','https://dravidianbookhouse.com/product/%e0%ae%a4%e0%af%80-%e0%ae%aa%e0%ae%b0%e0%ae%b5%e0%ae%9f%e0%af%8d%e0%ae%9f%e0%af%81%e0%ae%ae%e0%af%8d/','https://dravidianbookhouse.com/wp-content/uploads/2015/07/Thee_paravattum_front.png'],
  ['Why Were Women Enslaved','Periyar E. V. Ramasamy','Periyar\'s powerful argument for women\'s liberation and equality.','Beginner','Social justice','https://dravidianbookhouse.com/product/why-were-women-enslaved-2/','https://dravidianbookhouse.com/wp-content/uploads/2015/07/pen_yen_adimaianal_front-21.jpg'],
  ['Vaikom Poratta Varalaru','R. Kumaresan','The story of the historic Vaikom Satyagraha and caste struggle.','Deeper','History','https://dravidianbookhouse.com/product/vaikom-poratta-varalaru/','https://dravidianbookhouse.com/wp-content/uploads/2023/10/vaikom-poratta-varalaru-periyar-book-1.png'],
  ['Dravida Desiyam','Cho. Dharman','Understanding Dravidian nationalism — its roots and its reach.','Deeper','Politics','https://dravidianbookhouse.com/product/dravida-desiyam/','https://dravidianbookhouse.com/wp-content/uploads/2025/02/Dravida-Desiyam.jpg'],
  ['DMK Varalaru (Tamil)','Kalaignar M. Karunanidhi','The complete history of DMK by its longest-serving president.','Deeper','History','https://periyarbooks.com/collections/kalaignar/products/d-m-k-varalaaru-tamil','https://periyarbooks.com/cdn/shop/products/d.m.k._varalaaru_tamil__300_1200x1200.jpg'],
  ['Nenjukku Neethi (Vol 1–6)','Kalaignar M. Karunanidhi','Kalaignar\'s autobiography — six volumes of life, politics and poetry.','Deeper','Autobiography','https://periyarbooks.com/products/nenjukku_neethi_volume_1_to_6','https://periyarbooks.com/cdn/shop/files/nenjukku_neethi_volume_1_to_6_500_4fbb9d26-5429-4d35-9213-e9c463337654_1200x1200.jpg'],
  ['History of DMK 1949–1957','Ka. Thirunavukarasu','The founding years of DMK documented by a leading historian.','Deeper','History','https://periyarbooks.com/products/history-of-d-m-k-1949-to-1957','https://periyarbooks.com/cdn/shop/products/dmk_history_1024x.jpg'],
  ['Annihilation of Caste','B. R. Ambedkar','The clearest argument for social justice you will ever read.','Deeper','Social justice','https://www.amazon.in/s?k=Annihilation+of+Caste+Ambedkar','https://covers.openlibrary.org/b/id/9396071-L.jpg'],
  ['Why I Am an Atheist','Bhagat Singh','A short, fearless essay on reason by a 23-year-old revolutionary.','Beginner','Rationalism','https://www.amazon.in/s?k=Why+I+Am+Atheist+Bhagat+Singh','https://cdn.exoticindia.com/images/products/original/books/bhagat_singh_why_i_am_an_atheist_idk603.jpg']
 ].map((b,i)=>({id:'b'+i,title:b[0],author:b[1],why:b[2],level:b[3],category:b[4],cover:b[6]||null,amazon_url:b[5]||null,episode_id:null,is_sample:true})),
 ideas:[
  ['Weekend reading circles in every district','A one-hour reading circle every Sunday at the district office, open to all students. One book a month, one speaker a month.','Event','Sanjay','Vellore','Accepted',24],
  ['Exam help desk for Class 12 students','Volunteers run a free help desk before board exams for doubts, revision schedules and counselling referrals.','Social service','Keerthana','Thanjavur','Under review',17],
  ['Short videos on our history','60-second explainer videos on key moments of our movement, made by members, for Instagram and YouTube Shorts.','Content','Rahul','Tirunelveli','Approved',9]
 ].map((x,i)=>({id:'i'+i,title:x[0],description:x[1],category:x[2],first_name:x[3],district:x[4],status:x[5],supports:x[6],is_sample:true}))
};
L.feeds.forEach(f=>{const a=L.act.find(x=>x.id===f.activity_id);f.activity=a.name;f.points=a.points});
function local(path,body){
  const [t,qs]=path.split('?'),P=new URLSearchParams(qs||''),eq=k=>(P.get(k)||'').replace(/^eq\./,'');
  if(t==='yw_activity_types')return L.act;
  if(t==='yw_feed_public'){let r=L.feeds.filter(f=>(!eq('district')||f.district===eq('district'))&&(!eq('activity_id')||String(f.activity_id)===eq('activity_id')));const o=+P.get('offset')||0;return r.slice(o,o+(+P.get('limit')||r.length))}
  if(t==='yw_podcast_episodes')return L.eps.filter(e=>!eq('category')||e.category===eq('category'));
  if(t==='yw_books')return L.books;
  if(t==='yw_ideas_public')return L.ideas;
  if(t==='yw_settings')return eq('key')==='speaker_month'?[{value:{name:'To be announced',about:'Our Speaker of the Month will be featured here.',link:''}}]:[];
  const sum=(rows,key)=>{const m={};rows.forEach(f=>{const k=key(f);m[k]=m[k]||{first_name:f.members,district:f.district,points:0};m[k].points+=f.points});return Object.values(m).sort((a,b)=>b.points-a.points)};
  const since=d=>L.feeds.filter(f=>f.activity_date>=d);
  const now=new Date(),wk=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()+6)%7)).toISOString().slice(0,10),mo=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);
  if(t==='rpc/yw_leaderboard'){const p=body&&body.p_period;if(p==='district')return sum(L.feeds,f=>f.district).map(x=>({first_name:null,district:x.district,points:x.points}));return sum(p==='all'?L.feeds:since(p==='month'?mo:wk),f=>f.members).slice(0,10)}
  if(t==='rpc/yw_seva_star_current'){const s=sum(since(wk),f=>f.members)[0];return s?[Object.assign({confirmed:false,note:null},s)]:[]}
  if(t==='rpc/yw_member_points')return {found:false};
  return undefined;
}


/* ---------- Placeholders, images, small utils ---------- */
const ICON={1:'📖',2:'🩸',3:'🎨',4:'📚',5:'🖥️'};
function ph(label,icon,seed){const h=[0,8,350,12,20,4][(seed||0)%6];
  const s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('+h+',85%,42%)"/><stop offset="1" stop-color="#140706"/></linearGradient></defs><rect width="640" height="400" fill="url(#g)"/><circle cx="560" cy="60" r="140" fill="#ffffff10"/><circle cx="80" cy="380" r="120" fill="#ffffff0c"/><text x="320" y="210" font-size="110" text-anchor="middle">'+(icon||'✊')+'</text><text x="320" y="320" font-family="Poppins,Arial" font-size="26" font-weight="700" fill="#fff" text-anchor="middle">'+esc(label).slice(0,40)+'</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s)}
async function compress(file){
  if(!/^image\//.test(file.type))throw new Error('Please choose an image file.');
  const bmp=await createImageBitmap(file),sc=Math.min(1,1280/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');
  c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  for(const qy of [.82,.65,.5]){const b=await new Promise(r=>c.toBlob(r,'image/webp',qy));if(b&&b.size<=2097152)return b}
  throw new Error('Image is too large even after compression (max 2 MB).');
}
async function upload(bucket,folder,blob,auth){
  const path=folder+'/'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)+'.webp';
  const r=await fetch(BASE+'/storage/v1/object/'+bucket+'/'+path,{method:'POST',body:blob,headers:{apikey:KEY,Authorization:'Bearer '+(auth&&tok?tok:KEY),'Content-Type':'image/webp'}});
  if(!r.ok)throw new Error('Photo upload failed.');return path;
}
const pubUrl=(b,p)=>BASE+'/storage/v1/object/public/'+b+'/'+p;
function cleanLink(u){u=safeUrl((u||'').trim());if(!u)return '';const x=new URL(u);['si','feature','utm_source','utm_medium','utm_campaign','igsh','igshid','pp'].forEach(p=>x.searchParams.delete(p));return x.href.replace(/\?$/,'')}
const ytId=u=>((u||'').match(/(?:youtu\.be\/|[?&]v=|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/)||[])[1]||'';
function cool(k,sec){const now=Date.now(),last=+localStorage.getItem('yw_rl_'+k)||0;if(now-last<sec*1000)return false;localStorage.setItem('yw_rl_'+k,now);return true}
function msg(el,t,ok){el.className='yw-msg '+(ok?'yw-good':'yw-bad');el.textContent=t}
const phoneOk=p=>/^(\+?91)?[6-9]\d{9}$/.test((p||'').replace(/[\s-]/g,''));
const head=(title,em,lead,crumb)=>'<div class="yw-crumb"><a href="#yw">YouthWing</a>'+(crumb?' › <span>'+esc(crumb)+'</span>':'')+'</div><h1 class="yw-h1">'+title+(em?' <em>'+em+'</em>':'')+'</h1>'+(lead?'<p class="yw-lead">'+lead+'</p>':'');
const loading='<div class="yw-empty">Loading…</div>';
const fail=e=>'<div class="yw-empty">Could not load right now. '+esc(e.message||'')+'</div>';

/* ---------- Feed card ---------- */
function feedCard(f,i){
  const yt=safeUrl(f.video_url),vid=ytId(yt);
  const img=(f.photos&&f.photos[0])?safeUrl(f.photos[0]):(vid?'https://i.ytimg.com/vi/'+vid+'/hqdefault.jpg':ph(f.activity,ICON[f.activity_id],i));
  return '<article class="yw-item" style="animation-delay:'+(i%6)*60+'ms"><div class="yw-ph"><img loading="lazy" alt="'+esc(f.title)+'" src="'+esc(img)+'"><span class="yw-ptop">+'+esc(f.points)+' Points</span>'+(vid?'<span class="yw-chip yw-live" style="position:absolute;bottom:8px;left:8px">▶ Video</span>':'')+(f.photos&&f.photos.length>1?'<span class="yw-more">+'+(f.photos.length-1)+' photos</span>':'')+'</div>'+
  '<div class="yw-body"><h3>'+esc(f.title)+'</h3><p>'+esc(f.description)+'</p><div class="yw-meta">'+
  (f.is_sample?'<span class="yw-chip yw-sample">Sample</span>':'')+'<span class="yw-chip yw-pts">+'+esc(f.points)+' pts</span><span class="yw-chip">'+esc(f.activity)+'</span><span class="yw-chip">📍 '+esc(f.district)+'</span>'+
  (f.members?'<span class="yw-chip">👤 '+esc(f.members)+'</span>':'')+'<span class="yw-chip">📅 '+fdate(f.activity_date)+'</span></div></div></article>';
}


/* ---------- Social-style post (YW Feeds timeline) ---------- */
function ago(d){const s=(Date.now()-new Date(d))/1000;if(s<86400)return 'Today';const n=Math.floor(s/86400);return n===1?'Yesterday':n<7?n+' days ago':n<30?Math.floor(n/7)+'w ago':fdate(d)}
function postCard(f,i){
  const who=f.members||'YouthWing',ini=esc(who.trim()[0]||'Y'),hue=[0,350,12,20,4,355][(who.charCodeAt(0)||0)%6];
  const yt=safeUrl(f.video_url),vid=ytId(yt);
  const pics=(f.photos||[]).map(safeUrl).filter(Boolean);
  const imgs=pics.length?pics:(vid?[]:[ph(f.activity,ICON[f.activity_id],i)]);
  const liked=(JSON.parse(localStorage.getItem('yw_likes')||'[]')).includes(f.id);
  const videoHtml = vid ? '<div class="yw-video-box" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;margin:12px 0;background:#000;"><iframe src="https://www.youtube-nocookie.com/embed/'+vid+'" title="'+esc(f.title)+'" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>' : '';
  const imgHtml = imgs.length ? '<div class="yw-pimg yw-n'+Math.min(imgs.length,4)+'">'+imgs.slice(0,4).map(u=>'<img loading="lazy" alt="'+esc(f.title)+'" src="'+esc(u)+'">').join('')+'</div>' : '';

  return '<article class="yw-post" style="animation-delay:'+(i%6)*70+'ms"><header class="yw-ph2"><span class="yw-ava" style="background:hsl('+hue+',80%,42%)">'+ini+'</span><div class="yw-who"><b>'+esc(who)+
  ' <span class="yw-vf" title="Youth Wing member">✔</span></b><small>📍 '+esc(f.district)+' · '+esc(ago(f.activity_date))+'</small></div><span class="yw-ppt">+'+esc(f.points)+' pts</span></header>'+
  '<div class="yw-ptx"><span class="yw-tag">#'+esc(f.activity.replace(/[^A-Za-z]+/g,''))+'</span>'+(f.is_sample?' <span class="yw-chip yw-sample">Sample</span>':'')+(vid?' <span class="yw-chip yw-live">▶ Video</span>':'')+'<h3>'+esc(f.title)+'</h3><p>'+esc(f.description)+'</p></div>'+
  videoHtml + imgHtml +
  '<div class="yw-pstat"><span>★ '+esc(f.points)+' points credited to '+esc(who)+'</span><span>'+fdate(f.activity_date)+'</span></div>'+
  '<footer class="yw-pact"><button type="button" class="yw-like'+(liked?' yw-liked':'')+'" data-id="'+esc(f.id)+'">👍 <span>'+(liked?'Liked':'Like')+'</span></button>'+
  (yt?'<a class="yw-btn yw-yt" target="_blank" rel="noopener" href="'+esc(yt)+'">▶ YouTube</a>':'')+
  '<button type="button" class="yw-share" data-t="'+esc(f.title)+'">↗ Share</button><a href="#yw/leaderboard">🏆 Leaderboard</a></footer></article>';
}
function bindPosts(el){
  [...el.querySelectorAll('.yw-like:not([data-b])')].forEach(b=>{b.dataset.b=1;b.onclick=()=>{const k=JSON.parse(localStorage.getItem('yw_likes')||'[]'),id=b.dataset.id,on=!k.includes(id);
    localStorage.setItem('yw_likes',JSON.stringify(on?[...k,id]:k.filter(x=>x!==id)));b.classList.toggle('yw-liked',on);b.querySelector('span').textContent=on?'Liked':'Like'}});
  [...el.querySelectorAll('.yw-share:not([data-b])')].forEach(b=>{b.dataset.b=1;b.onclick=async()=>{const u=location.href.split('#')[0]+'#yw/feeds',t=b.dataset.t+' | DMK Youth Wing';
    try{if(navigator.share)await navigator.share({title:t,url:u});else{await navigator.clipboard.writeText(t+' '+u);b.textContent='✓ Link copied'}}catch(_){}}});
}
/* ---------- Views ---------- */
const CARDS=[['feeds','📰','YW Feeds','Activities by members across Tamil Nadu'],['podcast','🎙️','YW Podcast','Book and general discussions'],['books','📚','Bookshelf','Books every member should read'],
  ['leaderboard','🏆','Leaderboard','Points, ranks and Seva Star'],['complaints','📝','Complaints','Raise an issue, track your ticket'],['ideas','💡','Ideas','Share and support ideas']];
async function vHome(){
  V.innerHTML=head('Youth','Wing','Our work, our voices and our ideas, in one place. Explore what members are doing across Tamil Nadu.')+
  '<div class="yw-cards">'+CARDS.map(c=>'<a class="yw-card" href="#yw/'+c[0]+'"><i>'+c[1]+'</i><b>'+c[2]+'</b><span>'+c[3]+'</span><span class="yw-go">Open →</span></a>').join('')+'</div>'+
  '<h2 class="yw-h2">Latest feed</h2><div class="yw-strip" id="yw-latest">'+loading+'</div><p class="yw-center"><a class="pill" href="#yw/feeds">See all feeds →</a></p>';
  try{const r=await api('yw_feed_public?select=*&order=activity_date.desc,created_at.desc&limit=3');q('#yw-latest').innerHTML=r.length?r.map(feedCard).join(''):'<div class="yw-empty">No feeds yet.</div>'}
  catch(e){q('#yw-latest').innerHTML=fail(e)}
}
async function vFeeds(){
  V.innerHTML=head('YW','Feeds','Activities published by the Youth Wing team. Points go to the members credited in each feed.','Feeds')+
  '<div class="yw-filters"><select id="yw-fd" aria-label="District">'+opts(DIST,'All districts')+'</select><select id="yw-fa" aria-label="Activity type"><option value="">All activities</option></select></div>'+
  '<div class="yw-fwrap"><div class="yw-tl"><div id="yw-mail"></div><div id="yw-fl"></div><p class="yw-center"><button class="pill out" id="yw-fm" hidden>Load more</button></p></div><aside class="yw-side" id="yw-side"></aside></div>';
  let off=0;const N=6,list=q('#yw-fl'),more=q('#yw-fm');
  async function load(reset){if(reset){off=0;list.innerHTML=loading}more.hidden=true;
    let p='yw_feed_public?select=*&order=activity_date.desc,created_at.desc&limit='+N+'&offset='+off;const d=q('#yw-fd').value,a=q('#yw-fa').value;
    if(d)p+='&district=eq.'+encodeURIComponent(d);if(a)p+='&activity_id=eq.'+encodeURIComponent(a);
    try{const r=await api(p);if(reset)list.innerHTML='';if(!r.length&&!off)list.innerHTML='<div class="yw-empty">No feeds match these filters.</div>';
      list.insertAdjacentHTML('beforeend',r.map((f,i)=>postCard(f,off+i)).join(''));bindPosts(list);off+=r.length;more.hidden=r.length<N}
    catch(e){list.innerHTML=fail(e)}}
  q('#yw-fd').onchange=q('#yw-fa').onchange=()=>load(true);more.onclick=()=>load(false);
  Promise.all([rpc('yw_leaderboard',{p_period:'week'}),acts()]).then(([t,a])=>{q('#yw-side').innerHTML='<div class="yw-box"><b>🏆 Top this week</b>'+(t.length?t.slice(0,5).map((x,i)=>'<div class="yw-srow"><span class="yw-ava yw-sm">'+(i+1)+'</span><span>'+esc(x.first_name)+'<small>'+esc(x.district)+'</small></span><b>'+esc(x.points)+'</b></div>').join(''):'<p>No points yet this week.</p>')+'<a href="#yw/leaderboard">See leaderboard →</a></div>'+
  '<div class="yw-box"><b>★ How to earn points</b>'+a.map(x=>'<div class="yw-srow"><span>'+(ICON[x.id]||'•')+'</span><span>'+esc(x.name)+'</span><b>'+x.points+'</b></div>').join('')+'</div>'}).catch(()=>{});
  load(true);
  try{const a=await acts();q('#yw-fa').insertAdjacentHTML('beforeend',a.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join(''))}catch(_){}
  try{const s=await api('yw_settings?key=eq.contact_email&select=value');const em=s[0]&&s[0].value&&s[0].value.email;
    if(em&&/^\S+@\S+\.\S+$/.test(em)){const body='Name:\nPhone:\nMember ID:\nDistrict:\nActivity type:\nDate:\nDescription:\n\n(Attach up to 4 photos)\n[ ] Photos are shared with consent of everyone shown.';
      q('#yw-mail').innerHTML='<div class="yw-form"><b>Did your team do something great?</b><span>Email the details to the Youth Wing team. Once verified, it is published here and points are credited.</span><div><a class="pill" href="mailto:'+esc(em)+'?subject='+encodeURIComponent('YW Feed: activity details')+'&body='+encodeURIComponent(body)+'">Email your activity →</a></div></div>'}}catch(_){}
}
async function vPodcast(sub){
  sub=(sub==='book'||sub==='general')?sub:'';
  V.innerHTML=head('YW','Podcast','Conversations on books, our history, our mission and our work.','Podcast')+'<div id="yw-spk"></div>'+
  '<div class="yw-tabs"><a class="yw-tab'+(!sub||sub==='all'?' yw-on':'')+'" href="#yw/podcast">All Videos</a><a class="yw-tab'+(sub==='book'?' yw-on':'')+'" href="#yw/podcast/book">Book Discussions</a><a class="yw-tab'+(sub==='general'?' yw-on':'')+'" href="#yw/podcast/general">General Discussions</a></div>'+
  '<div class="yw-grid" id="yw-eps">'+loading+'</div><h2 class="yw-h2">Become a Speaker</h2>'+
  '<form class="yw-form" id="yw-sf" novalidate><div class="yw-row2"><label>Name<input name="n" maxlength="80" autocomplete="name"></label><label>Phone<input name="p" inputmode="tel" maxlength="14" autocomplete="tel"></label></div>'+
  '<div class="yw-row2"><label>District<select name="d">'+opts(DIST,'Select district')+'</select></label><label>College<input name="c" maxlength="120"></label></div>'+
  '<label>Sample link (optional)<input name="l" type="url" maxlength="300" placeholder="https://"></label><div class="yw-msg" id="yw-sm"></div><div><button class="pill" type="submit">Apply to speak</button></div></form>';
  api('yw_settings?key=eq.speaker_month&select=value').then(s=>{const v=s[0]&&s[0].value;if(!v)return;const l=safeUrl(v.link||'');
    q('#yw-spk').innerHTML='<div class="yw-spk"><div class="yw-av">🎤</div><div><small>Speaker of the Month</small><b>'+esc(v.name)+'</b><p>'+esc(v.about)+'</p>'+(l?'<p><a class="yw-btn yw-yt" target="_blank" rel="noopener" href="'+esc(l)+'">Watch</a></p>':'')+'</div></div>'}).catch(()=>{});
  const qPath='yw_podcast_episodes?select=*'+(sub?'&category=eq.'+sub:'')+'&order=ep_date.desc.nullslast,created_at.desc,title.asc';
  try{const r=await api(qPath);
    q('#yw-eps').innerHTML=r.length?r.map((e,i)=>{
      const yt=safeUrl(e.youtube),sp=safeUrl(e.spotify),ig=safeUrl(e.instagram),vid=ytId(yt);
      const th=safeUrl(e.thumbnail)||(vid?'https://i.ytimg.com/vi/'+vid+'/hqdefault.jpg':ph(e.title,'🎙️',i));
      return '<article class="yw-item" style="animation-delay:'+i*60+'ms"><div class="yw-ph" data-yt="'+esc(vid)+'" style="position:relative;cursor:'+(vid?'pointer':'default')+'"><img loading="lazy" alt="'+esc(e.title)+'" src="'+esc(th)+'">'+
      (vid?'<div class="yw-ply" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25);"><svg width="44" height="44" viewBox="0 0 68 48"><path fill="#f00" d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"/><polygon fill="#fff" points="45,24 27,14 27,34"/></svg></div>':'')+
      '</div><div class="yw-body"><h3>'+esc(e.title)+'</h3>'+
      '<div class="yw-meta" style="margin-top:0;padding-top:0">'+(e.is_live?'<span class="yw-chip yw-live">● Live stream</span>':'')+(e.speaker?'<span class="yw-chip">🎤 '+esc(e.speaker)+'</span>':'')+(e.ep_date?'<span class="yw-chip">📅 '+fdate(e.ep_date)+'</span>':'')+'<span class="yw-chip">'+esc(e.category==='book'?'Book Discussion':'General')+'</span></div>'+
      '<div class="yw-btns">'+(yt?'<a class="yw-btn yw-yt" target="_blank" rel="noopener" href="'+esc(yt)+'">▶ YouTube</a>':'')+(sp?'<a class="yw-btn yw-sp" target="_blank" rel="noopener" href="'+esc(sp)+'">Spotify</a>':'')+(ig?'<a class="yw-btn yw-ig" target="_blank" rel="noopener" href="'+esc(ig)+'">Instagram</a>':'')+'</div></div></article>'}).join(''):'<div class="yw-empty">Episodes coming soon.</div>';
    qa('#yw-eps .yw-ph[data-yt]').forEach(p=>{const v=p.dataset.yt;if(!v)return;p.onclick=()=>{p.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+encodeURIComponent(v)+'?autoplay=1" style="width:100%;height:100%;border:0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>'}});
  }
  catch(e){q('#yw-eps').innerHTML=fail(e)}
  const f=q('#yw-sf');f.onsubmit=async ev=>{ev.preventDefault();const m=q('#yw-sm'),n=f.n.value.trim(),p=f.p.value.trim(),d=f.d.value,l=f.l.value.trim();
    if(n.length<2)return msg(m,'Enter your name.');if(!phoneOk(p))return msg(m,'Enter a valid 10-digit mobile number.');if(!d)return msg(m,'Select your district.');if(l&&!safeUrl(l))return msg(m,'Sample link must start with https://');
    if(!cool('spk',30))return msg(m,'Please wait a few seconds before sending again.');
    try{const r=await rpc('yw_apply_speaker',{p_name:n,p_phone:p,p_district:d,p_college:f.c.value.trim(),p_link:cleanLink(l)});
      if(r.status==='ok'){msg(m,'Thank you! The team will contact you.',1);f.reset()}else msg(m,r.status==='limited'?'Too many requests. Try again later.':'Please check your details.')}catch(e){msg(m,e.message)}};
}
async function vBooks(){
  V.innerHTML=head('Book','shelf','Books that shaped our movement and our thinking. Start with Beginner, go Deeper when ready.','Bookshelf')+
  '<div class="yw-chips" id="yw-bc"></div><div class="yw-grid" id="yw-bl">'+loading+'</div><h2 class="yw-h2">Suggest a book</h2>'+
  '<form class="yw-form" id="yw-bf" novalidate><div class="yw-row2"><label>Book title<input name="t" maxlength="160"></label><label>Author<input name="a" maxlength="120"></label></div>'+
  '<label>Why should members read it?<input name="w" maxlength="400"></label><label>Your name (optional)<input name="n" maxlength="80"></label><div class="yw-msg" id="yw-bm"></div><div><button class="pill" type="submit">Suggest</button></div></form>';
  let all=[],cat='';
  function draw(){const r=cat?all.filter(b=>b.category===cat):all;q('#yw-bl').innerHTML=r.length?r.map((b,i)=>{const cv=safeUrl(b.cover)||ph(b.title,'📘',i+2),az=safeUrl(b.amazon_url);
    return '<article class="yw-item" style="animation-delay:'+i*60+'ms"><div class="yw-ph" style="aspect-ratio:4/3"><img loading="lazy" alt="'+esc(b.title)+'" src="'+esc(cv)+'"></div><div class="yw-body"><h3>'+esc(b.title)+'</h3><p style="color:#777;font-size:13px">by '+esc(b.author)+'</p><p>'+esc(b.why)+'</p>'+
    '<div class="yw-meta">'+(b.is_sample?'<span class="yw-chip yw-sample">Sample</span>':'')+'<span class="yw-chip yw-pts">'+esc(b.level)+'</span><span class="yw-chip">'+esc(b.category)+'</span></div>'+
    '<div class="yw-btns">'+(az?'<a class="yw-btn yw-amz" target="_blank" rel="noopener" href="'+esc(az)+'">📖 Buy / View ↗</a>':'')+(b.episode_id?'<a class="yw-btn yw-ghost" href="#yw/podcast/book">🎙️ Related episode</a>':'')+'</div></div></article>'}).join(''):'<div class="yw-empty">No books in this category yet.</div>';
    qa('#yw-bc .yw-tab').forEach(t=>t.classList.toggle('yw-on',t.dataset.c===cat))}
  try{all=await api('yw_books?select=*&order=created_at.desc');const cs=[...new Set(all.map(b=>b.category))];
    q('#yw-bc').innerHTML=['',...cs].map(c=>'<button class="yw-tab" type="button" data-c="'+esc(c)+'">'+(c?esc(c):'All')+'</button>').join('');
    qa('#yw-bc .yw-tab').forEach(t=>t.onclick=()=>{cat=t.dataset.c;draw()});draw()}catch(e){q('#yw-bl').innerHTML=fail(e)}
  const f=q('#yw-bf');f.onsubmit=async ev=>{ev.preventDefault();const m=q('#yw-bm');if(f.t.value.trim().length<2)return msg(m,'Enter the book title.');
    if(!cool('book',20))return msg(m,'Please wait a few seconds before sending again.');
    try{const r=await rpc('yw_suggest_book',{p_title:f.t.value.trim(),p_author:f.a.value.trim(),p_why:f.w.value.trim(),p_name:f.n.value.trim()});
      if(r.status==='ok'){msg(m,'Thanks! We will review your suggestion.',1);f.reset()}else msg(m,r.status==='limited'?'Too many requests. Try again later.':'Please check your details.')}catch(e){msg(m,e.message)}};
}
async function vBoard(per){
  per=['week','month','all','district'].includes(per)?per:'week';const L={week:'This Week',month:'This Month',all:'All Time',district:'By District'};
  V.innerHTML=head('Leader','board','Points come only from published feeds. Bronze 10+, Silver 25+, Gold 50+.','Leaderboard')+'<div id="yw-ss"></div>'+
  '<div class="yw-tabs">'+Object.keys(L).map(k=>'<a class="yw-tab'+(k===per?' yw-on':'')+'" href="#yw/leaderboard/'+k+'">'+L[k]+'</a>').join('')+'</div>'+
  '<div class="yw-two"><div class="yw-board" id="yw-lb">'+loading+'</div><div><form class="yw-form" id="yw-mf" novalidate><b>Check your points</b><label>Member ID<input name="m" placeholder="YW-000123" maxlength="10" style="text-transform:uppercase"></label><div class="yw-msg" id="yw-mm"></div><div><button class="pill" type="submit">Check</button></div></form>'+
  '<h2 class="yw-h2">How points work</h2><div class="yw-board" id="yw-pt"></div></div></div>';
  rpc('yw_seva_star_current').then(r=>{const s=r&&r[0];q('#yw-ss').innerHTML=s?'<div class="yw-star"><div class="yw-av">'+esc((s.first_name||'?')[0])+'</div><div><small>Seva Star of the Week'+(s.confirmed?' · Confirmed':'')+'</small><b>'+esc(s.first_name)+' · '+esc(s.district)+'</b><p>'+esc(s.points)+' points this week. Reward: a book or gift, plus a meeting with a senior leader.'+(s.note?' '+esc(s.note):'')+'</p></div></div>'
    :'<div class="yw-star"><div class="yw-av">★</div><div><small>Seva Star of the Week</small><b>Be the first this week</b><p>Reward: a book or gift, plus a meeting with a senior leader.</p></div></div>'}).catch(()=>{});
  try{const r=await rpc('yw_leaderboard',{p_period:per});
    q('#yw-lb').innerHTML=r.length?r.map((x,i)=>{const b=per==='all'?(x.points>=50?'Gold':x.points>=25?'Silver':x.points>=10?'Bronze':''):'';
      return '<div class="yw-rank'+(i<3?' yw-t'+(i+1):'')+'" style="animation-delay:'+i*50+'ms"><span class="yw-n">'+(i+1)+'</span><span><b>'+esc(per==='district'?x.district:x.first_name)+(b?'<span class="yw-badge yw-'+b+'">'+b+'</span>':'')+'</b>'+(per==='district'?'':'<small>'+esc(x.district)+'</small>')+'</span><span class="yw-p">'+esc(x.points)+'</span></div>'}).join(''):'<div class="yw-empty" style="border:0">No points yet for this period.</div>'}
  catch(e){q('#yw-lb').innerHTML=fail(e)}
  acts().then(a=>{q('#yw-pt').innerHTML=a.map(x=>'<div class="yw-rank"><span class="yw-n">'+(ICON[x.id]||'•')+'</span><span><b>'+esc(x.name)+'</b></span><span class="yw-p">'+esc(x.points)+'</span></div>').join('')}).catch(()=>{});
  const f=q('#yw-mf');f.onsubmit=async ev=>{ev.preventDefault();const m=q('#yw-mm'),id=f.m.value.trim().toUpperCase();if(!/^YW-\d{6}$/.test(id))return msg(m,'Member ID looks like YW-000123.');
    try{const r=await rpc('yw_member_points',{p_member_id:id});if(!r.found)return msg(m,'No member found with that ID.');
      msg(m,r.first_name+' ('+r.district+'): '+r.points+' points in total, '+r.week+' this week.'+(r.badge?' Badge: '+r.badge+'.':''),1)}catch(e){msg(m,e.message)}};
}
async function vComplaints(){
  V.innerHTML=head('Compl','aints','Tell us about an issue. Complaints are private and go only to the Youth Wing team.','Complaints')+
  '<div class="yw-two"><form class="yw-form" id="yw-cf" novalidate><div class="yw-row2"><label>Category<select name="c">'+opts(['Party','Local issue','Event','Other'],'Select category')+'</select></label><label>District<select name="d">'+opts(DIST,'Select district')+'</select></label></div>'+
  '<label>Description<textarea name="t" maxlength="2000" placeholder="What happened, where and when?"></textarea></label><label>Photo (optional, max 2 MB)<input name="ph" type="file" accept="image/*"></label>'+
  '<label class="yw-ck"><input type="checkbox" name="an"><span>Submit anonymously</span></label><div class="yw-row2" id="yw-cid"><label>Name<input name="n" maxlength="80" autocomplete="name"></label><label>Phone<input name="p" inputmode="tel" maxlength="14" autocomplete="tel"></label></div>'+
  '<div class="yw-msg" id="yw-cm"></div><div><button class="pill" type="submit">Submit complaint</button></div></form>'+
  '<form class="yw-form" id="yw-tf" novalidate><b>Track your complaint</b><label>Ticket number<input name="k" placeholder="YW-C-XXXXXX" maxlength="12" style="text-transform:uppercase"></label><div class="yw-msg" id="yw-tm"></div><div><button class="pill out" type="submit">Check status</button></div></form></div>';
  const f=q('#yw-cf');f.an.onchange=()=>{q('#yw-cid').hidden=f.an.checked};
  f.onsubmit=async ev=>{ev.preventDefault();const m=q('#yw-cm'),an=f.an.checked,t=f.t.value.trim();
    if(!f.c.value)return msg(m,'Select a category.');if(!f.d.value)return msg(m,'Select your district.');if(t.length<10)return msg(m,'Please describe the issue (at least 10 characters).');
    if(!an&&f.n.value.trim().length<2)return msg(m,'Enter your name, or tick "Submit anonymously".');if(!an&&!phoneOk(f.p.value))return msg(m,'Enter a valid 10-digit mobile number.');
    if(!cool('cmp',30))return msg(m,'Please wait a few seconds before sending again.');
    const btn=q('button[type=submit]',f);btn.disabled=true;
    try{let photo=null;if(f.ph.files[0])photo=await upload('yw-complaints','c',await compress(f.ph.files[0]));
      const r=await rpc('yw_submit_complaint',{p_category:f.c.value,p_district:f.d.value,p_description:t,p_photo:photo,p_name:an?null:f.n.value.trim(),p_phone:an?null:f.p.value.trim(),p_anonymous:an});
      if(r.status==='ok'){m.className='yw-msg yw-good';m.innerHTML='Complaint received. Your ticket number:<div class="yw-ticket">'+esc(r.ticket)+'</div>Save it to track the status below.';f.reset();q('#yw-cid').hidden=false;q('#yw-tf').k.value=r.ticket}
      else msg(m,r.status==='limited'?'Too many complaints from this connection. Try again later.':'Please check your details.')}catch(e){msg(m,e.message)}btn.disabled=false};
  const g=q('#yw-tf');g.onsubmit=async ev=>{ev.preventDefault();const m=q('#yw-tm'),k=g.k.value.trim().toUpperCase();if(!/^YW-C-[A-Z0-9]{6}$/.test(k))return msg(m,'Ticket looks like YW-C-1A2B3C.');
    try{const r=await rpc('yw_complaint_status',{p_ticket:k});if(!r.found)return msg(m,'Ticket not found.');msg(m,'Status: '+r.status+(r.reply?' · Reply: '+r.reply:'')+' (updated '+fdate(r.updated_at)+')',1)}catch(e){msg(m,e.message)}};
}
async function vIdeas(){
  V.innerHTML=head('','Ideas','Good ideas become good work. Share yours, and support the ones you like.','Ideas')+'<div class="yw-grid" id="yw-il">'+loading+'</div><h2 class="yw-h2">Share an idea</h2>'+
  '<form class="yw-form" id="yw-if" novalidate><div class="yw-row2"><label>Title<input name="t" maxlength="140"></label><label>Category<select name="c">'+opts(['Event','Social service','Content','Digital','Other'],'Select category')+'</select></label></div>'+
  '<label>Describe your idea<textarea name="d" maxlength="2000"></textarea></label><div class="yw-row2"><label>Name<input name="n" maxlength="80" autocomplete="name"></label><label>District<select name="s">'+opts(DIST,'Select district')+'</select></label></div>'+
  '<div class="yw-msg" id="yw-im"></div><div><button class="pill" type="submit">Submit idea</button></div></form>';
  const voted=JSON.parse(localStorage.getItem('yw_votes')||'[]');
  async function load(){try{const r=await api('yw_ideas_public?select=*&order=supports.desc,created_at.desc&limit=60');
    q('#yw-il').innerHTML=r.length?r.map((x,i)=>'<article class="yw-item" style="animation-delay:'+i*60+'ms"><div class="yw-body"><h3>💡 '+esc(x.title)+'</h3><p>'+esc(x.description)+'</p><div class="yw-meta">'+(x.is_sample?'<span class="yw-chip yw-sample">Sample</span>':'')+
      '<span class="yw-chip yw-pts">'+esc(x.status==='Approved'?'Open':x.status)+'</span><span class="yw-chip">'+esc(x.category)+'</span><span class="yw-chip">👤 '+esc(x.first_name)+', '+esc(x.district)+'</span></div>'+
      '<div class="yw-btns"><button class="yw-btn yw-sup'+(voted.includes(x.id)?' yw-done':'')+'" data-id="'+esc(x.id)+'">👍 Support · <span>'+esc(x.supports)+'</span></button></div></div></article>').join(''):'<div class="yw-empty">No ideas on the wall yet.</div>';
    qa('.yw-sup').forEach(b=>b.onclick=async()=>{if(b.classList.contains('yw-done'))return;const p=prompt('Enter your mobile number to support (one support per number). It is never shown publicly.');if(p==null)return;
      if(!phoneOk(p))return alert('Enter a valid 10-digit mobile number.');
      try{const r=await rpc('yw_support_idea',{p_idea:b.dataset.id,p_phone:p});if(r.status==='ok'||r.status==='duplicate'){b.classList.add('yw-done');q('span',b).textContent=r.supports;voted.push(b.dataset.id);localStorage.setItem('yw_votes',JSON.stringify(voted));if(r.status==='duplicate')alert('This number has already supported this idea.')}
        else alert(r.status==='limited'?'Too many requests. Try again later.':'Could not record your support.')}catch(e){alert(e.message)}})}
    catch(e){q('#yw-il').innerHTML=fail(e)}}
  load();
  const f=q('#yw-if');f.onsubmit=async ev=>{ev.preventDefault();const m=q('#yw-im');
    if(f.t.value.trim().length<3)return msg(m,'Enter a title.');if(!f.c.value)return msg(m,'Select a category.');if(f.d.value.trim().length<10)return msg(m,'Describe your idea (at least 10 characters).');
    if(f.n.value.trim().length<2)return msg(m,'Enter your name.');if(!f.s.value)return msg(m,'Select your district.');if(!cool('idea',30))return msg(m,'Please wait a few seconds before sending again.');
    try{const r=await rpc('yw_submit_idea',{p_title:f.t.value.trim(),p_description:f.d.value.trim(),p_category:f.c.value,p_name:f.n.value.trim(),p_district:f.s.value});
      if(r.status==='ok'){msg(m,'Thank you! Your idea will appear on the wall after review.',1);f.reset()}else msg(m,r.status==='limited'?'Too many requests. Try again later.':'Please check your details.')}catch(e){msg(m,e.message)}};
}

/* ---------- Admin moved to /admin (separate page; authorisation enforced by Supabase RLS) ---------- */
function vAdmin(){location.replace('/admin.html')}


const NAVS=[['','YouthWing'],['feeds','YW Feeds'],['podcast','Podcast'],['books','Bookshelf'],['leaderboard','Leaderboard'],['complaints','Complaints'],['ideas','Ideas']];
function ywNav(view){
  let n=document.getElementById('yw-lk');
  if(!n){const lk=document.getElementById('lk');if(!lk)return;n=document.createElement('div');n.id='yw-lk';n.className='yw-lk';
    n.innerHTML='<a class="yw-back" href="#top">← Main site</a>'+NAVS.map(x=>'<a data-v="'+x[0]+'" href="#yw'+(x[0]?'/'+x[0]:'')+'">'+x[1]+'</a>').join('');lk.after(n)}
  [...n.querySelectorAll('[data-v]')].forEach(a=>{const on=a.dataset.v===(view||'');a.classList.toggle('yw-cur',on);if(on&&a.scrollIntoView)a.scrollIntoView({block:'nearest',inline:'center'})});
}
/* ---------- Router ---------- */
let wasOn=false;
function route(){
  const h=location.hash||'';
  if(!/^#yw(\/|$)/.test(h)){
    if(wasOn){document.body.classList.remove('yw-on');root.hidden=true;wasOn=false;const t=h&&h.length>1&&document.getElementById(decodeURIComponent(h.slice(1)));if(t)t.scrollIntoView();else scrollTo(0,0)}
    return;
  }
  const lk=document.getElementById('lk');if(lk)lk.classList.remove('open');
  document.body.classList.add('yw-on');root.hidden=false;wasOn=true;scrollTo(0,0);
  const cEl=document.querySelector('link[href*="yw.css"]');if(cEl&&cEl.media!=='all')cEl.media='all';
  const [,view,sub]=h.slice(1).split('/');
  ywNav(view==='admin'?'#':view);
  ({feeds:vFeeds,podcast:vPodcast,books:vBooks,leaderboard:vBoard,complaints:vComplaints,ideas:vIdeas,admin:vAdmin}[view]||vHome)(sub);
}
addEventListener('hashchange',route);route();
})();
