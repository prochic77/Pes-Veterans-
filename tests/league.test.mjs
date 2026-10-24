import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
const moduleURL=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const leagueURL=moduleURL(compile('lib/league.ts'));
const {fixtures,standings}=await import(leagueURL);
const sql=new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const DB={prepare(query){return {bind(...params){return {async all(){return {results:sql.prepare(query).all(...params)}},query,params}}}},async batch(stmts){sql.exec('BEGIN');try{const results=stmts.map(s=>({meta:{changes:Number(sql.prepare(s.query).run(...s.params).changes)}}));sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
globalThis.__leagueEnv={DB,ADMIN_EMAIL:'admin@example.test'};
const source=compile('app/api/league/route.ts').replace(/import \{ env \} from ['"]cloudflare:workers['"];?/,'const env=globalThis.__leagueEnv;').replace(/from ['"]\.\.\/\.\.\/\.\.\/lib\/league['"]/,'from '+JSON.stringify(leagueURL));
const {GET,POST}=await import(moduleURL(source));
let user='admin',email='admin@example.test';
async function get(){const r=await GET(new Request('https://league.test/api/league',{headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':email}}));assert.equal(r.status,200);return r.json()}
async function post(body,status=200,extra={}){const r=await POST(new Request('https://league.test/api/league',{method:'POST',headers:{origin:'https://league.test','oai-authenticated-user-id':user,'oai-authenticated-user-email':email,...extra},body:JSON.stringify(body)}));const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data}
function login(i){user='u'+i;email='player'+i+'@example.test'}
function asAdmin(){user='admin';email='admin@example.test'}
test('round robin covers every pair exactly once for odd and even entries',()=>{for(const n of [2,3,4,5,8,32]){const fs=fixtures(Array.from({length:n},(_,i)=>''+i));assert.equal(fs.length,n*(n-1)/2);assert.equal(new Set(fs.map(f=>[f.home,f.away].sort().join('/'))).size,fs.length);for(const r of new Set(fs.map(f=>f.round))){const ids=fs.filter(f=>f.round===r).flatMap(f=>[f.home,f.away]);assert.equal(ids.length,new Set(ids).size)}}assert.throws(()=>fixtures(['1']));assert.throws(()=>fixtures(['1','2','3'],true))});
test('full workflow: identity, approval, leagues, career totals, 2v2 and knockout',async()=>{
 await post({action:'apply',nickname:'Ghost'},401,{'oai-authenticated-user-id':''});
 await post({action:'create',name:'Forged',kind:'dream',mode:1},403,{origin:'https://evil.test'});
 for(let i=1;i<=4;i++){login(i);await post({action:'apply',nickname:'Veteran '+i});await post({action:'create',name:'Forbidden',kind:'dream',mode:1},403);await post({action:'apply',nickname:'Again'},400)}
 asAdmin();let d=await get();assert.equal(d.pending.length,4);
 for(const p of d.pending)await post({action:'approve',playerId:p.id,status:'approved'});
 await post({action:'create',name:'Main season',kind:'dream',mode:1});d=await get();const c=d.competitions[0];
 for(let i=1;i<=3;i++){login(i);await post({action:'join',competitionId:c.id,team:'Dream '+i});await post({action:'join',competitionId:c.id,team:'Duplicate'},400)}
 login(4);await post({action:'start',competitionId:c.id},403);asAdmin();await post({action:'start',competitionId:c.id});await post({action:'start',competitionId:c.id},400);
 d=await get();let ms=d.matches.filter(m=>m.competition_id===c.id);assert.equal(ms.length,3);
 login(4);await post({action:'join',competitionId:c.id,team:'Late'},400);await post({action:'result',matchId:ms[0].id,homeScore:2,awayScore:1},403);asAdmin();
 await post({action:'result',matchId:ms[0].id,homeScore:-1,awayScore:1},400);
 for(const m of ms)await post({action:'result',matchId:m.id,homeScore:2,awayScore:1});
 await post({action:'result',matchId:ms[0].id,homeScore:3,awayScore:0},400);
 d=await get();assert.equal(d.competitions.find(x=>x.id===c.id).status,'finished');const table=standings(d.entries.filter(e=>e.competition_id===c.id),d.matches);assert.equal(table.reduce((n,r)=>n+r.played,0),6);assert.equal(table.reduce((n,r)=>n+r.points,0),9);
 await post({action:'create',name:'Doubles',kind:'quick',mode:2});d=await get();const duo=d.competitions.find(x=>x.name==='Doubles');
 login(1);d=await get();const self=d.me.id,p2=d.players.find(x=>x.nickname==='Veteran 2').id;
 await post({action:'join',competitionId:duo.id,team:'Milan',partnerId:self},400);
 await post({action:'join',competitionId:duo.id,team:'Milan',partnerId:p2});login(2);await post({action:'join',competitionId:duo.id,team:'Milan',partnerId:self},400);
 login(3);d=await get();await post({action:'join',competitionId:duo.id,team:'Ajax',partnerId:d.players.find(x=>x.nickname==='Veteran 4').id});
 asAdmin();await post({action:'start',competitionId:duo.id});d=await get();const dm=d.matches.find(m=>m.competition_id===duo.id);await post({action:'result',matchId:dm.id,homeScore:3,awayScore:3});
 d=await get();const totals=standings(d.entries,d.matches);for(const p of d.players){const count=totals.filter(e=>e.player_id===p.id||e.partner_id===p.id).reduce((n,r)=>n+r.played,0);assert.equal(count,p.nickname==='Veteran 4'?1:3)}
 await post({action:'create',name:'Veterans Cup',kind:'cup',mode:1});d=await get();const cup=d.competitions.find(x=>x.name==='Veterans Cup');
 for(let i=1;i<=4;i++){login(i);await post({action:'join',competitionId:cup.id,team:'Club '+i})}
 asAdmin();await post({action:'start',competitionId:cup.id});d=await get();const semi=d.matches.filter(m=>m.competition_id===cup.id);assert.equal(semi.length,2);
 await post({action:'result',matchId:semi[0].id,homeScore:1,awayScore:1},400);
 for(const m of semi)await post({action:'result',matchId:m.id,homeScore:2,awayScore:0});
 d=await get();const final=d.matches.find(m=>m.competition_id===cup.id&&m.round===2);assert.ok(final);assert.equal(d.matches.filter(m=>m.competition_id===cup.id).length,3);
 await post({action:'result',matchId:final.id,homeScore:1,awayScore:0});d=await get();assert.equal(d.competitions.find(c=>c.id===cup.id).status,'finished');
 assert.ok(sql.prepare('SELECT count(*) n FROM audit').get().n>10);
 login(1);d=await get();assert.equal(d.pending.length,0);assert.ok(d.players.every(p=>!('user_id'in p)&&!('email'in p)));
});
