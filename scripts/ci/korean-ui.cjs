'use strict';
const { chromium, expect: baseExpect } = require('@playwright/test');
const expect = baseExpect.configure({ timeout: 60000 });
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ko = require('../../frontend/src/i18n/locales/ko.json');

module.exports = async function checkKoreanScreens(base, platform, setGalleryTheme) {
  const browser = await chromium.launch({ headless: true });
  const output = process.env.UI_SCREENSHOT_DIR || '/tmp/picpeak-korean-ui';
  fs.mkdirSync(output, { recursive: true });
  const forbidden = [];
  async function newPage(viewport) {
    const context = await browser.newContext({ viewport, locale: 'en-US' });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('request', request => {
      if (/POST|PUT|PATCH|DELETE/.test(request.method()) && /\/api\/.*(?:settings|profile)/.test(request.url())) {
        forbidden.push(`${request.method()} ${new URL(request.url()).pathname}`);
      }
    });
    return page;
  }
  async function choose(page) {
    await page.getByRole('button', { name: /English/ }).click();
    await page.getByRole('button', { name: '한국어', exact: true }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('picpeak.screenLanguage'))).toBe('ko');
  }
  async function capture(page, name, width) {
    await expect.poll(() => page.locator('body').innerText()).toMatch(/[가-힣]/);
    const later = page.getByRole('button', { name: ko.setup.usageReporting.skip, exact: true });
    if (await later.isVisible()) {
      await later.click();
      await expect(later).toBeHidden();
    }
    await page.screenshot({ path: path.join(output, `${platform.split('/').pop()}-${width}-${name}.png`) });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: horizontal overflow at ${width}px`);
  }
  try {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      console.log(`Checking Korean screens at ${viewport.width}px (${platform}).`);
      const admin = await newPage(viewport);
      await admin.goto(`${base}/admin/login`);
      await choose(admin);
      await admin.locator('input[type="email"]').fill('smoke@example.com');
      await admin.locator('input[type="password"]').fill('Smoke-Only-2026!Pass');
      await admin.getByRole('button', { name: ko.adminLogin.signIn, exact: true }).click();
      await admin.waitForURL('**/admin/dashboard');
      await expect(admin.getByRole('heading', { name: ko.navigation.dashboard, exact: true })).toBeVisible();
      await capture(admin, 'admin-dashboard', viewport.width);
      await admin.goto(`${base}/admin/events`);
      await expect(admin.getByText('한국어 보존 검사', { exact: true }).first()).toBeVisible();
      await admin.reload();
      assert.equal(await admin.evaluate(() => localStorage.getItem('picpeak.screenLanguage')), 'ko');
      await expect(admin.getByText('한국어 보존 검사', { exact: true }).first()).toBeVisible();
      const headingBox = await admin.getByRole('heading', { name: ko.events.title, exact: true }).locator('..').boundingBox();
      const buttonBox = await admin.getByRole('button', { name: ko.events.createEvent, exact: true }).boundingBox();
      assert.ok(headingBox && buttonBox && (buttonBox.x >= headingBox.x + headingBox.width || buttonBox.y >= headingBox.y + headingBox.height), 'Event header text and creation button must not overlap');
      await capture(admin, 'admin-events', viewport.width);
      await admin.context().close();

      const customer = await newPage(viewport);
      await customer.goto(`${base}/customer/login`);
      await choose(customer);
      await customer.locator('input[type="email"]').fill('customer@example.com');
      await customer.locator('input[type="password"]').fill('Smoke-Only-2026!Pass');
      await customer.getByRole('button', { name: ko.customer.login.signIn, exact: true }).click();
      await customer.waitForURL('**/customer/dashboard');
      await expect(customer.getByRole('combobox', { name: ko.common.language })).toHaveValue('ko');
      await customer.reload();
      await expect(customer.getByRole('combobox', { name: ko.common.language })).toHaveValue('ko');
      await customer.goto(`${base}/customer/profile`);
      await expect(customer.getByRole('combobox', { name: ko.common.language })).toHaveValue('ko');
      await expect(customer.getByRole('heading', { name: ko.customer.profile.title, exact: true })).toBeVisible();
      await capture(customer, 'customer-profile', viewport.width);
      await customer.context().close();

      const gallery = await newPage(viewport);
      await gallery.goto(`${base}/gallery/ko-smoke`);
      const selector = gallery.getByRole('combobox', { name: /Language/ });
      await selector.selectOption('ko');
      await expect(gallery.getByRole('combobox', { name: ko.common.language })).toHaveValue('ko');
      await gallery.reload();
      await expect(gallery.getByRole('combobox', { name: ko.common.language })).toHaveValue('ko');
      await capture(gallery, 'gallery', viewport.width);
      for (const theme of setGalleryTheme ? ['galleryPremium', 'galleryStory'] : []) {
        setGalleryTheme(theme);
        await gallery.reload();
        await expect(gallery.getByRole('combobox', { name: ko.common.language })).toHaveValue('ko');
        // Framer Motion animates the title's parent via requestAnimationFrame.
        await expect.poll(() => gallery.locator('h1').first().evaluate(el => {
          let opacity = 1;
          for (let node = el; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
          return opacity;
        })).toBe(1);
        await capture(gallery, theme, viewport.width);
      }
      if (setGalleryTheme) setGalleryTheme(null);
      await gallery.context().close();
    }
    assert.deepEqual(forbidden, [], 'Choosing a screen language must never write server settings/profile');
    console.log(`Korean UI passed (${platform}): admin/customer login, server locale precedence, reload, navigation, gallery, no settings writes and desktop/mobile layout.`);
  } catch (error) {
    for (const [index, context] of browser.contexts().entries()) {
      for (const page of context.pages()) {
        await page.screenshot({ path: path.join(output, `${platform.split('/').pop()}-failure-${index}.png`) }).catch(() => {});
        console.error(`UI failure at ${page.url()}: ${(await page.locator('body').innerText().catch(() => '')).slice(0, 2500)}`);
      }
    }
    throw error;
  } finally { await browser.close(); }
};
