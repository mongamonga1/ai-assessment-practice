// Keep screen history separate from practice answers and question generation.
export function createNavigation({history,location,modes,onNavigate,capture=()=>({})}){
 let current={screen:'menu'},restoring=false;
 const clean=route=>{
  if(route?.screen==='prepare'&&modes.includes(route.mode))return {...route,screen:'prepare',mode:route.mode};
  if(route?.screen==='exam'&&typeof route.sessionId==='string'&&route.sessionId.length<=100)return {...route,screen:'exam'};
  return {screen:'menu',scrollY:Math.max(0,Number(route?.scrollY)||0)};
 };
 const key=route=>JSON.stringify([route.screen,route.mode||null,route.sessionId||null]);
 const url=route=>location.pathname+location.search+(route.screen==='prepare'?'#prepare/'+encodeURIComponent(route.mode):route.screen==='exam'?'#practice':'');
 const write=(route,replace)=>history[replace?'replaceState':'pushState']({aiPracticeNavigation:1,route},'',url(route));
 const remember=()=>{if(restoring)return;current={...current,...capture()};write(current,true);};
 return {
  start(){current={screen:'menu'};write(current,true);},
  show(route){
   if(restoring)return;
   route=clean(route);if(key(route)===key(current))return;
   remember();current=route;write(current,false);
  },
  remember,
  restore(state){
   const requested=clean(state?.aiPracticeNavigation===1?state.route:null);
   current=requested;restoring=true;
   let resolved;
   try{resolved=onNavigate(requested);}finally{restoring=false;}
   if(resolved){current=clean(resolved);write(current,true);}
  }
 };
}
