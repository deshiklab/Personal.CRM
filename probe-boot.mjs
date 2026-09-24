/* Shared first-launch helper: clears the registration window, then the pin setup.
 * Every probe must call this before touching the app. */
export async function boot(pg, url = 'http://localhost:5173/#/') {
  await pg.goto(url)
  await pg.waitForTimeout(1300)

  // 1 · registration window (shown before anything else on a fresh profile)
  const regName = pg.locator('input[placeholder="e.g. BiTsCol"]')
  if (await regName.count()) {
    await regName.fill('Test User')
    await pg.locator('input[type="email"]').first().fill('tester@example.com')
    await pg.locator('input[type="tel"]').first().fill('+880 1700-000999')
    await pg.locator('button:has-text("Continue")').click()
    await pg.waitForTimeout(900)
  }
  // 2 · pincode setup (offered once, skippable)
  const skip = pg.locator('button:has-text("Skip for now")')
  if (await skip.count()) { await skip.first().click(); await pg.waitForTimeout(900) }
  /* the guided tour volunteers itself once on the dashboard — close it so it
     cannot intercept clicks in the tests that follow */
  await pg.waitForTimeout(400)
  await pg.keyboard.press('Escape')
  await pg.waitForTimeout(300)
}

/* Register a specific person (used when a probe needs a known greeting name). */
export async function registerAs(pg, name, email = 'tester@example.com', mobile = '+880 1700-000999') {
  const regName = pg.locator('input[placeholder="e.g. BiTsCol"]')
  if (await regName.count()) {
    await regName.fill(name)
    await pg.locator('input[type="email"]').first().fill(email)
    await pg.locator('input[type="tel"]').first().fill(mobile)
    await pg.locator('button:has-text("Continue")').click()
    await pg.waitForTimeout(900)
  }
  const skip = pg.locator('button:has-text("Skip for now")')
  if (await skip.count()) { await skip.first().click(); await pg.waitForTimeout(900) }
}
