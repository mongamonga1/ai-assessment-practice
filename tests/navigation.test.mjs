import test from 'node:test';
import assert from 'node:assert/strict';
import {createNavigation} from '../dist/navigation.js';
function browserHistory(){
 const entries=[];let index=-1;
 return {entries,get index(){return index;},get state(){return entries[index]?.state;},
 pushState(state,_,url){entries.splice(++index);entries.push({state:structuredClone(state),url});},
 replaceState(state,_,url){if(index<0)index=0;entries[index]={state:structuredClone(state),url};},
 go(n){index+=n;return entries[index].state;}};
}
test('메뉴·설정·연습은 방문 기록을 남기고 재렌더링은 중복 기록하지 않음',()=>{
 const history=browserHistory(),visits=[];let snapshot={scrollY:120,settings:{practiceMinutes:'30'}};
 const navigation=createNavigation({history,location:{pathname:'/ai-assessment-practice/',search:'?test=1'},modes:['knowledge'],capture:()=>snapshot,onNavigate:route=>{visits.push(route);}});
 navigation.start();navigation.show({screen:'prepare',mode:'knowledge'});navigation.show({screen:'prepare',mode:'knowledge'});
 navigation.remember();snapshot={paperScroll:340};navigation.show({screen:'exam',sessionId:'session-A'});navigation.show({screen:'exam',sessionId:'session-A'});
 assert.equal(history.entries.length,3);assert.equal(history.entries[2].url,'/ai-assessment-practice/?test=1#practice');
 navigation.restore(history.go(-1));assert.equal(visits.at(-1).screen,'prepare');assert.equal(visits.at(-1).settings.practiceMinutes,'30');
 navigation.restore(history.go(1));assert.equal(visits.at(-1).sessionId,'session-A');assert.equal(history.entries.length,3);
});
test('뒤로가기 복원 중 화면 함수가 실행돼도 새 기록을 추가하거나 앞 기록을 지우지 않음',()=>{
 const history=browserHistory();let navigation;
 navigation=createNavigation({history,location:{pathname:'/',search:''},modes:['usage'],onNavigate:route=>{navigation.show(route);}});
 navigation.start();navigation.show({screen:'prepare',mode:'usage'});navigation.show({screen:'exam',sessionId:'old'});
 navigation.restore(history.go(-1));assert.equal(history.entries.length,3);assert.equal(history.index,1);
 navigation.restore(history.go(1));assert.equal(history.index,2);assert.equal(history.entries.length,3);
});
test('잘못된 화면과 교체된 연습의 방문 기록은 새 문제 생성 없이 메뉴로 대체',()=>{
 const history=browserHistory();const visits=[];
 const navigation=createNavigation({history,location:{pathname:'/practice/',search:''},modes:['usage'],onNavigate:route=>{visits.push(route);return route.screen==='exam'?{screen:'menu'}:undefined;}});
 navigation.start();navigation.show({screen:'exam',sessionId:'replaced-session'});
 navigation.restore(history.state);assert.equal(history.state.route.screen,'menu');assert.equal(history.entries.length,2);
 navigation.restore({aiPracticeNavigation:1,route:{screen:'prepare',mode:'not-a-mode'}});assert.equal(visits.at(-1).screen,'menu');
 navigation.restore(null);assert.equal(visits.at(-1).screen,'menu');
});
