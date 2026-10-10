"""PRN Order Viewer v0.5.2: real local-HTTP Chromium smoke using synthetic repository fixtures only."""
import asyncio
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


async def ready(page):
    await page.wait_for_function(
        'document.querySelector("#visibleCount")?.textContent === "6건"',
        timeout=15000,
    )


async def main():
    ARTIFACTS.mkdir(exist_ok=True)
    handler = partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = "http://127.0.0.1:" + str(server.server_port) + "/"
    errors = []
    browser = None
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"]
            )
            page = await browser.new_page(viewport={"width": 1440, "height": 900})
            page.on("pageerror", lambda error: errors.append(str(error)))
            response = await page.goto(url, wait_until="networkidle")
            assert response is not None and response.status == 200
            await ready(page)

            # P001: initial all-orders default, PRN filtering, explicit-only list conditions.
            assert await page.locator("#tabAll").get_attribute("aria-selected") == "true"
            assert await page.locator("tbody tr[data-order-id]").count() == 6
            await page.locator("#tabPrn").click()
            assert await page.locator("#visibleCount").inner_text() == "4건"
            assert await page.locator("#statusFilter").input_value() == "all"
            statuses = await page.locator("tbody tr[data-order-id] .status-chip").all_inner_texts()
            assert statuses == ["유효", "유효", "보류", "중지"], statuses
            assert await page.locator("#ordersBody .prn-list-condition").count() == 0
            await page.locator("tbody tr[data-order-id]").first.click()
            assert await page.locator(".prn-confirmation").count() == 1
            assert "현재 PRN 처방 핵심 확인" in await page.locator(".prn-confirmation").inner_text()
            assert "미기재" in await page.locator(".prn-confirmation").inner_text()
            labels = await page.locator("#detailContent .detail-label").all_inner_texts()
            assert labels.count("1회 용량") == 1, labels
            assert labels.count("PRN 투여 조건") == 1, labels
            assert "열람 확인" in await page.locator("#detailContent").inner_text()
            await page.screenshot(path=str(ARTIFACTS / "v0.5.2-desktop.png"), full_page=True)

            # Shift-specific acknowledgement is separate from order administration.
            await page.locator("#sessionSelect").select_option("SIM-SHIFT-E")
            await page.locator("#ackButton").click()
            assert "이서연 RN" in await page.locator("#detailContent").inner_text()
            assert await page.locator("#ackButton").is_disabled()
            await page.locator("#searchInput").fill("온단세트론")
            assert await page.locator("#visibleCount").inner_text() == "1건"
            await page.locator("#searchInput").fill("")
            await page.locator("#statusFilter").select_option("stopped")
            assert await page.locator("#visibleCount").inner_text() == "1건"

            # Patient isolation, missing PRNs, mixed-status records.
            await page.locator("#patientSelect").select_option("DEMO-P002")
            assert await page.locator("#visibleCount").inner_text() == "2건"
            await page.locator("#tabPrn").click()
            assert await page.locator("#visibleCount").inner_text() == "0건"
            await page.locator("#patientSelect").select_option("DEMO-P003")
            await page.locator("#tabPrn").click()
            assert await page.locator("#visibleCount").inner_text() == "5건"
            await page.locator("#searchInput").fill("살부타몰")
            assert await page.locator("#visibleCount").inner_text() == "2건"
            await page.locator("#patientSelect").select_option("DEMO-P004")
            assert await page.locator("#visibleCount").inner_text() == "4건"
            await page.locator("#tabPrn").click()
            assert await page.locator("#visibleCount").inner_text() == "3건"

            # P001: real doctor UI -> PRN entry -> order list -> change history -> current instructions.
            await page.locator("#patientSelect").select_option("DEMO-P001")
            await page.locator('[data-nav="doctor"]').click()
            assert await page.locator("#composerPanel").is_visible()
            await page.locator("#composerMode").select_option("prn")
            await page.locator("#composerMedication").select_option(index=1)
            await page.locator("#composerWhen").fill("2026-10-10T10:30")
            await page.locator("#composerDose").fill("SIM test dose")
            await page.locator("#composerRoute").fill("SIM test route")
            await page.locator("#composerFrequency").fill("SIM test frequency")
            await page.locator("#composerIndication").fill("SIM test symptom")
            await page.locator("#composerCondition").fill("SIM unique PRN condition")
            await page.locator('#composerForm button[type="submit"]').click()
            assert "추가됐습니다" in await page.locator("#composerMessage").inner_text()
            order_id = await page.evaluate(
                '() => window.PRNComposerHost.context().existing.find(o => o.simulated_input)?.order_id'
            )
            assert order_id and order_id.startswith("SIM-ORD-NEW-"), order_id
            await page.locator("#composerViewOrder").click()
            assert await page.locator("#visibleCount").inner_text() == "5건"
            await page.locator("#searchInput").fill("SIM unique PRN condition")
            assert await page.locator("#visibleCount").inner_text() == "1건"
            assert await page.locator("#ordersBody .prn-list-condition").count() == 1
            assert "SIM unique PRN condition" in await page.locator(".prn-confirmation").inner_text()

            await page.locator('[data-nav="history"]').click()
            await page.locator("#historyOrder").select_option(order_id)
            await page.locator("#historyAction").select_option("revise")
            await page.locator("#historyWhen").fill("2026-10-10T12:00")
            await page.locator("#historyReason").fill("Synthetic test update")
            await page.locator("#historyDose").fill("SIM revised dose")
            await page.locator('#historyForm button[type="submit"]').click()
            assert "변경이 기록됐습니다" in await page.locator("#historyFeedback").inner_text()
            await page.locator('[data-nav="orders"]').click()
            assert "SIM revised dose" in await page.locator(".prn-confirmation").inner_text()
            assert "버전 1" in await page.locator(".prn-confirmation").inner_text()
            assert "변경 버전 1" in await page.locator("#ordersBody").inner_text()

            # Every new prescription and event is ephemeral, not persisted on reload.
            await page.reload(wait_until="networkidle")
            await ready(page)
            assert await page.locator("#visibleCount").inner_text() == "6건"
            await page.locator("#tabPrn").click()
            assert await page.locator("#visibleCount").inner_text() == "4건"

            mobile = await browser.new_page(viewport={"width": 390, "height": 844})
            mobile.on("pageerror", lambda error: errors.append(str(error)))
            await mobile.goto(url, wait_until="networkidle")
            await ready(mobile)
            await mobile.locator("#tabPrn").click()
            await mobile.locator('tbody tr[data-order-id]').first.locator(".detail-link").click()
            assert await mobile.locator("#detailPanel").is_visible()
            assert await mobile.locator(".prn-confirmation").is_visible()
            await mobile.screenshot(path=str(ARTIFACTS / "v0.5.2-mobile.png"), full_page=True)
            await mobile.locator("#closeDetail").click()
            assert not await mobile.locator("#detailPanel").is_visible()
            assert await mobile.locator("#visibleCount").inner_text() == "4건"
            assert not errors, errors
            print("PASS v0.5.2 real HTTP Chromium: PRN/search/status/missing values, RN ack, four patients, doctor entry, revision, reload isolation, mobile.")
    finally:
        if browser is not None:
            await browser.close()
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    asyncio.run(main())
