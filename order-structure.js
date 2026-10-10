"use strict";
/* Explicit synthetic structured entry only. Never infer dosage or clinical safety from free text. */
(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.PRNOrderStructure=api;})(globalThis,function(){
  const ROUTES=Object.freeze({oral:"PO",intravenous:"IV",intramuscular:"IM",subcutaneous:"SC",sublingual:"SL",topical:"Topical",inhaled:"Inhalation",rectal:"Rectal",other:"기타(별도 확인)"});
  const PERIODS=Object.freeze({day:"1일",hours24:"24시간",week:"1주"});
  const INTERVALS=Object.freeze({hour:"시간",day:"일"});
  const FIELDS=Object.freeze(["product_name","dosage_form","strength_text","dose_value","dose_unit","route_code","frequency_count","frequency_period","interval_value","interval_unit","administration_times","max_dose_value","max_dose_unit","max_count","max_count_period"]);
  const trim=(x,max=100)=>{const s=String(x??"").trim();if(s.length>max)throw Error("구조화 입력값이 허용 길이를 초과했습니다.");return s;};
  function assert(ok,why){if(!ok)throw Error(why);}
  function positive(x,label,integer=false){
    const s=trim(x,16);
    assert(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,4})?$/.test(s)&&Number(s)>0&&(!integer||Number.isInteger(Number(s))),
      label+"은(는) 0보다 큰 숫자로 입력해 주세요.");
    return s;
  }
  function pair(v,u,label){
    const value=trim(v,16),unit=trim(u,30);
    if(!value&&!unit)return null;
    assert(value&&unit,label+"의 값과 단위를 함께 입력해 주세요.");
    assert(!/[\x00-\x1f<>]/.test(unit),label+" 단위에 허용되지 않는 문자가 있습니다.");
    return {value:positive(value,label),unit};
  }
  function compose(input){
    const raw=input?.structured_fields;
    const legacy={dose_instruction:input?.dose_instruction,route_instruction:input?.route_instruction,
      frequency_instruction:input?.frequency_instruction,maximum_limit_instruction:input?.maximum_limit_instruction};
    if(raw===null||raw===undefined)return {...legacy,instruction_structure:null};
    assert(raw&&typeof raw==="object"&&!Array.isArray(raw)&&Object.keys(raw).every(k=>FIELDS.includes(k)),
      "알 수 없는 구조화 처방 필드가 있습니다.");
    const v=k=>trim(raw[k],k==="administration_times"?100:100);
    if(!FIELDS.some(k=>v(k)))return {...legacy,instruction_structure:null};
    const dose=pair(v("dose_value"),v("dose_unit"),"1회 용량");
    const maxDose=pair(v("max_dose_value"),v("max_dose_unit"),"최대 용량");
    const routeCode=v("route_code");
    assert(!routeCode||Object.hasOwn(ROUTES,routeCode),"지원하지 않는 경로 코드입니다.");
    const frequencyCount=v("frequency_count"), frequencyPeriod=v("frequency_period");
    assert(Boolean(frequencyCount)===Boolean(frequencyPeriod),"빈도 횟수와 기준 기간을 함께 입력해 주세요.");
    assert(!frequencyPeriod||Object.hasOwn(PERIODS,frequencyPeriod),"빈도 기준 기간이 올바르지 않습니다.");
    const intervalValue=v("interval_value"),intervalUnit=v("interval_unit");
    assert(Boolean(intervalValue)===Boolean(intervalUnit),"간격 값과 단위를 함께 입력해 주세요.");
    assert(!intervalUnit||Object.hasOwn(INTERVALS,intervalUnit),"간격 단위를 확인해 주세요.");
    const count=v("max_count"),countPeriod=v("max_count_period");
    assert(Boolean(count)===Boolean(countPeriod),"최대 횟수와 기준 기간을 함께 입력해 주세요.");
    assert(!countPeriod||Object.hasOwn(PERIODS,countPeriod),"최대 횟수의 기준 기간이 올바르지 않습니다.");
    const times=v("administration_times")?v("administration_times").split(",").map(t=>t.trim()):[];
    assert(times.length<=8&&times.every(t=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))&&new Set(times).size===times.length,
      "모의 투여 시각은 HH:MM 형식으로 쉼표로 구분해 최대 8개 입력해 주세요.");
    const frequency=frequencyCount?{count:positive(frequencyCount,"빈도",true),period:frequencyPeriod}:null;
    const interval=intervalValue?{value:positive(intervalValue,"간격"),unit:intervalUnit}:null;
    const maxAdministrations=count?{count:positive(count,"최대 횟수",true),period:countPeriod}:null;
    const schedule=frequency||interval||times.length?{frequency,interval,times}:null;
    const maximum=maxDose||maxAdministrations?{dose:maxDose,administrations:maxAdministrations}:null;
    const typedDose=dose?dose.value+" "+dose.unit:null;
    const typedRoute=routeCode?ROUTES[routeCode]:null;
    const scheduleText=schedule?[
      frequency?PERIODS[frequency.period]+" "+frequency.count+"회 (모의 입력)":null,
      interval?interval.value+INTERVALS[interval.unit]+" 간격 (모의 입력)":null,
      times.length?"모의 시각 "+times.join(", "):null].filter(Boolean).join(" / "):null;
    const limitText=maximum?[
      maxDose?"최대 "+maxDose.value+" "+maxDose.unit+" (모의 입력)":null,
      maxAdministrations?PERIODS[maxAdministrations.period]+" 최대 "+maxAdministrations.count+"회 (모의 입력)":null
    ].filter(Boolean).join(" / "):null;
    for(const [key,generated] of [["dose_instruction",typedDose],["route_instruction",typedRoute],
      ["frequency_instruction",scheduleText],["maximum_limit_instruction",limitText]]){
      if(generated&&String(legacy[key]??"").trim()&&String(legacy[key]).trim()!==generated)
        throw Error("구조화 "+({dose_instruction:"용량",route_instruction:"경로",frequency_instruction:"빈도·간격",maximum_limit_instruction:"최대 지시"}[key])+
          "와 문장형 지시가 중복됩니다. 한쪽만 입력해 주세요.");
      if(generated)legacy[key]=generated;
    }
    const product={name:v("product_name")||null,form:v("dosage_form")||null,strength:v("strength_text")||null};
    return {...legacy,instruction_structure:{
      schema_version:1,source:"explicit_simulated_input",
      ingredient_catalog_id:input.medication_catalog_id||null,product,
      dose,route:routeCode?{code:routeCode,display:typedRoute}:null,
      schedule,prn:input.mode==="prn"?{indication:trim(input.indication,180)||null,condition:trim(input.administration_condition,300)||null}:null,
      maximum,stale_sections:[],verification_status:"simulation_unverified"
    }};
  }
  function section(order,name){
    const s=order?.instruction_structure;
    return s?.schema_version===1&&!s.stale_sections?.includes(name)?s[name]??null:null;
  }
  return {ROUTES,PERIODS,INTERVALS,FIELDS,compose,section};
});
