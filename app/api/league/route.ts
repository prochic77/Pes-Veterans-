import { env } from 'cloudflare:workers';
import { fixtures } from '../../../lib/league';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status})}
function identity(r:Request){return {id:r.headers.get('oai-authenticated-user-id'),email:r.headers.get('oai-authenticated-user-email')}}
function admin(r:Request){const u=identity(r);return !!u.id&&!!u.email&&u.email.toLowerCase()===(env as any).ADMIN_EMAIL?.toLowerCase()}
function db(){if(!env.DB)fail('Databáze není dostupná.',503);return env.DB!}
async function all(sql:string,...args:any[]){return (await db().prepare(sql).bind(...args).all()).results as any[]}
function text(v:unknown,max=60){if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail('Vyplň text o délce 1 až '+max+' znaků.');return v.trim()}
const uid=()=>crypto.randomUUID();
export async function GET(r:Request){try{
 const u=identity(r),isAdmin=admin(r);
 const [players,competitions,entries,matches]=await Promise.all([all("SELECT id,nickname,status FROM players WHERE status='approved'"),all('SELECT * FROM competitions ORDER BY created_at DESC'),all('SELECT * FROM entries ORDER BY id'),all('SELECT * FROM matches ORDER BY round,id')]);
 const me=u.id?(await all('SELECT id,nickname,status FROM players WHERE user_id=?',u.id))[0]??null:null;
 const pending=isAdmin?await all("SELECT id,nickname,status,created_at FROM players WHERE status!='approved'"):[];
 return json({players,competitions,entries,matches,me,signedIn:!!u.id,isAdmin,pending});
 }catch(e:any){return json({error:'Data ligy se nepodařilo načíst.'},e.status||500)}}
export async function POST(r:Request){try{
 if(r.headers.get('origin')!==new URL(r.url).origin)fail('Neplatný původ požadavku.',403);
 const u=identity(r);if(!u.id||!u.email)fail('Nejdřív se přihlas.',401);
 const raw=await r.text();if(raw.length>10000)fail('Požadavek je příliš velký.',413);
 let b:any;try{b=JSON.parse(raw)}catch{fail('Neplatná data.')}if(!b||typeof b!=='object')fail('Neplatná data.');
 const action=b.action,stmts:D1PreparedStatement[]=[];
 if(action==='apply'){
  const nickname=text(b.nickname,24);if(!/^[\p{L}\p{N} _.-]+$/u.test(nickname))fail('Použij písmena, čísla, mezeru, tečku, pomlčku nebo podtržítko.');
  if((await all('SELECT id FROM players WHERE user_id=?',u.id)).length)fail('Přihláška už existuje.');
  stmts.push(db().prepare('INSERT INTO players (id,user_id,nickname,status,created_at) VALUES (?,?,?,?,?)').bind(uid(),u.id,nickname,'pending',new Date().toISOString()));
 }else if(action==='join'){
  const p=(await all('SELECT * FROM players WHERE user_id=?',u.id))[0];if(!p||p.status!=='approved')fail('Nejdřív musí správce schválit tvou přihlášku.',403);
  const c=(await all('SELECT * FROM competitions WHERE id=?',text(b.competitionId)))[0];if(!c||c.status!=='open')fail('Přihlášky do soutěže jsou uzavřené.');
  const partner=c.mode===2?text(b.partnerId):null;if(partner===p.id)fail('Vyber jiného spoluhráče.');
  if(partner&&!(await all("SELECT id FROM players WHERE id=? AND status='approved'",partner)).length)fail('Spoluhráč musí být schválený.');
  stmts.push(db().prepare(`INSERT INTO entries (id,competition_id,player_id,partner_id,team) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM competitions WHERE id=? AND status='open') AND NOT EXISTS (SELECT 1 FROM entries WHERE competition_id=? AND (player_id IN (?,?) OR partner_id IN (?,?))) AND (SELECT count(*) FROM entries WHERE competition_id=?)<32`).bind(uid(),c.id,p.id,partner,text(b.team,40),c.id,c.id,p.id,partner,p.id,partner,c.id));
 }else{
  if(!admin(r))fail('Tato akce je jen pro správce.',403);
  if(action==='approve'){
   if(!['approved','rejected'].includes(b.status))fail('Neplatný stav.');
   if(!(await all('SELECT id FROM players WHERE id=?',text(b.playerId))).length)fail('Hráč neexistuje.');
   stmts.push(db().prepare('UPDATE players SET status=? WHERE id=?').bind(b.status,b.playerId));
  }else if(action==='create'){
   if(!['dream','quick','cup'].includes(b.kind)||![1,2].includes(b.mode))fail('Neplatný formát soutěže.');
   stmts.push(db().prepare('INSERT INTO competitions (id,name,kind,mode,status,created_at) VALUES (?,?,?,?,?,?)').bind(uid(),text(b.name),b.kind,b.mode,'open',new Date().toISOString()));
  }else if(action==='start'){
   const c=(await all('SELECT * FROM competitions WHERE id=?',text(b.competitionId)))[0];if(!c||c.status!=='open')fail('Soutěž už byla zahájena.');
   const es=await all('SELECT * FROM entries WHERE competition_id=? ORDER BY id',c.id);
   let fs;try{fs=fixtures(es.map(e=>e.id),c.kind==='cup')}catch(e:any){fail(e.message)}
   stmts.push(db().prepare("UPDATE competitions SET status=CASE WHEN (SELECT count(*) FROM entries WHERE competition_id=?)=? THEN 'active' ELSE NULL END WHERE id=? AND status='open'").bind(c.id,es.length,c.id));
   for(const f of fs)stmts.push(db().prepare('INSERT INTO matches (id,competition_id,home_id,away_id,round,status) VALUES (?,?,?,?,?,?)').bind(c.id+':'+f.round+':'+f.home+':'+f.away,c.id,f.home,f.away,f.round,'scheduled'));
  }else if(action==='result'){
   const m=(await all('SELECT * FROM matches WHERE id=?',text(b.matchId,200)))[0];if(!m)fail('Zápas neexistuje.');if(m.status!=='scheduled')fail('Výsledek už byl potvrzen.');
   const c=(await all('SELECT * FROM competitions WHERE id=?',m.competition_id))[0];
   const h=b.homeScore,a=b.awayScore;if(!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||h>99||a>99)fail('Skóre musí být celé číslo od 0 do 99.');
   if(c.kind==='cup'&&h===a)fail('V poháru zadej konečné skóre po prodloužení nebo penaltách, aby měl zápas vítěze.');
   stmts.push(db().prepare("UPDATE matches SET home_score=?,away_score=?,status='confirmed' WHERE id=? AND status='scheduled'").bind(h,a,m.id));
   if(c.kind==='cup'){
    stmts.push(db().prepare(`WITH winners AS (SELECT CASE WHEN home_score>away_score THEN home_id ELSE away_id END winner,ROW_NUMBER() OVER (ORDER BY id)-1 n FROM matches WHERE competition_id=? AND round=? AND status='confirmed') INSERT OR IGNORE INTO matches (id,competition_id,home_id,away_id,round,status) SELECT ?||':'||?||':'||a.n,?,a.winner,b.winner,?,'scheduled' FROM winners a JOIN winners b ON b.n=a.n+1 WHERE a.n%2=0 AND NOT EXISTS (SELECT 1 FROM matches WHERE competition_id=? AND round=? AND status!='confirmed')`).bind(c.id,m.round,c.id,m.round+1,c.id,m.round+1,c.id,m.round));
    stmts.push(db().prepare("UPDATE competitions SET status='finished' WHERE id=? AND (SELECT count(*) FROM matches WHERE competition_id=? AND round=?)=1 AND NOT EXISTS (SELECT 1 FROM matches WHERE competition_id=? AND status='scheduled')").bind(c.id,c.id,m.round,c.id));
   }else stmts.push(db().prepare("UPDATE competitions SET status='finished' WHERE id=? AND NOT EXISTS (SELECT 1 FROM matches WHERE competition_id=? AND status='scheduled')").bind(c.id,c.id));
  }else fail('Neznámá akce.');
  stmts.push(db().prepare('INSERT INTO audit (id,actor,action,created_at) VALUES (?,?,?,?)').bind(uid(),u.id,JSON.stringify(b),new Date().toISOString()));
 }
 const result=await db().batch(stmts);if(action==='join'&&!result[0].meta.changes)fail('Ty nebo spoluhráč už jste přihlášeni, soutěž se uzavřela, nebo je plná.');
 return json({ok:true});
 }catch(e:any){return json({error:e.status?e.message:(String(e.message).includes('UNIQUE')?'Přezdívka nebo zápis už existuje.':'Změnu se nepodařilo uložit. Obnov data a zkus to znovu.')},e.status||400)}}

