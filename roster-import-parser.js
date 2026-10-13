/* Read cell matrices, not workbooks: XLSX/file selection is an adapter in the UI. */
(function(root,factory) {
  if(typeof module==='object' && module.exports) module.exports=factory(require('./roster-import-config.js'));
  else root.RosterParser=factory(root.MicuConfig);
})(globalThis,config=>{
  const defaultProfile=()=>config.parserProfiles[config.activeParserId];
  const defaultRules=()=>config.ruleProfiles[config.activeRuleId];
  function extractMonthYear(fileName) {
    const name=fileName.replace(/\.[^.]+$/,'');
    const match=name.match(/(?:^|\D)(20\d{2})\D{1,4}(1[0-2]|0?[1-9])(?!\d)/) || name.match(/(?:^|\D)(20\d{2})(0[1-9]|1[0-2])(?!\d)/);
    return match ? {year:Number(match[1]),month:Number(match[2])} : null;
  }
  function parseRows(rows,{profile=defaultProfile(),rules=defaultRules(),headerRow=profile.headerRow,nameColumn=profile.nameColumn}={}) {
    const bands=profile.groupBands;
    if(!Array.isArray(bands)||!bands.length||bands.at(-1).count!==null||new Set(bands.map(b=>b.name)).size!==bands.length||bands.some((b,i)=>!rules.groupOrder.includes(b.name)||(i<bands.length-1&&(!Number.isInteger(b.count)||b.count<0)))) throw new Error('선임 그룹 설정을 확인해줘. 그룹 이름은 규칙에 포함되어야 하고 마지막 구간은 나머지 인원이어야 해.');
    if(!Array.isArray(rows) || rows.length>profile.maxRows || rows.some(row=>!Array.isArray(row)||row.length>profile.maxColumns)) throw new Error('근무표 크기 또는 셀 구조를 확인해줘.');
    const candidates=rows.map((row,index)=>({index,days:row.filter(v=>{const n=Number(String(v).trim());return Number.isInteger(n)&&n>=1&&n<=31;})})).filter(row=>row.days.includes(1) || row.days.some(v=>String(v).trim()==='1'));
    // Prefer a full consecutive date row over isolated 1s in a title or staff index.
    const automatic=candidates.sort((a,b)=>b.days.length-a.days.length||a.index-b.index)[0];
    const headerIndex=headerRow===null ? automatic?.index : headerRow;
    if(!Number.isInteger(headerIndex)||headerIndex<0||headerIndex>=rows.length) throw new Error('날짜 행(1, 2, 3...)을 찾지 못했어. 날짜 행을 직접 선택해줘.');
    const dayCols=[];
    rows[headerIndex].forEach((value,column)=>{const day=Number(String(value).trim());if(Number.isInteger(day)&&day>=1&&day<=31)dayCols.push([day,column]);});
    if(!dayCols.length) throw new Error('날짜 열을 찾지 못했어.');
    if(new Set(dayCols.map(([day])=>day)).size!==dayCols.length) throw new Error('같은 날짜 열이 중복돼 있어. 날짜 행을 확인해줘.');
    if(dayCols.some(([day],i)=>i && day<=dayCols[i-1][0])) throw new Error('날짜 열의 순서가 올바르지 않아.');
    const firstDay=dayCols[0][1], namePattern=new RegExp(profile.namePattern);
    const scores=Array.from({length:firstDay},(_,column)=>({column,score:rows.slice(headerIndex+1).filter(row=>namePattern.test(String(row[column]??'').trim())).length}));
    scores.sort((a,b)=>b.score-a.score||a.column-b.column);
    const nameCol=nameColumn===null ? (scores[0]?.score>0?scores[0].column:firstDay-1) : nameColumn;
    if(!Number.isInteger(nameCol)||nameCol<0||nameCol>=firstDay) throw new Error('이름 열은 첫 날짜 열보다 앞에 있어야 해. 이름 열을 직접 선택해줘.');
    const entries=rows.map((row,index)=>({row,index,name:String(row[nameCol]??'').trim()})).filter(item=>item.index>headerIndex && item.name && !profile.ignoredNames.includes(item.name));
    if(!entries.length) throw new Error('근무표에서 인원을 찾지 못했어. 이름 열과 날짜 행을 확인해줘.');
    const groups=profile.groupBands.map(band=>({name:band.name,people:[]}));
    const groupFor=index=>{let boundary=0;for(const band of profile.groupBands){if(band.count===null)return band.name;boundary+=band.count;if(index<boundary)return band.name;}throw new Error('선임 그룹 설정에 나머지 인원 구간이 없어.');};
    const all=entries.map((entry,index)=>{const group=groupFor(index);groups.find(g=>g.name===group).people.push(entry.name);return {name:entry.name,group};});
    const shifts=Object.fromEntries(dayCols.map(([day,column])=>[String(day),entries.map(entry=>String(entry.row[column]??'').trim())]));
    const warnings=[];
    const add=(code,message)=>warnings.push({code,message});
    if(nameColumn===null && scores.filter(item=>item.score===scores[0]?.score && item.score>0).length>1) add('ambiguous-name','이름처럼 보이는 열이 여러 개야. 선택한 이름 열과 인원 목록을 확인해줘.');
    const unusual=entries.filter(entry=>!namePattern.test(entry.name));
    if(unusual.length)add('unusual-name',`이름 형식이 다른 행 ${unusual.length}개가 있어. 설명·합계 행이 포함되지 않았는지 확인해줘.`);
    const duplicates=all.length-new Set(all.map(person=>person.name)).size;
    if(duplicates)add('duplicate-name',`동명이인 또는 중복 이름 ${duplicates}개가 있어. 각각 다른 인원으로 처리해.`);
    const noName=rows.filter((row,index)=>index>headerIndex&&!String(row[nameCol]??'').trim()&&dayCols.some(([,column])=>Object.hasOwn(rules.dutyCodes,String(row[column]??'').trim().toUpperCase())));
    if(noName.length)throw new Error(`이름이 비어 있지만 근무 코드가 있는 행 ${noName.length}개가 있어.`);
    const unknown=[...new Set(Object.values(shifts).flat().map(v=>v.trim().toUpperCase()).filter(v=>v&&!Object.hasOwn(rules.dutyCodes,v)&&!profile.nonWorkingCodes.includes(v)))];
    if(unknown.length)add('unknown-code',`확인되지 않은 코드: ${unknown.join(', ')}. 현재 규칙에서는 비근무로 처리해.`);
    const blank=Object.values(shifts).flat().filter(v=>!v).length;
    if(blank)add('blank-cell',`빈 근무 칸 ${blank}개가 있어. 비근무로 처리하므로 자료 누락인지 확인해줘.`);
    add('group-assumption',`선임 그룹은 행 순서로 지정해. ${profile.groupBands.map(b=>`${b.name} ${b.count===null?'나머지':b.count+'명'}`).join(' / ')}.`);
    return {all,groups,shifts,maxDay:Math.max(...dayCols.map(([day])=>day)),schemaVersion:3,
      ruleSnapshot:JSON.parse(JSON.stringify(rules)),parserProfileId:profile.id,
      inspection:{headerRow:headerIndex,nameColumn:nameCol,sourceRows:entries.map(entry=>entry.index+1),dayColumns:dayCols,warnings}};
  }
  function validateMonth(roster,year,month) {
    if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12) throw new Error('연도는 2000~2100, 월은 1~12 사이의 정수로 입력해줘.');
    const last=new Date(year,month,0).getDate();
    const present=Object.keys(roster.shifts).map(Number);
    const invalid=present.filter(day=>day>last||day<1);
    if(invalid.length)throw new Error(`${year}년 ${month}월에 없는 날짜 열이 있어: ${invalid.join(', ')}일.`);
    const missing=Array.from({length:last},(_,i)=>i+1).filter(day=>!present.includes(day));
    return {lastDay:last,missingDays:missing,warnings:missing.length?[{code:'missing-day',message:`${missing.join(', ')}일 자료가 없어. 해당 날짜는 배치·편집·인쇄가 제한돼.`}]:[]};
  }
  return {parseRows,validateMonth,extractMonthYear};
});
