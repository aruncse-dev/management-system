/**
 * Launch log: a private, on-device record of each app start, kept so a launch
 * that hangs on the splash screen can be explained afterwards.
 *
 * How it works:
 *   - `launchLogScript(app)` is inlined at the top of each app's _document, so
 *     it runs before any app code (and records whether app code ever started).
 *     It stores the last launches in localStorage under `ft_launchlog`.
 *   - App code adds steps with `launchLog('…')` and marks the end of a launch
 *     with `launchShown('…')` (the app or the sign-in card is on screen).
 *   - While the page is open it also notes stalls (a 1 s heartbeat that could
 *     not run for 3 s+ while visible), long JavaScript tasks with the function
 *     and file responsible, /api requests that are slow (>2.5 s), fail or
 *     return 5xx (method, path, module/action only), and in-app page changes.
 *   - Steps are written to localStorage at most once a second (it is
 *     synchronous and waits on the phone's storage) and flushed when the page
 *     is hidden, frozen or closed.
 *   - The service worker keeps its own log (see packages/shared/config/pwa/sw.js).
 *   - `/launch-log.html` shows both, with Copy and Share buttons.
 *
 * Steps only: page paths without query strings, timings, connection state.
 * Never emails, tokens, amounts or anything typed into the app. Nothing is
 * sent anywhere; the person copies it out themselves.
 */

export const LAUNCH_LOG_KEY = 'ft_launchlog'

type LaunchLogWindow = Window & {
  __ftLog?: (step: string) => void
  __ftShown?: (what: string) => void
}

/** Add a step to the current launch. Safe to call anywhere; a no-op on the server. */
export function launchLog(step: string): void {
  if (typeof window === 'undefined') return
  try {
    ;(window as LaunchLogWindow).__ftLog?.(step)
  } catch {
    /* logging must never break the app */
  }
}

/** The launch is over: something usable is on screen. Stops the "still waiting" checks. */
export function launchShown(what: string): void {
  if (typeof window === 'undefined') return
  try {
    ;(window as LaunchLogWindow).__ftShown?.(what)
  } catch {
    /* ignore */
  }
}

/**
 * Inline boot script for _document. Plain ES5 so it runs on any engine, and
 * every storage call is guarded: a full or blocked localStorage only means no log.
 */
export function launchLogScript(app: string): string {
  const cfg = JSON.stringify({ key: LAUNCH_LOG_KEY, app }).replace(/</g, '\\u003c')
  return String.raw`(function(){try{
var C=${cfg},K=C.key,APP=C.app,MAX=12,MAXSTEPS=160;
var P=window.performance,n=navigator,c=n.connection||{};
function now(){try{return Math.round(P.now())}catch(e){return 0}}
var all=[];try{all=JSON.parse(localStorage.getItem(K)||'[]')}catch(e){}
if(!(all instanceof Array))all=[];
var prev=null;for(var i=all.length-1;i>=0;i--){if(all[i]&&all[i].app===APP){prev=all[i];break}}
var L={id:Date.now().toString(36),app:APP,at:new Date().toISOString(),done:false,steps:[]};
all.push(L);if(all.length>MAX)all=all.slice(all.length-MAX);
function save(){try{localStorage.setItem(K,JSON.stringify(all))}catch(e){}}
var saveTimer=null;function saveSoon(){if(saveTimer)return;saveTimer=setTimeout(function(){saveTimer=null;save()},1000)}
function saveNow(){if(saveTimer){clearTimeout(saveTimer);saveTimer=null}save()}
var appStarted=false;
function log(s){try{if(/^app code started/.test(s))appStarted=true;if(L.steps.length>=MAXSTEPS)return;L.steps.push([now(),String(s).slice(0,240)]);if(L.steps.length===1)saveNow();else saveSoon()}catch(e){}}
var shown=false;
window.__ftLog=log;
window.__ftShown=function(w){if(shown)return;shown=true;L.done=true;log('ON SCREEN: '+w)};
var ua=n.userAgent||'',os=ua.match(/Android [0-9.]+|iPhone OS [0-9_]+|iPad; CPU OS [0-9_]+|Windows NT [0-9.]+|Mac OS X [0-9_]+/),br=ua.match(/(Chrome|CriOS|Firefox|Version)\/[0-9]+/);
var sa=false;try{sa=matchMedia('(display-mode: standalone)').matches||n.standalone===true}catch(e){}
log('page start '+location.pathname+' | '+(sa?'installed app':'browser tab')+' | '+(n.serviceWorker&&n.serviceWorker.controller?'worker in control':'no worker')+' | '+(n.onLine?'online':'OFFLINE')+(c.effectiveType?' ('+c.effectiveType+(c.rtt!=null?', rtt '+c.rtt+'ms':'')+')':'')+' | '+document.visibilityState+' | '+(os?os[0]:'?')+' '+(br?br[0]:''));
if(prev&&!prev.done){var ls=prev.steps&&prev.steps.length?prev.steps[prev.steps.length-1]:null;var pt=new Date(prev.at);log('previous launch at '+(isNaN(pt)?prev.at:pt.toTimeString().slice(0,8))+' never reached the screen; its last step: '+(ls?ls[0]+'ms '+ls[1]:'none'))}
document.addEventListener('DOMContentLoaded',function(){log('html parsed')});
addEventListener('load',function(){log('all files loaded');setTimeout(function(){try{var e=P.getEntriesByType('navigation')[0];if(e)log('page timing: '+e.type+' | worker '+(e.workerStart?'started '+Math.round(e.workerStart)+'ms':'not used')+' | request '+Math.round(e.requestStart||e.fetchStart)+'ms, first byte '+Math.round(e.responseStart)+'ms, html done '+Math.round(e.responseEnd)+'ms | '+e.transferSize+' bytes over network')}catch(x){}},0)});
document.addEventListener('visibilitychange',function(){log('now '+document.visibilityState)});
addEventListener('pagehide',function(){log('page closed or hidden')});
addEventListener('pageshow',function(e){if(e&&e.persisted)log('restored from back/forward cache')});
document.addEventListener('freeze',function(){log('frozen by the system')});
document.addEventListener('resume',function(){log('resumed by the system')});
addEventListener('online',function(){log('went online')});
addEventListener('offline',function(){log('went OFFLINE')});
addEventListener('error',function(e){var t=e&&e.target;if(t&&t!==window&&(t.src||t.href)){log('FAILED to load '+String(t.src||t.href).replace(location.origin,'').split('?')[0])}else{log('error: '+(e&&e.message||'unknown'))}},true);
addEventListener('unhandledrejection',function(e){var r=e&&e.reason;log('unhandled: '+(r&&r.message?r.message:String(r)))});
if(n.serviceWorker){n.serviceWorker.addEventListener('controllerchange',function(){log('a new worker took control')})}
[2,4,7,12,20,40].forEach(function(s){setTimeout(function(){if(shown)return;var el=document.querySelectorAll('script[src]:not([nomodule])'),got={},miss=[];try{P.getEntriesByType('resource').forEach(function(r){if(r.initiatorType==='script')got[r.name.split('?')[0]]=1})}catch(x){}for(var j=0;j<el.length;j++){var u=el[j].src.split('?')[0];if(!got[u])miss.push(u.split('/').pop())}log('still waiting at '+s+'s | doc '+document.readyState+' | scripts '+(el.length-miss.length)+'/'+el.length+' loaded'+(miss.length?' (waiting for '+miss.slice(0,3).join(', ')+')':'')+' | '+(appStarted?'app code running':window.next?'framework loaded, app code NOT started':'framework NOT started')+' | '+document.visibilityState)},s*1000)});
var inflight={},seq=0;
function pending(){var a=[],t=Date.now();for(var k in inflight){a.push(inflight[k].l+' '+((t-inflight[k].t)/1000).toFixed(1)+'s')}return a.length?' | waiting on: '+a.slice(0,4).join(', '):''}
var beat=Date.now(),away=false;
document.addEventListener('visibilitychange',function(){away=true});
document.addEventListener('freeze',function(){away=true});
setInterval(function(){var t=Date.now(),g=t-beat;beat=t;if(g>3000&&!away&&document.visibilityState==='visible'){log('page STALLED for '+(g/1000).toFixed(1)+'s: nothing on the page could run'+pending())}away=false},1000);
try{var ST=(window.PerformanceObserver&&PerformanceObserver.supportedEntryTypes)||[];
if(ST.indexOf('longtask')>=0){new PerformanceObserver(function(l){l.getEntries().forEach(function(e){if(e.duration>=400)log('busy '+Math.round(e.duration)+'ms (long JavaScript task)')})}).observe({type:'longtask',buffered:true})}
if(ST.indexOf('long-animation-frame')>=0){new PerformanceObserver(function(l){l.getEntries().forEach(function(e){if(e.duration<400)return;var sc=(e.scripts||[]).slice().sort(function(a,b){return b.duration-a.duration})[0];if(sc)log('slow frame '+Math.round(e.duration)+'ms, mostly '+(sc.sourceFunctionName||sc.invoker||'?')+' @ '+String(sc.sourceURL||'').split('/').pop().split('?')[0]+' ('+Math.round(sc.duration)+'ms)')})}).observe({type:'long-animation-frame',buffered:true})}}catch(e){}
var of=window.fetch;
if(of){window.fetch=function(input,init){var u='',m='GET',url=null;try{u=typeof input==='string'?input:(input&&input.url)||String(input);m=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();url=new URL(u,location.href)}catch(e){}
if(!url||url.origin!==location.origin||url.pathname.indexOf('/api')!==0)return of.apply(window,arguments);
var lb=m+' '+url.pathname,q=url.searchParams,a=q.get('action'),md=q.get('module');if(md)lb+=' '+md;if(a)lb+=' '+a;
try{if(m!=='GET'&&init&&typeof init.body==='string'&&init.body.length<200000){var mm=init.body.match(/"action"\s*:\s*"([A-Za-z0-9_.-]{1,40})"/);if(mm)lb+=' '+mm[1]}}catch(e){}
var id=++seq,t0=Date.now();inflight[id]={l:lb,t:t0};
var p=of.apply(window,arguments);
p.then(function(r){delete inflight[id];var d=Date.now()-t0;if(d>2500||r.status>=500)log('request '+lb+' answered '+r.status+' in '+d+'ms')},function(e){delete inflight[id];log('request '+lb+' FAILED after '+(Date.now()-t0)+'ms: '+(e&&e.name==='AbortError'?'cancelled/timed out':(e&&e.message)||e))});
return p}}
var lastPath=location.pathname;function routed(){if(location.pathname!==lastPath){lastPath=location.pathname;log('went to '+lastPath)}}
['pushState','replaceState'].forEach(function(k){var o=history[k];if(o)history[k]=function(){var r=o.apply(this,arguments);try{routed()}catch(e){}return r}});
addEventListener('popstate',routed);
/* One write per second at most (localStorage is synchronous and waits on the
phone's storage); flushed at once when the page is hidden, frozen or closed. */
addEventListener('pagehide',saveNow);document.addEventListener('freeze',saveNow);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')saveNow()});
}catch(e){}})();`
}
