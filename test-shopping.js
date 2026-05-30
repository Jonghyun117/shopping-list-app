const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'shopping-list.html').replace(/\\/g, '/');

let passed = 0;
let failed = 0;

function ok(name) {
  console.log(`  ✅ ${name}`);
  passed++;
}
function fail(name, err) {
  console.log(`  ❌ ${name}`);
  console.log(`     ${err}`);
  failed++;
}

async function assert(condition, name, detail = '') {
  if (condition) ok(name);
  else fail(name, detail || '조건 불충족');
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page    = await browser.newPage();

  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   🛒 쇼핑 리스트 앱 자동 테스트');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('[1] 초기 상태 확인');
  try {
    const emptyVisible = await page.locator('#empty').isVisible();
    await assert(emptyVisible, '빈 상태 메시지 표시됨');

    const totalText = await page.locator('#stat-total').textContent();
    await assert(totalText.trim() === '총 0개', `초기 총 개수 "총 0개"`, `실제: "${totalText.trim()}"`);

    const remText = await page.locator('#stat-rem').textContent();
    await assert(remText.trim() === '0개 남음', `초기 남은 개수 "0개 남음"`, `실제: "${remText.trim()}"`);

    const clearDisabled = await page.locator('#btn-clear').isDisabled();
    await assert(clearDisabled, '"완료 항목 지우기" 버튼 비활성화');
  } catch (e) { fail('초기 상태 확인', e.message); }

  console.log('\n[2] 아이템 추가');
  const items = ['사과', '우유', '빵'];
  try {
    for (const item of items) {
      await page.fill('#item-input', item);
      await page.click('#btn-add');
      await page.waitForTimeout(100);
    }

    const count = await page.locator('.item').count();
    await assert(count === 3, `3개 아이템 추가됨 (실제: ${count}개)`);

    const totalText = await page.locator('#stat-total').textContent();
    await assert(totalText.trim() === '총 3개', `통계 "총 3개" 표시`, `실제: "${totalText.trim()}"`);

    const remText = await page.locator('#stat-rem').textContent();
    await assert(remText.trim() === '3개 남음', `통계 "3개 남음" 표시`, `실제: "${remText.trim()}"`);

    const emptyHidden = await page.locator('#empty').isHidden();
    await assert(emptyHidden, '빈 상태 메시지 숨겨짐');
  } catch (e) { fail('아이템 추가', e.message); }

  console.log('\n[3] Enter 키로 추가');
  try {
    await page.fill('#item-input', '달걀');
    await page.press('#item-input', 'Enter');
    await page.waitForTimeout(100);

    const count = await page.locator('.item').count();
    await assert(count === 4, `Enter 키로 추가 후 4개 (실제: ${count}개)`);

    const inputVal = await page.inputValue('#item-input');
    await assert(inputVal === '', '추가 후 입력창 초기화됨');
  } catch (e) { fail('Enter 키로 추가', e.message); }

  console.log('\n[4] 빈 입력 방지');
  try {
    await page.fill('#item-input', '   ');
    await page.click('#btn-add');
    await page.waitForTimeout(100);

    const count = await page.locator('.item').count();
    await assert(count === 4, `공백 입력 무시됨 (여전히 4개, 실제: ${count}개)`);
  } catch (e) { fail('빈 입력 방지', e.message); }

  console.log('\n[5] 체크(완료) 기능');
  try {
    const firstItem = page.locator('.item').first();
    await firstItem.locator('.circle').click();
    await page.waitForTimeout(150);

    const isDone = await firstItem.evaluate(el => el.classList.contains('done'));
    await assert(isDone, '첫 번째 아이템 체크됨 (.done 클래스 추가)');

    const remText = await page.locator('#stat-rem').textContent();
    await assert(remText.trim() === '3개 남음', `체크 후 "3개 남음" (실제: "${remText.trim()}")`);

    await firstItem.locator('.label').click();
    await page.waitForTimeout(150);

    const isUndone = await firstItem.evaluate(el => !el.classList.contains('done'));
    await assert(isUndone, '텍스트 클릭으로 체크 해제됨');

    const remText2 = await page.locator('#stat-rem').textContent();
    await assert(remText2.trim() === '4개 남음', `체크 해제 후 "4개 남음" (실제: "${remText2.trim()}")`);
  } catch (e) { fail('체크(완료) 기능', e.message); }

  console.log('\n[6] 아이템 삭제');
  try {
    const lastItem = page.locator('.item').last();
    await lastItem.hover();
    await page.waitForTimeout(100);
    await lastItem.locator('.btn-del').click();
    await page.waitForTimeout(400);

    const count = await page.locator('.item').count();
    await assert(count === 3, `삭제 후 3개 (실제: ${count}개)`);

    const totalText = await page.locator('#stat-total').textContent();
    await assert(totalText.trim() === '총 3개', `삭제 후 "총 3개" (실제: "${totalText.trim()}")`);
  } catch (e) { fail('아이템 삭제', e.message); }

  console.log('\n[7] 완료 항목 일괄 삭제');
  try {
    const allItems = page.locator('.item');
    await allItems.nth(0).locator('.circle').click();
    await page.waitForTimeout(100);
    await allItems.nth(1).locator('.circle').click();
    await page.waitForTimeout(100);

    const clearEnabled = await page.locator('#btn-clear').isEnabled();
    await assert(clearEnabled, '"완료 항목 지우기" 버튼 활성화됨');

    await page.click('#btn-clear');
    await page.waitForTimeout(500);

    const count = await page.locator('.item').count();
    await assert(count === 1, `일괄 삭제 후 1개 (실제: ${count}개)`);

    const clearDisabled = await page.locator('#btn-clear').isDisabled();
    await assert(clearDisabled, '완료 항목 없으면 버튼 다시 비활성화');
  } catch (e) { fail('완료 항목 일괄 삭제', e.message); }

  console.log('\n[8] localStorage 데이터 유지');
  try {
    const beforeCount = await page.locator('.item').count();
    await page.reload();
    await page.waitForTimeout(300);

    const afterCount = await page.locator('.item').count();
    await assert(afterCount === beforeCount, `새로고침 후 데이터 유지 (${afterCount}개)`);
  } catch (e) { fail('localStorage 유지', e.message); }

  console.log('\n[9] 전체 삭제 후 빈 상태 복원');
  try {
    const items = await page.locator('.item').all();
    for (const item of items) {
      await item.hover();
      await page.waitForTimeout(80);
      await item.locator('.btn-del').click();
      await page.waitForTimeout(350);
    }

    const emptyVisible = await page.locator('#empty').isVisible();
    await assert(emptyVisible, '모두 삭제 후 빈 상태 메시지 다시 표시됨');
  } catch (e) { fail('빈 상태 복원', e.message); }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   결과: ${passed + failed}개 중 ✅ ${passed}개 통과 / ❌ ${failed}개 실패`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await page.waitForTimeout(1500);
  await browser.close();

  process.exit(failed > 0 ? 1 : 0);
})();