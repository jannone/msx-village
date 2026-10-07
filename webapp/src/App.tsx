import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { BRIDGE_ADDRESS as B, OWNER_ADDRESS as D, DATA_SIZE, decodeSettlement } from '../shared/settlement';
import { acknowledgeSavedRevision } from '../shared/save-acknowledgement';
interface User { id:string; username:string }
interface Plot { id:string; x:number; y:number; revision:number; username:string }
interface Bus { read(address:number):number; write(address:number,value:number):void }
interface PlayerWindow extends Window { WMSX?: { room?: { machine?: { bus?: Bus } } } }
class ApiError extends Error { constructor(public status:number,message:string,public revision?:number){super(message);} }
async function api<T>(path:string,method='GET',body?:unknown):Promise<T> {
 const response=await fetch(path,{method,signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const result=await response.json();
 if(!response.ok)throw new ApiError(response.status,result.error??'Request failed',result.currentRevision);
 return result;
}
export default function App() {
 const [user,setUser]=useState<User|null>(null),[own,setOwn]=useState<Plot|null>(null),[plots,setPlots]=useState<Plot[]>([]);
 const [center,setCenter]=useState({x:0,y:0}),[selected,setSelected]=useState<{x:number;y:number}|null>(null);
 const [message,setMessage]=useState('Loading the village…'),[register,setRegister]=useState(false),[busy,setBusy]=useState(false);
 const [playCenter,setPlayCenter]=useState({x:0,y:0});
 const [playing,setPlaying]=useState(false),[generation,setGeneration]=useState(0),[dirty,setDirty]=useState(false),[ready,setReady]=useState(false);
 const [ownsSnapshot,setOwnsSnapshot]=useState(false);
 const [saving,setSaving]=useState(false);
 const [avatar,setAvatar]=useState(0),[conflict,setConflict]=useState<number|null>(null);
 const bootReported=useRef(false);
 const frame=useRef<HTMLIFrameElement>(null),sessionId=useRef<string|null>(null),saveActive=useRef(false),userRef=useRef(user);
 userRef.current=user;
 const bus=useCallback(()=> (frame.current?.contentWindow as PlayerWindow|null)?.WMSX?.room?.machine?.bus,[]);
 const refresh=useCallback(async()=>{const me=await api<{user:User|null;plot:Plot|null}>('/api/me');setUser(me.user);setOwn(me.plot);return me;},[]);
 useEffect(()=>{void refresh().then(me=>{if(me.plot)setCenter({x:me.plot.x,y:me.plot.y});setMessage('Welcome to the neighborhood.');}).catch(e=>setMessage(e.message));},[refresh]);
 useEffect(()=>{let current=true;void api<{plots:Plot[]}>(`/api/world?x=${center.x}&y=${center.y}`).then(world=>{if(current)setPlots(world.plots);}).catch(e=>{if(current)setMessage(e.message);});return()=>{current=false;};},[center,own]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 const save=useCallback(async(expected?:number)=>{
  const memory=bus();if(!memory||saveActive.current||memory.read(B+12)>=81)return;
  if(!userRef.current || userRef.current.id!==sessionId.current){memory.write(B+5,4);setMessage('Sign in with the account that launched this session to save. Your edits are still here.');return;}
  saveActive.current=true;setSaving(true);memory.write(B+5,2);setMessage('Saving your exterior and interior…');
  try {
   const bytes=Uint8Array.from({length:DATA_SIZE},(_,i)=>memory.read(D+i));
   const revision=expected??((memory.read(B+8)|(memory.read(B+9)<<8)|(memory.read(B+10)<<16)|(memory.read(B+11)<<24))>>>0);
   const result=await api<{revision:number}>('/api/settlement','PUT',{expectedRevision:revision,settlement:decodeSettlement(bytes)});
   setConflict(null);setMessage(`Saved. Your exhibit is now revision ${result.revision}.`);
   acknowledgeSavedRevision(memory,result.revision,refresh,()=>setMessage(`Saved revision ${result.revision}. Account details could not refresh; your work is safe.`));
  }catch(e){const error=e as ApiError;if(error.status===409){setConflict(error.revision??null);memory.write(B+5,5);setMessage('Another session saved newer work. Choose which version to keep.');}else{memory.write(B+5,4);setMessage(`${error.message}. Your edits remain in this session; you can retry.`);if(error.status===401){setUser(null);setOwn(null);}}}
  finally{saveActive.current=false;setSaving(false);}
 },[bus,refresh]);
 useEffect(()=>{
  if(!playing)return;
  const timer=setInterval(()=>{
   const memory=bus();if(!memory||memory.read(B)!==77||memory.read(B+1)!==83||memory.read(B+2)!==88||memory.read(B+3)!==86||memory.read(B+19)!==1)return;
   if(!bootReported.current){bootReported.current=true;setMessage(memory.read(B+12)<81?'Your neighborhood is ready. F1 starts building.':'Visitor snapshot ready. Exhibits are read-only.');}
   setReady(true);setOwnsSnapshot(memory.read(B+12)<81);memory.write(B+4,memory.read(B+12)<81?1:0);setDirty(memory.read(B+6)!==0);setAvatar(memory.read(D+1));
   if(memory.read(B+5)===1)void save();
  },100);
  return()=>clearInterval(timer);
 },[playing,generation,bus,save]);
 async function authenticate(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);const form=new FormData(event.currentTarget);
  try{await api(`/api/auth/${register?'register':'login'}`,'POST',{username:form.get('username'),password:form.get('password'),...(register?{invitation:form.get('invitation')}: {})});const me=await refresh();if(!playing&&me.plot)setCenter({x:me.plot.x,y:me.plot.y});setMessage(`Welcome, ${me.user?.username}.`);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 async function claim(){if(!selected)return;setBusy(true);try{await api('/api/plots/claim','POST',selected);await refresh();setMessage('This little place is yours. Open it to start building.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 function launch(){if(saveActive.current)return;if(dirty&&!confirm('Your session has unsaved changes. Discard them and load a fresh snapshot?'))return;sessionId.current=user?.id??null;bootReported.current=false;setReady(false);setOwnsSnapshot(false);setDirty(false);setConflict(null);setPlayCenter({...center});setGeneration(n=>n+1);setPlaying(true);setMessage('Starting your MSX1…');}
 function chooseAvatar(value:number){const memory=bus();if(!memory||saveActive.current||memory.read(B+12)>=81||memory.read(B+5)!==0)return;memory.write(D+1,value);memory.write(B+6,1);setAvatar(value);}
 const selectedPlot=selected&&plots.find(p=>p.x===selected.x&&p.y===selected.y);
 return <main>
  <header><a className="brand" href="/">⌂ <span>MSX Village</span></a><span className="tagline">A little place of your own</span>{user&&<div className="account"><span>{user.username}</span><button disabled={saveActive.current} onClick={()=>{if(dirty&&!confirm('Sign out with unsaved work? You can sign back in here to save it.'))return;void api('/api/auth/logout','POST',{}).then(refresh).catch(e=>setMessage(e.message));}}>Sign out</button></div>}</header>
  <section className="intro"><p className="eyebrow">Build slowly. Wander freely.</p><h1>A small world,<br/>made by its neighbors.</h1><p>Plant a tree. Lay a path. Make your house feel like home.<br/>Every plot is a quiet little exhibit waiting to be explored.</p></section>
  <p className="status" role="status">{message}</p>
  {!user&&<section className="card access"><div><h2>{register?'Your invitation to the village':'Come on in'}</h2><p>One account, one little plot.<br/>Registration is by invitation.</p></div><form onSubmit={authenticate}><label>Username<input name="username" autoComplete="username" required minLength={3} maxLength={16} pattern="[A-Za-z0-9_]+"/></label><label>Password<input name="password" type="password" autoComplete={register?'new-password':'current-password'} required minLength={register?12:1} maxLength={128}/></label>{register&&<label>Invitation code<input name="invitation" required minLength={64} maxLength={64} autoComplete="off"/></label>}<div className="actions"><button className="primary" disabled={busy}>{register?'Create account':'Sign in'}</button><button type="button" onClick={()=>setRegister(v=>!v)}>{register?'I already have an account':'I have an invitation'}</button></div></form></section>}
  <section className="neighborhood card"><div className="section-title"><div><p className="eyebrow">The neighborhood</p><h2>Find your corner</h2></div><div className="actions"><button aria-label="Move map west" onClick={()=>setCenter(c=>({...c,x:Math.max(-96,c.x-4)}))}>←</button><button aria-label="Move map north" onClick={()=>setCenter(c=>({...c,y:Math.max(-96,c.y-4)}))}>↑</button><button aria-label="Move map south" onClick={()=>setCenter(c=>({...c,y:Math.min(96,c.y+4)}))}>↓</button><button aria-label="Move map east" onClick={()=>setCenter(c=>({...c,x:Math.min(96,c.x+4)}))}>→</button>{own&&<button onClick={()=>setCenter({x:own.x,y:own.y})}>My neighborhood</button>}</div></div>
   <div className="map-layout"><div className="world-map" aria-label="Village plots">{Array.from({length:81},(_,slot)=>{const x=center.x+slot%9-4,y=center.y+Math.floor(slot/9)-4;const p=plots.find(p=>p.x===x&&p.y===y);return <button key={`${x},${y}`} className={`plot ${p?'inhabited':''} ${p?.id===own?.id?'owned':''} ${selected?.x===x&&selected.y===y?'selected':''}`} title={`${x}, ${y}: ${p?.username??'Available'}`} aria-label={`${x}, ${y}: ${p?.username??'Available'}`} aria-pressed={selected?.x===x&&selected.y===y} onClick={()=>setSelected({x,y})}><span aria-hidden="true">{p?'⌂':'·'}</span>{p&&<small>{p.username}</small>}</button>;})}</div><aside><h3>{selectedPlot?`${selectedPlot.username}’s place`:selected?'An empty little plot':'Pick a plot'}</h3><p>{selected?`World coordinates ${selected.x}, ${selected.y}`:'Choose a square to see who lives there.'}</p>{user&&!own&&selected&&!selectedPlot&&<button className="primary" disabled={busy} onClick={()=>void claim()}>Claim this plot</button>}{own&&<p>Your home is at {own.x}, {own.y}.<br/>Revision {own.revision} · one exterior and one interior.</p>}<p className="muted">Filled squares are saved exhibits. You can visit them, including their interiors, but only edit your own place.</p></aside></div>
   <div className="actions"><button className="primary" onClick={launch}>{playing?'Load fresh neighborhood':'Open neighborhood in MSX'}</button><a className="button" href={`/api/snapshot.rom?x=${center.x}&y=${center.y}`}>Download 1 MiB ROM</a></div><p className="muted">Each snapshot includes a 9 × 9 neighborhood. Downloads target MSX1, 64 KB RAM, ASCII8. Offline edits last only for the current session and cannot be saved.</p>
  </section>
  {playing&&<section className="card player"><div className="section-title"><h2>Your MSX</h2><span className="save-state">{!ready?'Starting…':saving?'Saving…':dirty?'Unsaved changes':'Up to date'}</span></div><iframe key={generation} ref={frame} src={`/emulator/index.html?x=${playCenter.x}&y=${playCenter.y}`} title="MSX Village emulator" allow="autoplay"/>{ready&&own&&ownsSnapshot&&<div className="actions"><span>Avatar</span>{['Snow','Sunshine','Poppy','Sky'].map((name,i)=><button key={name} aria-pressed={avatar===i} disabled={saving} onClick={()=>chooseAvatar(i)}>{name}</button>)}<button className="primary" disabled={saving} onClick={()=>void save()}>Save settlement</button></div>}{conflict!==null&&<div className="conflict" role="alert"><p>A newer revision ({conflict}) exists. Your unsaved session is still available.</p><button onClick={launch}>Discard session and load latest</button><button onClick={()=>{if(confirm('Replace the latest saved exterior and interior with this session’s work?'))void save(conflict);}}>Replace latest with this session</button></div>}<p className="controls"><strong>Click the game to use the keyboard.</strong> Arrows move · F1 build · F2 catalog · F3 tiles/objects · Space build in front · F4 erase in front · F5 save · Enter door · Escape exit · H home</p><p className="muted">The outline shows where you will build. Solid objects block walking; lamp, plant pot, and flower patch are walkable. Changing the map does not update a running snapshot. Load a fresh neighborhood to see newer exhibits.</p></section>}
  <footer>A peaceful toy village for MSX1 · <a href="https://github.com/jannone/msx-village">Source</a> · <a href="https://github.com/ppeccin/WebMSX">Powered by WebMSX</a> and C-BIOS</footer>
 </main>;
}
