import { daysAgoISO, daysAheadISO, tsAgo } from '../lib'

/* ── Palettes ─────────────────────────────────────────────── */
export const TAG_COLORS = ['#f43f5e','#f97316','#fbbf24','#34d399','#38bdf8','#818cf8','#a78bfa','#f472b6','#22d3ee','#94a3b8']
export const TAG_ICONS = ['🏷️','⭐','💼','❤️','🏏','📍','🎯','🎨','⚙️','🎫','💡','🔥','🤝','🗂️','🌐','📌']

/* ── Groups ───────────────────────────────────────────────── */
export const GROUPS = [
  { id: 'g_family',  name: 'Family',          color: '#f43f5e', desc: 'Relatives & household' },
  { id: 'g_work',    name: 'Work Colleagues', color: '#38bdf8', desc: 'Colleagues & professional circle' },
  { id: 'g_friends', name: 'Close Friends',   color: '#34d399', desc: 'The inner circle' },
  { id: 'g_clients', name: 'Clients',         color: '#fbbf24', desc: 'Paying clients & accounts' },
  { id: 'g_leads',   name: 'Leads',           color: '#a78bfa', desc: 'New leads to qualify' },
  { id: 'g_college', name: 'College Friends', color: '#22d3ee', desc: 'University batchmates' },
]

/* ── Relationship frequency presets ──────────────────────── */
export const REL_FREQ = {
  'close-friend': { label: 'Close Friend', everyDays: 14 },
  'family':       { label: 'Family',       everyDays: 21 },
  'client':       { label: 'Client',       everyDays: 30 },
  'colleague':    { label: 'Colleague',    everyDays: 45 },
  'lead':         { label: 'Lead',         everyDays: 7 },
  'acquaintance': { label: 'Acquaintance', everyDays: 90 },
}

/* ── Tags ─────────────────────────────────────────────────── */
export const TAGS = [
  { id: 't_vip',     name: 'VIP',             color: '#fbbf24', icon: '⭐' },
  { id: 't_invest',  name: 'Investors',       color: '#818cf8', icon: '💼' },
  { id: 't_cricket', name: 'Cricket circle',  color: '#34d399', icon: '🏏' },
  { id: 't_dhaka',   name: 'Dhaka',           color: '#38bdf8', icon: '📍' },
  { id: 't_remote',  name: 'Remote',          color: '#22d3ee', icon: '🌐' },
  { id: 't_q4',      name: 'Follow-up Q4',    color: '#f97316', icon: '🎯' },
  { id: 't_design',  name: 'Design',          color: '#f472b6', icon: '🎨' },
  { id: 't_eng',     name: 'Engineering',     color: '#94a3b8', icon: '⚙️' },
  { id: 't_fam',     name: 'Family events',   color: '#f43f5e', icon: '❤️' },
  { id: 't_conf',    name: 'Conference 2026', color: '#a78bfa', icon: '🎫' },
]

/* ── Contacts (24) — lastContact/createdAt relative to today ─ */
const C = (id, name, role, company, phone, email, groupId, tags, rel, birthday, lastDaysAgo, createdDaysAgo, extra = {}) => ({
  id, name, role, company, phone, email, groupId, tags, rel, birthday,
  lastContact: daysAgoISO(lastDaysAgo), createdAt: daysAgoISO(createdDaysAgo),
  introducedBy: extra.introducedBy || null, starred: !!extra.starred, anniversary: extra.anniversary || null, giftIdeas: extra.giftIdeas || '', interests: extra.interests || [], socials: extra.socials || {},
})
export const CONTACTS = [
  C('c1','Rahim Uddin','Manager','Delta Textiles','+880 1711-402233','rahim.u@gmail.com','g_family',['t_fam','t_dhaka'],'family','1975-11-03',9,380,{socials:{"facebook": "https://facebook.com/rahim.uddin.bd", "whatsapp": "+8801711402233"},interests:["village politics", "textile trade", "cricket"],starred:true,anniversary:'2005-12-14'}),
  C('c2','Ayesha Siddiqua','Pediatrician','Square Hospital','+880 1799-118834','ayesha.s@protonmail.com','g_friends',['t_vip','t_dhaka'],'close-friend','1992-09-21',16,340,{socials:{"instagram": "https://instagram.com/ayesha.bakes"},interests:["baking", "french cinema", "book club"],starred:true,giftIdeas:'Medical thrillers, stethoscope charm'}),
  C('c3','Tanvir Hasan','Senior Developer','Tiger IT','+880 1552-907741','tanvir@tigerit.com.bd','g_work',['t_eng','t_remote'],'colleague','1990-05-14',42,315,{socials:{"linkedin": "https://linkedin.com/in/tanvir-hasan-sre", "twitter": "https://x.com/tanvir_devops", "website": "https://tanvir.dev"},interests:["devops", "kubernetes", "badminton"]}),
  C('c4','Nusrat Jahan','Lecturer','Dhaka University','+880 1812-334455','nusrat.j@du.ac.bd','g_college',['t_dhaka'],'acquaintance','1987-02-11',120,300,{interests:["research", "bengali poetry", "teaching"]}),
  C('c5','Arjun Mehta','Founding Partner','SkyBridge VC','+91 98110 22445','arjun@skybridge.vc','g_clients',['t_vip','t_invest','t_conf'],'client','1985-08-30',38,290,{socials:{"linkedin": "https://linkedin.com/in/arjunmehta-vc", "twitter": "https://x.com/arjun_dealflow"},interests:["fintech", "term sheets", "espresso"],starred:true,giftIdeas:'Rare single malt, leather-bound planner'}),
  C('c6','Vikram Rao','Product Lead','FinEdge','+91 98200 77381','vikram@finedge.io','g_clients',['t_invest','t_q4'],'client','1988-09-18',31,285,{socials:{"linkedin": "https://linkedin.com/in/arjunmehta-vc", "twitter": "https://x.com/arjun_dealflow"},interests:["fintech", "term sheets", "espresso"],introducedBy:'Arjun Mehta',giftIdeas:'Noise-cancelling earbuds'}),
  C('c7','Priya Sharma','UX Designer','Freelance','+91 99871 00234','priya.designs@gmail.com','g_friends',['t_design','t_remote'],'close-friend','1993-10-02',12,270,{socials:{"instagram": "https://instagram.com/priya.designs", "website": "https://priyasharma.design"},interests:["brand design", "typography", "mid-century furniture"],introducedBy:'Sadia Afrin'}),
  C('c8','Mehedi Hasan','Sales Executive','Airtel BD','+880 1613-558899','mehedi.airtel@gmail.com','g_leads',['t_q4'],'lead',null,12,18,{socials:{"twitter": "https://x.com/mehedi_games"},interests:["telecom", "gaming", "street food"]}),
  C('c9','Sadia Afrin','Architect','Vitti','+880 1703-661122','sadia@vitti.com.bd','g_work',['t_design','t_dhaka'],'colleague','1991-06-09',20,250,{socials:{"linkedin": "https://linkedin.com/in/sadia-uxr", "instagram": "https://instagram.com/sadia.pots"},interests:["UX research", "pottery", "solo travel"],introducedBy:'Arif Chowdhury'}),
  C('c10','Farhan Ahmed','Coach','Dhaka Cricket Academy','+880 1884-220099','farhan.plays@gmail.com','g_friends',['t_cricket'],'close-friend','1994-01-27',1,240,{socials:{"facebook": "https://facebook.com/coach.farhan", "instagram": "https://instagram.com/farhan.coaches"},interests:["cricket coaching", "sports science", "fitness trackers"],giftIdeas:'Cricket spikes, academy hoodie'}),
  C('c11','Imran Khan','Journalist','The Daily Star','+880 1721-889900','imran.k@dailystar.com.bd','g_college',['t_conf'],'acquaintance','1986-12-01',60,220,{socials:{"twitter": "https://x.com/imran_reports", "website": "https://dailystar.com.bd/authors/imran"},interests:["investigative journalism", "data privacy", "podcasts"]}),
  C('c12','Rina Das','Homemaker','','+880 1944-112266','rina.das@yahoo.com','g_family',['t_fam'],'family','1970-04-22',30,210,{interests:["sponsorships", "event marketing", "cycling"],anniversary:'1996-02-20',giftIdeas:'Handloom saree (jamuna green)'}),
  C('c13','Karim Sheikh','CEO','TradePort','+880 1711-009988','karim@tradeport.com.bd','g_clients',['t_vip','t_q4'],'client','1980-03-19',10,200,{socials:{"linkedin": "https://linkedin.com/in/karim-tradeport"},interests:["logistics", "port trade", "investing"],starred:true,anniversary:'2010-01-08',giftIdeas:'Fountain pen, golf lesson voucher'}),
  C('c14','Laila Noor','PhD Researcher','BUET','+880 1632-445511','laila.noor@buet.ac.bd','g_college',['t_eng'],'acquaintance','1992-07-07',95,190),
  C('c15','Arif Chowdhury','Relationship Manager','BRAC Bank','+880 1755-667788','arif.c@bracbank.com','g_work',['t_dhaka'],'colleague','1989-09-30',2,180),
  C('c16','Shabnam Rahman','Nutritionist','','+880 1866-990011','shabnam.nutri@gmail.com','g_friends',['t_cricket'],'close-friend','1995-05-05',9,170,{anniversary:'2021-11-19'}),
  C('c17','Dilip Kumar','Supplier','Kumar Trading','+91 98300 11223','dilip@kumartrading.in','g_leads',[],'lead','1978-10-15',4,12),
  C('c18','Anika Tahsin','Marketing Manager','bKash','+880 1789-223344','anika@bkash.com.bd','g_work',['t_design','t_conf'],'colleague','1991-11-11',50,160,{socials:{"linkedin": "https://linkedin.com/in/tanvir-hasan-sre", "twitter": "https://x.com/tanvir_devops", "website": "https://tanvir.dev"},interests:["devops", "kubernetes", "badminton"],introducedBy:'Tanvir Hasan'}),
  C('c19','Rafiq Islam','Retired Engineer','','+880 1712-778899','rafiq.islam@gmail.com','g_family',['t_fam'],'family','1965-01-08',6,150,{anniversary:'1992-09-25'}),
  C('c20','Sunita Verma','Angel Investor','SV Capital','+91 98100 55667','sunita@svcapital.in','g_clients',['t_vip','t_invest'],'client','1979-06-25',44,140,{socials:{"linkedin": "https://linkedin.com/in/arjunmehta-vc", "twitter": "https://x.com/arjun_dealflow"},interests:["fintech", "term sheets", "espresso"],introducedBy:'Arjun Mehta'}),
  C('c21','Jamal Hossain','Fleet Manager','Pathao','+880 1990-334455','jamal.fleet@pathao.com','g_leads',['t_dhaka'],'lead',null,3,8,{interests:["e-commerce", "pop culture", "photography"]}),
  C('c22','Tania Sultana','Photographer','Studio Tan','+880 1677-889900','tania@studiotan.com','g_college',['t_design'],'acquaintance','1993-08-17',30,120),
  C('c23','Reza Karim','Partner','Lex Partners','+880 1818-112299','reza@lexpartners.com.bd','g_clients',['t_vip'],'client','1983-04-02',15,110),
  C('c24','Mitu Akter','Teacher','Viqarunnisa School','+880 1922-556677','mitu.akter@gmail.com','g_friends',['t_dhaka'],'close-friend','1990-12-12',21,100,{interests:["motherhood", "meal prep", "tabla"]}),
]

/* ── Tasks ────────────────────────────────────────────────── */
const T = (id, title, column, priority, dueDaysOffset, contactId = null, tags = [], extra = {}) => ({
  id, title, column, priority, due: dueDaysOffset === null ? null : (dueDaysOffset >= 0 ? daysAheadISO(dueDaysOffset) : daysAgoISO(-dueDaysOffset)), contactId, tags,
  desc: extra.desc || '', subtasks: extra.subtasks || [],
})
export const TASKS = [
  T('t1','Prep SkyBridge pitch deck','todo','high',2,'c5',['t_q4'],{desc:"Final deck for the partner meeting \u2014 keep it under 14 slides.",subtasks:[{id:'t1s1',text:"Lock the market-sizing numbers with Arjun",done:false},{id:'t1s2',text:"Add unit-economics slide",done:false},{id:'t1s3',text:"Rehearse the 7-min narrative",done:false}]}),
  T('t2','Send proposal to Vikram (FinEdge)','todo','high',0,'c6',[],{desc:"Vikram asked for annual seat pricing + a compliance annex. CC legal.",subtasks:[{id:'t2s1',text:"Update pricing table",done:false},{id:'t2s2',text:"Attach compliance annex",done:false},{id:'t2s3',text:"Send before Thursday 5pm",done:false}]}),
  T('t3','Buy birthday gift for Ayesha','todo','med',2,'c2'),
  T('t4','Review TradePort contract renewal','todo','high',-1,'c13',[],{desc:"Renewal clause review \u2014 watch the auto-escalation on page 12.",subtasks:[]}),
  T('t5','CRM sync rule testing','progress','med',5,null,['t_eng'],{desc:"Dry-run the two-way sync in staging before enabling for production contacts.",subtasks:[{id:'t5s1',text:"Seed 20 fake contacts",done:true},{id:'t5s2',text:"Run import twice",done:false},{id:'t5s3',text:"Check conflict queue",done:false}]}),
  T('t6','Update investor pipeline sheet','progress','high',1,null,['t_invest']),
  T('t7','Book cricket ground for October','progress','low',9,'c10',[],{desc:"Pick the venue first, then invites. ~40 people.",subtasks:[{id:'t7s1',text:"Shortlist 3 venues",done:false},{id:'t7s2',text:"Draft guest list",done:false},{id:'t7s3',text:"Book catering",done:false}]}),
  T('t8','Waiting on Dilip\'s price list','waiting','med',-2,'c17'),
  T('t9','Legal docs from Reza','waiting','med',3,'c23',[],{desc:"Partnership agreement for the joint venture — needs notarization before Friday.",subtasks:[{id:'t9s1',text:"Collect NID copies",done:false},{id:'t9s2',text:"Notarize at Gulshan office",done:false},{id:'t9s3',text:"Counter-sign and file",done:false}]}),
  T('t10','bKash campaign feedback','waiting','low',4,'c18'),
  T('t11','Plan quarterly family dinner','done','med',-4,'c1',['t_fam']),
  T('t12','Renew domain bitscol.dev','done','med',-7),
  T('t13','Send Eid greetings to family group','done','low',-12,null,[],{desc:"Blast the family group before Eid morning — reuse last year's card art if time is short.",subtasks:[{id:'t13s1',text:"Shortlist e-card image",done:true},{id:'t13s2',text:"Send to family WhatsApp group",done:false}]}),
  T('t14','Publish portfolio update','done','low',-9),
]

/* ── Calendar events ──────────────────────────────────────── */
const E = (id, title, dayOffset, time, endTime, type, contactId = null, gcal = 'local', location = '') => ({
  id, title, date: dayOffset >= 0 ? daysAheadISO(dayOffset) : daysAgoISO(-dayOffset),
  time, endTime, type, contactId, gcal, location,
})
export const EVENTS = [
  E('e1','Team standup',0,'10:00','10:30','meeting',null,'local'),
  E('e2','Call Vikram — wish happy birthday 🎂',0,'18:00','18:20','call','c6','local'),
  E('e3','Design sync with Priya',1,'11:30','12:15','meeting','c7','local'),
  E('e4','Pitch review — SkyBridge',3,'14:00','15:00','meeting','c5','local','Gulshan Club'),
  E('e5','Doctor follow-up (Sadia\'s referral)',4,'09:30','10:00','personal',null,'local'),
  E('e6','Client call: TradePort renewal',6,'16:00','16:45','call','c13','local'),
  E('e7','Dhaka Founders Meetup',8,'18:30','20:30','meeting',null,'local','Gulshan Club'),
  E('e8','Call Sunita — reconnect',9,'15:00','15:30','follow-up','c20','local'),
  E('e9','Cricket friendly match',12,'08:00','10:00','personal','c10','local','Mirpur Ground 2'),
  E('e10','Design review',-2,'13:00','14:00','meeting','c9','local'),
  E('e11','Intro call: Mehedi (Airtel)',-5,'12:00','12:30','call','c8','local'),
  E('e12','Quarterly planning',14,'10:00','12:00','meeting',null,'local'),
]

/* ── Notes ────────────────────────────────────────────────── */
export const NOTES = [
  { id:'n1', title:'Arjun prefers WhatsApp', body:'Email is fine for docs, but he replies to WhatsApp within the hour. SkyBridge is actively deploying — invested $2M in fintech seed funds this year.', contactIds:['c5'], pinned:true,  updated:tsAgo(60*26) },
  { id:'n2', title:'Call log: Vikram', body:'Wants the proposal by Friday. Budget approved ~$40k. Decision-maker is their CTO, include technical appendix.', contactIds:['c6'], pinned:false, updated:tsAgo(60*5) },
  { id:'n3', title:'Gift ideas', body:'Ayesha: medical thrillers, stethoscope charm. Rina: handloom saree (jamuna green). Vikram: noise-cancelling buds.', contactIds:['c2','c12','c6'], pinned:false, updated:tsAgo(60*50) },
  { id:'n4', title:'Conference 2026 shortlist', body:'Send early-bird links to Arjun, Imran and Anika before prices double in November.', contactIds:['c5','c11','c18'], pinned:true,  updated:tsAgo(60*90) },
  { id:'n5', title:'TradePort renewal terms', body:'Karim wants a 2-year lock with quarterly reviews. Legal to confirm exit clause wording.', contactIds:['c13'], pinned:false, updated:tsAgo(60*130) },
  { id:'n6', title:'Cricket academy sponsorship', body:'Farhan asked if we\'d sponsor jerseys for the under-15 squad — ~৳45,000 including printing.', contactIds:['c10'], pinned:false, updated:tsAgo(60*200) },
]

/* ── Sync rules ───────────────────────────────────────────── */
export const SYNC_RULES = [
  { id:'r1', name:'Google Contacts ↔ CRM', source:'Google Contacts', direction:'Two-way', frequency:'Hourly', scope:'selected', scopeGroups:['g_work','g_clients'], scopeTags:[], delivery:'Auto-apply changes', conflict:'prefer-local', enabled:true, lastRun:tsAgo(120) },
  { id:'r2', name:'iCloud CardDAV import', source:'CardDAV (iCloud)', direction:'Import', frequency:'Daily', scope:'selected', scopeGroups:[], scopeTags:['t_vip'], delivery:'Review queue', conflict:'manual', enabled:true, lastRun:tsAgo(60*26) },
  { id:'r3', name:'Birthdays → Google Calendar', source:'Google Calendar', direction:'Export', frequency:'Weekly', scope:'all', scopeGroups:[], scopeTags:[], delivery:'Notify only', conflict:'newest', enabled:false, lastRun:tsAgo(60*24*6) },
]

/* ── Audit log ────────────────────────────────────────────── */
const A = (mins, actor, action, entity, detail, status = 'ok') => ({ id: `a${mins}`, ts: tsAgo(mins), actor, action, entity, detail, status })
export const AUDIT = [
  A(12,'rule','Sync run completed','Google Contacts ↔ CRM','Checked 42 records · 0 conflicts'),
  A(95,'user','Logged contact','Arif Chowdhury','Phone call · 12 min'),
  A(180,'user','Edited contact','Ayesha Siddiqua','Updated email address'),
  A(320,'system','Reminder queued','Follow-Up Tracker','Sunita Verma overdue by 14d'),
  A(60*7,'rule','Conflict detected','iCloud CardDAV import','Vikram Rao · phone differs on both sides','warn'),
  A(60*9,'user','Imported vCard','sep-17-contacts.vcf','4 added · 1 updated'),
  A(60*25,'rule','Sync run completed','iCloud CardDAV import','2 items moved to review queue','warn'),
  A(60*30,'system','Backup created','Local vault backup','contacts.json · 24 records'),
  A(60*24*4,'user','Connected Google Calendar','Integrations','OAuth consent granted · read/write'),
]

/* ── Activity feed ────────────────────────────────────────── */
const ACT = (mins, text, contactId = null) => ({ id: `ac${mins}`, ts: tsAgo(mins), text, contactId })
export const ACTIVITY = [
  ACT(25,'Reviewed proposal draft for FinEdge','c6'),
  ACT(95,'Logged call with Arif Chowdhury (12 min)','c15'),
  ACT(60*5,'Added note: "Call log: Vikram"','c6'),
  ACT(60*9,'Imported 4 contacts from sep-17-contacts.vcf'),
  ACT(60*11,'Task completed: Send Eid greetings to family group'),
  ACT(60*30,'Meeting with Karim Sheikh — TradePort renewal','c13'),
  ACT(60*52,'Tagged 3 contacts as VIP'),
  ACT(60*75,'Sent pricing follow-up email to Sunita Verma','c20'),
  ACT(60*98,'Created follow-up task for Mitu Akter','c24'),
  ACT(60*24*5,'Contact added: Dilip Kumar (lead)','c17'),
]

/* ── Import history ───────────────────────────────────────── */
export const IMPORTS = [
  { id:'i1', ts: tsAgo(60*26), source:'sep-17-contacts.vcf', added:4, updated:1, skipped:0, rolledBack:false, details:[
    { contactId:'c8',  name:'Mehedi Hasan',  status:'updated', changes:[{ field:'phone', from:'+880 1613-112233', to:'+880 1613-558899' }] },
    { contactId:'c17', name:'Dilip Kumar',   status:'added',   changes:[{ field:'record', from:'', to:'new contact' }] },
    { contactId:'c21', name:'Jamal Hossain', status:'added',   changes:[{ field:'record', from:'', to:'new contact' }] },
    { contactId:'x-demo-1', name:'Sabbir Ahmed', status:'added', changes:[{ field:'record', from:'', to:'new contact' }] },
    { contactId:'x-demo-2', name:'Nirav Shah',   status:'added', changes:[{ field:'record', from:'', to:'new contact' }] },
  ] },
  { id:'i2', ts: tsAgo(60*24*12), source:'icloud-export.vcf', added:18, updated:2, skipped:3, rolledBack:false, details:null },
]

/* ── Connection state ─────────────────────────────────────── */
export const CARDDAV = null
export const GCAL = { connected: false, email: null, lastSync: null }

