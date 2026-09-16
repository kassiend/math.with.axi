/**
 * One captured frame, with a bounded wait and one retry.
 *
 * Playwright's screenshot waits on `document.fonts`; the pages preload every face first
 * (web/src/fonts.ts) so that wait has nothing to do. The timeout and retry exist for the machine,
 * not the page: multi-minute stalls in a capture were traced to the Mac going to system sleep
 * mid-run (`pmset sleep 1`) — run long captures under `caffeinate -is`. A stall that survives
 * both is still a failure, loudly.
 */
export const SHOT_TIMEOUT_MS = 20_000;

export async function shoot(page, file, attempts = 2) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.screenshot({ path: file, animations: 'disabled', timeout: SHOT_TIMEOUT_MS });
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
