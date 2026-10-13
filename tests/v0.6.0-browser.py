"""v0.6.0 synthetic patient/Kardex/Excel roster real-browser regression."""
import asyncio, base64, threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_args): pass

async def main():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(Quiet,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    url=f"http://127.0.0.1:{server.server_port}/"
    errors=[]
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
            try:
                page=await browser.new_page(viewport={"width":1440,"height":900})
                page.on("pageerror",lambda e:errors.append(str(e)))
                await page.goto(url,wait_until="networkidle")
                await page.wait_for_function('document.querySelector("#visibleCount")?.textContent === "6건"')
                await page.locator('[data-nav="patient"]').click()
                text=await page.locator("#patientSummary").inner_text()
                assert "주치의(가상)" in text and "서지훈" in text, text
                assert "알레르기" in text and "미확인" in text
                await page.locator('[data-nav="doctor"]').click()
                assert await page.locator("#composerProvider").count()==1
                assert await page.locator("#composerProvider").input_value()=="SIM-MD-101"
                await page.locator("#patientSelect").select_option("DEMO-P002")
                await page.locator('[data-nav="doctor"]').click()
                assert await page.locator("#composerProvider").input_value()=="SIM-MD-103"
                await page.locator("#patientSelect").select_option("DEMO-P001")
                await page.locator('[data-nav="handoff"]').click()
                await page.locator(".kardex-type-fold").first.wait_for()
                assert await page.locator(".kardex-type-fold").count()==3
                assert await page.locator('.kardex-type-fold[data-kind="prn"] .kardex-order-item').count()==4
                assert await page.locator('.kardex-type-fold[data-kind="regular"] .kardex-order-item').count()==2
                first=page.locator('.kardex-type-fold[data-kind="prn"] .kardex-order-item').first
                await first.locator("summary").click()
                assert "처방 작성자" in await first.inner_text()
                assert "최초 처방 원문" in await first.inner_text()
                await page.locator("#patientSelect").select_option("DEMO-P002")
                await page.wait_for_function('document.querySelector(".kardex-type-fold[data-kind=prn]")?.textContent.includes("0건")')
                assert await page.locator('.kardex-type-fold[data-kind="prn"] .kardex-order-item').count()==0
                assert await page.locator('.kardex-type-fold[data-kind="regular"] .kardex-order-item').count()==2

                await page.locator('[data-nav="roster"]').click()
                assert await page.locator("#micuRosterFile").get_attribute("accept")==" .json,application/json".strip()
                await page.locator("#micuRosterDate").fill("2026-10-13")
                await page.locator("#micuRosterDuty").select_option("D")
                workbook=await page.evaluate("""() => {
                  const rows=[['번호','이름',...Array.from({length:31},(_,i)=>i+1)]];
                  const people=['정하늘','이서연','강유진','박연우'];
                  const duties=['D','E','N','NC'];
                  people.forEach((name,i)=>rows.push([i+1,name,...Array.from({length:31},(_,k)=>duties[(i+k)%4])]));
                  const wb=XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'2026년10월');
                  return XLSX.write(wb,{bookType:'xlsx',type:'base64'});
                }""")
                data=base64.b64decode(workbook)
                await page.locator("#teachingRosterFile").set_input_files({"name":"2026_10_synthetic.xlsx","mimeType":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","buffer":data})
                await page.wait_for_function('document.querySelector("#teachingRosterMessage").textContent.includes("Excel을 읽었습니다")')
                await page.locator("#teachingRosterAnalyze").click()
                await page.wait_for_timeout(700)
                analyze_status=await page.locator("#teachingRosterMessage").inner_text()
                assert "해석을 완료" in analyze_status, "Excel parser message: "+analyze_status
                assert "4명" in await page.locator("#teachingRosterPreview").inner_text()
                await page.locator("#teachingRosterVerify").check()
                assert await page.locator("#teachingRosterSave").is_enabled()
                await page.locator("#teachingRosterSave").click()
                await page.wait_for_function('document.querySelector("#teachingRosterMessage").textContent.includes("저장을 확인")')
                record=page.locator('.teaching-roster-entry[data-roster-id="2026-10"]')
                assert await record.count()==1
                assert "사용 중" not in await record.inner_text()
                await record.locator("button").first.click()
                await page.wait_for_function('document.querySelector("#teachingRosterOnDuty").textContent.includes("활성")')
                assert "2026년 10월" in await page.locator("#teachingRosterOnDuty").inner_text()
                # The original MICU JSON input and PRN nurse session remain independent.
                assert await page.locator("#sessionSelect").input_value()=="SIM-SHIFT-D"
                assert await page.evaluate('async () => (await PRNRosterLibraryStore.list()).length')==1
                await page.reload(wait_until="networkidle")
                await page.wait_for_function('document.querySelector("#visibleCount")?.textContent === "6건"')
                await page.locator('[data-nav="roster"]').click()
                await page.wait_for_function('document.querySelector(".teaching-roster-entry") !== null')
                assert await page.evaluate('async () => await PRNRosterLibraryStore.activeId()')=="2026-10"
                # Confirm dialog for deletion must be accepted.
                record=page.locator('.teaching-roster-entry[data-roster-id="2026-10"]')
                assert await record.count()==1
                page.once("dialog",lambda d:asyncio.create_task(d.accept()))
                await record.locator("button").last.click()
                await page.wait_for_function('document.querySelector("#teachingRosterList").textContent.includes("저장된 교육용 근무표가 없습니다")')
                assert await page.evaluate('async () => await PRNRosterLibraryStore.activeId()') is None
                assert await page.locator("#micuRosterFile").get_attribute("accept")==" .json,application/json".strip()
                mobile=await browser.new_page(viewport={"width":390,"height":844})
                mobile.on("pageerror",lambda e:errors.append(str(e)))
                await mobile.goto(url,wait_until="networkidle")
                await mobile.locator('[data-nav="handoff"]').click()
                await mobile.locator(".kardex-type-fold").first.wait_for(state="attached",timeout=15000)
                assert await mobile.locator(".kardex-type-fold").count()==3
                assert not errors, errors
                print("PASS v0.6.0 Chromium: patient profiles, prescriber defaults, Kardex folds, XLSX parse/store/use/reload/delete, old JSON preserved, mobile.")
            finally:
                await browser.close()
    finally:
        server.shutdown();server.server_close();thread.join(timeout=5)

if __name__=="__main__":
    asyncio.run(main())
