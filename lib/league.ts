export type Entry={id:string;competition_id:string;player_id:string;partner_id:string|null;team:string};
export type Match={id:string;competition_id:string;home_id:string;away_id:string;home_score:number|null;away_score:number|null;round:number;status:string};
export function standings(entries:Entry[],matches:Match[]){
 const rows=entries.map(e=>({...e,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,points:0}));
 for(const m of matches.filter(m=>m.status==='confirmed')){const h=rows.find(r=>r.id===m.home_id),a=rows.find(r=>r.id===m.away_id);if(!h||!a||m.home_score===null||m.away_score===null)continue;h.played++;a.played++;h.gf+=m.home_score;h.ga+=m.away_score;a.gf+=m.away_score;a.ga+=m.home_score;if(m.home_score>m.away_score){h.wins++;h.points+=3;a.losses++}else if(m.home_score<m.away_score){a.wins++;a.points+=3;h.losses++}else{h.draws++;a.draws++;h.points++;a.points++}}
 return rows.sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.team.localeCompare(b.team,'cs'));
}
export function fixtures(ids:string[],knockout=false){
 if(ids.length<2)throw new Error('Přihlas alespoň dva účastníky.');if(knockout&&(ids.length&(ids.length-1)))throw new Error('Pohár potřebuje 2, 4, 8, 16 nebo 32 účastníků.');
 if(knockout)return Array.from({length:ids.length/2},(_,i)=>({home:ids[2*i],away:ids[2*i+1],round:1}));
 const wheel:(string|null)[]=[...ids];if(wheel.length%2)wheel.push(null);const out:{home:string;away:string;round:number}[]=[];
 for(let r=1;r<wheel.length;r++){for(let i=0;i<wheel.length/2;i++){const a=wheel[i],b=wheel[wheel.length-1-i];if(a&&b)out.push({home:r%2?a:b,away:r%2?b:a,round:r})}wheel.splice(1,0,wheel.pop()!)}return out;
}
