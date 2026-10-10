"""Local Chromium smoke tests. Uses localhost only and synthetic prescription data."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"

async def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8").replace('<link rel="stylesheet" href="./styles.css">', '').replace('<script src="./app.js" defer></script>', '')
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    js = (ROOT / "app.js").read_text(encoding="utf-8")
    med = json.loads((ROOT / "data/medication_catalog_candidates.json").read_text(encoding="utf-8"))
    orders = json.loads((ROOT / "data/simulated_orders_SCHEMA_ONLY.json").read_text(encoding="utf-8"))
    patients = json.loads((ROOT / "data/patients.json").read_text(encoding="utf-8"))
    shifts = json.loads((ROOT / "data/staff_shifts.json").read_text(encoding="utf-8"))
    reviews = json.loads((ROOT / "data/verification_events.json").read_text(encoding="utf-8"))
    ARTIFACTS.mkdir(exist_ok=True)
    async with async_playwright() as p:
            executable = "/usr/bin/chromium" if Path("/usr/bin/chromium").exists() else None
            browser=await p.chromium.launch(headless=True, executable_path=executable, args=["--no-sandbox", "--disable-dev-shm-usage"])
            async def load_fixture(pg):
                await pg.set_content(html)
                await pg.add_style_tag(content=css)
                await pg.evaluate("""(data) => {window.fetch = async (url) => {
                  const file = String(url).split('/').pop();
                  const map = {'medication_catalog_candidates.json':data.med,'simulated_orders_SCHEMA_ONLY.json':data.orders,
                    'patients.json':data.patients,'staff_shifts.json':data.shifts,'verification_events.json':data.reviews};
                  return {ok:Object.hasOwn(map,file),json:async () => map[file]};
                };}""", {"med": med, "orders": orders, "patients": patients,"shifts":shifts,"reviews":reviews})
                await pg.add_script_tag(content=js)
            page=await browser.new_page(viewport={"width":1440,"height":900}, device_scale_factor=1)
            errors=[]
            page.on('pageerror', lambda e: errors.append(str(e)))
            await load_fixture(page)
            await page.wait_for_function('document.querySelector("#visibleCount").textContent.includes("건")')
            assert await page.locator('#tabAll').get_attribute('aria-selected')=='true'
            assert await page.locator('#visibleCount').inner_text()=='6건'
            assert await page.locator('tbody tr[data-order-id]').count()==6
            await page.screenshot(path=str(ARTIFACTS / 'desktop.png'),full_page=True)
            await page.locator('#tabPrn').click()
            assert await page.locator('#visibleCount').inner_text()=='4건'
            assert await page.locator('#statusFilter').input_value()=='all'
            assert await page.locator('tbody tr[data-order-id]').count()==4
            statuses=await page.locator('tbody tr[data-order-id] .status-chip').all_inner_texts()
            assert statuses==['유효','유효','보류','중지'],statuses
            await page.locator('tbody tr[data-order-id]').first.click()
            assert await page.locator('#detailContent .detail-title').inner_text()=='아세트아미노펜'
            assert '처방자' in await page.locator('#detailContent').inner_text()
            assert '서지훈 MD' in await page.locator('#detailContent').inner_text()
            assert '열람 확인' in await page.locator('#detailContent').inner_text()
            assert '김가온' in await page.locator('#patientSummary').inner_text()
            assert '정하늘 RN' in await page.locator('#sessionContext').inner_text()
            # First seeded acknowledgement exists, switching shift and clicking adds logged-in nurse event.
            assert '정하늘 RN' in await page.locator('#detailContent').inner_text()
            await page.locator('#sessionSelect').select_option('SIM-SHIFT-E')
            await page.locator('#ackButton').click()
            assert '이서연 RN' in await page.locator('#detailContent').inner_text()
            assert await page.locator('#ackButton').is_disabled()
            await page.locator('#searchInput').fill('온단세트론')
            assert await page.locator('#visibleCount').inner_text()=='1건'
            await page.locator('#searchInput').fill('')
            await page.locator('#statusFilter').select_option('stopped')
            assert await page.locator('#visibleCount').inner_text()=='1건'
            assert (await page.locator('tbody tr[data-order-id] .status-chip').inner_text())=='중지'
            await page.locator('#patientSelect').select_option('DEMO-P002')
            assert await page.locator('#tabAll').get_attribute('aria-selected')=='true'
            assert await page.locator('#visibleCount').inner_text()=='2건'
            assert await page.locator('#statusFilter').input_value()=='all'
            await page.locator('#tabPrn').click()
            assert await page.locator('#visibleCount').inner_text()=='0건'
            assert '등록된 PRN 약물 처방이 없습니다' in await page.locator('#ordersBody').inner_text()
            await page.locator('#patientSelect').select_option('DEMO-P003')
            await page.locator('#tabPrn').click()
            assert await page.locator('#visibleCount').inner_text()=='5건'
            await page.locator('#searchInput').fill('살부타몰')
            assert await page.locator('#visibleCount').inner_text()=='2건'
            await page.locator('#searchInput').fill('')
            await page.locator('#searchInput').fill('메토클로프라미드')
            assert '미기재' in await page.locator('#ordersBody').inner_text()
            await page.screenshot(path=str(ARTIFACTS / 'filtered.png'),full_page=True)
            await page.locator('#patientSelect').select_option('DEMO-P004')
            assert await page.locator('#visibleCount').inner_text()=='4건'
            assert '피부 가려움' in await page.locator('#patientSummary').inner_text()
            await page.locator('#tabPrn').click()
            assert await page.locator('#visibleCount').inner_text()=='3건' 
            # Mobile details must be accessible and close without losing the patient context.
            mobile=await browser.new_page(viewport={"width":390,"height":844}, device_scale_factor=1)
            mobile.on('pageerror',lambda e: errors.append(str(e)))
            await load_fixture(mobile)
            await mobile.wait_for_function('document.querySelector("#visibleCount").textContent.includes("건")')
            assert await mobile.locator('#tabAll').get_attribute('aria-selected')=='true'
            await mobile.locator('#tabPrn').click()
            await mobile.locator('tbody tr[data-order-id]').first.locator('.detail-link').click()
            assert await mobile.locator('#detailPanel').evaluate('(el)=> getComputedStyle(el).display') != 'none'
            await mobile.screenshot(path=str(ARTIFACTS / 'mobile.png'),full_page=True)
            await mobile.locator('#closeDetail').click()
            assert await mobile.locator('#detailPanel').evaluate('(el)=> getComputedStyle(el).display') == 'none'
            assert not errors, errors
            await browser.close()
            print('PASS: desktop/mobile, four patient scenarios, prescriber, simulated login/ack, default tab, PRN sort, search/filter, empty PRN patient, no JS errors')

if __name__=='__main__':
    asyncio.run(main())
