"use strict";
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 else root.PRNPatientProfiles=api;
})(globalThis,function(){
 const no=(v)=>v===null||v===undefined||String(v).trim()==="";
 function validate(patients,profiles){
  if(!Array.isArray(patients)||!Array.isArray(profiles)||patients.length!==profiles.length)throw Error("환자별 가상 프로필 수가 맞지 않습니다.");
  const known=new Set(patients.map(p=>p.patient_id)),seen=new Set();
  for(const p of profiles){
   if(!p||!known.has(p.patient_id)||seen.has(p.patient_id)||p.source!=="synthetic-only"||!p.primary_physician?.id||!p.primary_physician?.name)
    throw Error("환자 ID·주치의 프로필이 잘못되었습니다.");
   if(!p.clinical_context||!Array.isArray(p.clinical_context.prior_history)||!p.assessments||!p.handoff
     ||!["unknown","known","none_reported"].includes(p.allergy?.status)
     ||!["not_provided","provided"].includes(p.assessments.vitals?.status)
     ||!["not_provided","provided"].includes(p.assessments.labs?.status)
     ||!["not_provided","provided"].includes(p.assessments.device_status?.status))
     throw Error("교육용 환자 사정 항목이 잘못되었습니다.");
   for(const key of ["points","monitoring","topics"])
     if(!Array.isArray(p.handoff[key])||p.handoff[key].some(x=>typeof x!=="string"||no(x)||x.length>600))throw Error("인계 정보 형식 오류");
   seen.add(p.patient_id);
  }
  return true;
 }
 const find=(profiles,patientId)=>profiles.find(p=>p.patient_id===patientId)||null;
 function rows(profile,patient){
  if(!profile||!patient||profile.patient_id!==patient.patient_id)return [];
  return [
   ["주치의(가상)",profile.primary_physician.name],
   ["입원 사유",profile.clinical_context.admission_reason],
   ["현재 상태",profile.clinical_context.current_state],
   ["과거력",profile.clinical_context.prior_history.join(", ")],
   ["알레르기",profile.allergy.status==="unknown"?"미확인":profile.allergy.note||"상태 확인 필요"],
   ["활력징후",profile.assessments.vitals.status==="provided"?"시나리오 제공":"측정 자료 미제공"],
   ["검사결과",profile.assessments.labs.status==="provided"?"시나리오 제공":"검사 자료 미제공"],
   ["장치·배액",profile.assessments.device_status.status==="provided"?"시나리오 제공":"장치 상태 미확인"]
  ];
 }
 return {validate,find,rows};
});
