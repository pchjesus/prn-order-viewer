"use strict";
/* Synthetic/authorized roster only. No personnel authentication or order-state coupling. */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 else root.PRNRosterLibraryModel=api;
})(globalThis,function(){
 const MAX_BYTES=20*1024*1024, MAX_PEOPLE=2000;
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const key=(year,month)=>year+"-"+String(month).padStart(2,"0");
 function validate(record){
  if(!record||record.source!=="synthetic-authorized"||!Number.isInteger(record.year)||record.year<2000||record.year>2100||
     !Number.isInteger(record.month)||record.month<1||record.month>12||
     record.id!==key(record.year,record.month)||!Array.isArray(record.all)||!record.all.length||record.all.length>MAX_PEOPLE||
     !record.shifts||typeof record.shifts!=="object"||Array.isArray(record.shifts)||
     typeof record.fileName!=="string"||record.fileName.length>250)throw Error("보관할 근무표의 구조가 잘못되었습니다.");
  const count=new Date(record.year,record.month,0).getDate();
  if(!Object.keys(record.shifts).length)throw Error("날짜별 근무 정보가 없습니다.");
  for(const [day,shifts] of Object.entries(record.shifts)){
   if(!/^[1-9]\d*$/.test(day)||Number(day)>count||!Array.isArray(shifts)||shifts.length!==record.all.length)
     throw Error("월별 근무 날짜·인원 수가 맞지 않습니다.");
   if(shifts.some(s=>typeof s!=="string"||s.length>16))throw Error("근무코드 형식이 잘못되었습니다.");
  }
  if(record.all.some(p=>!p||typeof p.name!=="string"||!p.name.trim()||p.name.length>120||
     typeof p.group!=="string"||p.group.length>100))throw Error("근무자 항목이 잘못되었습니다.");
  if(own(record,"sourceBlob")||own(record,"fileBuffer")||own(record,"workbook"))throw Error("원본 Excel 데이터는 보관하지 않습니다.");
  return true;
 }
 function make(parsed,year,month,fileName,sheetName){
  const record={id:key(year,month),year,month,fileName,sheetName:sheetName||"",
   importedAt:new Date().toISOString(),source:"synthetic-authorized",
   all:parsed.all.map(p=>({name:p.name,group:p.group})),
   shifts:Object.fromEntries(Object.entries(parsed.shifts).map(([d,s])=>[d,s.map(v=>String(v).trim().toUpperCase())])),
   warnings:(parsed.inspection?.warnings||[]).map(w=>({code:w.code,message:w.message}))};
  validate(record);return record;
 }
 function onDuty(record,dateText,duty){
  if(!record)return [];
  validate(record);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateText)||!["D","E","N"].includes(duty))throw Error("날짜·근무조 형식을 확인해 주세요.");
  const [year,month,day]=dateText.split("-").map(Number);
  if(year!==record.year||month!==record.month)return [];
  const arr=record.shifts[String(day)];
  if(!arr)return [];
  const normalize=s=>s==="NC"?"N":s;
  return record.all.filter((p,i)=>normalize(arr[i])===duty).map(p=>({name:p.name,group:p.group}));
 }
 return {MAX_BYTES,key,validate,make,onDuty};
});
