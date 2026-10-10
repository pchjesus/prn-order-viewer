"use strict";
/* Presentation-only navigation; source data and existing module state remain independent. */
(function(){
 if(typeof document==="undefined")return;
 const workspace=document.querySelector(".workspace"),links=[...document.querySelectorAll("[data-nav]")];
 if(!workspace||!links.length)return;
 const known=new Set(["orders","patient","handoff","doctor","history","roster"]);
 function navigate(view){
  if(!known.has(view))return;
  workspace.dataset.view=view;
  for(const section of workspace.querySelectorAll("[data-page]"))section.hidden=section.dataset.page!==view;
  for(const link of links){
    const active=link.dataset.nav===view;
    link.classList.toggle("is-active",active);
    if(active)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");
  }
  // Existing optional panels stay backed by their own modules, opened once on navigation.
  if(view==="doctor"&&document.getElementById("composerPanel")?.hidden)document.getElementById("composerToggle")?.click();
  if(view==="handoff"&&document.getElementById("sheetPanel")?.hidden)document.getElementById("sheetToggle")?.click();
  const labels={orders:"약물 처방 조회",patient:"환자 정보",handoff:"인계·Kardex",doctor:"의사 처방 입력",history:"처방 변경 이력",roster:"MICU 근무표"};
  document.getElementById("workspaceTitle").textContent=labels[view];
  document.dispatchEvent(new Event("prn-page-changed"));
 }
 for(const link of links)link.addEventListener("click",()=>navigate(link.dataset.nav));
 // One page at a time, no browser history/state or URL required.
 navigate("orders");
})();
