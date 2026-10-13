"use strict";
/* PRN-only roster IndexedDB. Never reads/writes MICU IndexedDB or PRN order state. */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 else root.PRNRosterLibraryStore=api;
})(globalThis,function(){
 const DB="prnRosterTeachingDB_v1",VERSION=1;
 let db=null;
 function open(){
  if(db)return Promise.resolve(db);
  if(typeof indexedDB==="undefined")return Promise.reject(Error("이 브라우저에는 IndexedDB가 없습니다."));
  return new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB,VERSION);
   req.onupgradeneeded=()=>{
    const connection=req.result;
    if(!connection.objectStoreNames.contains("rosters"))connection.createObjectStore("rosters",{keyPath:"id"});
    if(!connection.objectStoreNames.contains("meta"))connection.createObjectStore("meta",{keyPath:"id"});
   };
   req.onblocked=()=>reject(Error("근무표 저장소가 다른 탭에서 잠겨 있습니다."));
   req.onerror=()=>reject(req.error||Error("근무표 저장소를 열지 못했습니다."));
   req.onsuccess=()=>{db=req.result;db.onversionchange=()=>{db.close();db=null;};resolve(db);};
  });
 }
 async function transact(stores,mode,runner){
  const conn=await open();
  return new Promise((resolve,reject)=>{
   let tx,result,settled=false;
   try{
    tx=conn.transaction(stores,mode);
    tx.oncomplete=()=>{if(!settled){settled=true;resolve(result)}};
    tx.onerror=tx.onabort=()=>{if(!settled){settled=true;reject(tx.error||Error("저장 작업에 실패했습니다."))}};
    const fail=e=>{try{tx.abort()}catch(_){} if(!settled){settled=true;reject(e instanceof Error?e:Error(String(e)))}};
    runner(tx,value=>{result=value},fail);
   }catch(e){if(!settled){settled=true;reject(e)}}
  });
 }
 const deep=v=>JSON.parse(JSON.stringify(v));
 async function list(){
  const rows=await transact(["rosters"],"readonly",(tx,put,fail)=>{
   const q=tx.objectStore("rosters").getAll();
   q.onsuccess=()=>put(q.result.map(deep));q.onerror=()=>fail(q.error);
  });
  return rows.sort((a,b)=>b.id.localeCompare(a.id));
 }
 async function activeId(){
  return (await transact(["meta"],"readonly",(tx,put,fail)=>{
   const q=tx.objectStore("meta").get("active");q.onsuccess=()=>put(q.result?.value||null);q.onerror=()=>fail(q.error);
  }))||null;
 }
 async function save(input,expectedRevision=null){
  const M=globalThis.PRNRosterLibraryModel||(typeof require==="function"?require("./roster-library-model.js"):null);
  M.validate(input);
  const record=deep(input);
  return transact(["rosters"],"readwrite",(tx,put,fail)=>{
   const os=tx.objectStore("rosters"),req=os.get(record.id);
   req.onsuccess=()=>{
    const existing=req.result,revision=existing?.revision||0;
    if(existing && expectedRevision===null)return fail(Error("이미 저장된 월입니다. 덮어쓰기 전에 확인해 주세요."));
    if(existing && revision!==expectedRevision)return fail(Error("다른 탭에서 근무표가 변경되었습니다. 목록을 다시 확인해 주세요."));
    if(!existing && expectedRevision!==null)return fail(Error("이 근무표가 삭제되었습니다. 목록을 다시 확인해 주세요."));
    record.revision=revision+1;
    os.put(record);put(deep(record));
   };
   req.onerror=()=>fail(req.error);
  });
 }
 async function use(id){
  return transact(["rosters","meta"],"readwrite",(tx,put,fail)=>{
   const req=tx.objectStore("rosters").get(id);
   req.onsuccess=()=>{
    if(!req.result)return fail(Error("삭제되거나 존재하지 않는 근무표입니다."));
    tx.objectStore("meta").put({id:"active",value:id});
    put(id);
   };
   req.onerror=()=>fail(req.error);
  });
 }
 async function remove(id,expectedRevision){
  return transact(["rosters","meta"],"readwrite",(tx,put,fail)=>{
   const os=tx.objectStore("rosters"),req=os.get(id);
   req.onsuccess=()=>{
    if(!req.result)return fail(Error("근무표가 이미 삭제되었습니다."));
    if((req.result.revision||0)!==expectedRevision)return fail(Error("다른 탭에서 변경된 근무표이므로 삭제하지 않았습니다."));
    os.delete(id);
    const q=tx.objectStore("meta").get("active");
    q.onsuccess=()=>{if(q.result?.value===id)tx.objectStore("meta").put({id:"active",value:null});put(true)};
    q.onerror=()=>fail(q.error);
   };
   req.onerror=()=>fail(req.error);
  });
 }
 return {DB,open,list,activeId,save,use,remove};
});
