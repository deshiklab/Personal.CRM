/* Shared first-launch helper: clears the Welcome window (setup paths + identity),
 * then the pin setup. Every probe must call this before touching the app. */
export async function boot(pg, url = 'http://localhost:5173/#/') {
  await pg.goto(url)
  await pg.waitForTimeout(1300)

  // 0 · Welcome home (setup paths) — choose "I'm new" so the identity form appears
  const fresh = pg.locator('button:has-text("I\'m new"), button:has-text("start fresh")')
  if (await fresh.count()) {
    await fresh.first().click()
    await pg.waitForTimeout(500)
  }

  // 1 · registration / identity window
  const regName = pg.locator('input[placeholder="e.g. BiTsCol"]')
  if (await regName.count()) {
    await regName.fill('Test User')
    await pg.locator('input[type="email"]').first().fill('tester@example.com')
    await pg.locator('input[type="tel"]').first().fill('+880 1700-000999')
    /* Continue with sample data (or any Continue) */
    const cont = pg.locator('button:has-text("Continue")')
    if (await cont.count()) await cont.first().click()
    await pg.waitForTimeout(900)
  } else {
    /* fallback: skip setup entirely if still on home */
    const skip = pg.locator('button:has-text("Skip setup"), button:has-text("Skip identity")')
    if (await skip.count()) { await skip.first().click(); await pg.waitForTimeout(700) }
  }

  // 2 · pincode setup (offered once, skippable)
  const skipPin = pg.locator('button:has-text("Skip for now")')
  if (await skipPin.count()) { await skipPin.first().click(); await pg.waitForTimeout(900) }

  /* the guided tour volunteers itself once on the dashboard — close it so it
     cannot intercept clicks in the tests that follow */
  await pg.waitForTimeout(400)
  await pg.keyboard.press('Escape')
  await pg.waitForTimeout(300)
  /* dismiss post-tour demo choice if it already surfaced */
  const keep = pg.locator('button:has-text("Continue with demo data")')
  if (await keep.count()) { await keep.first().click(); await pg.waitForTimeout(400) }
  await pg.keyboard.press('Escape')
  await pg.waitForTimeout(200)
}

/* Register a specific person (used when a probe needs a known greeting name). */
export async function registerAs(pg, name, email = 'tester@example.com', mobile = '+880 1700-000999') {
  const fresh = pg.locator('button:has-text("I\'m new"), button:has-text("start fresh")')
  if (await fresh.count()) {
    await fresh.first().click()
    await pg.waitForTimeout(400)
  }
  const regName = pg.locator('input[placeholder="e.g. BiTsCol"]')
  if (await regName.count()) {
    await regName.fill(name)
    await pg.locator('input[type="email"]').first().fill(email)
    await pg.locator('input[type="tel"]').first().fill(mobile)
    const cont = pg.locator('button:has-text("Continue")')
    if (await cont.count()) await cont.first().click()
    await pg.waitForTimeout(900)
  }
  const skip = pg.locator('button:has-text("Skip for now")')
  if (await skip.count()) { await skip.first().click(); await pg.waitForTimeout(900) }
  const keep = pg.locator('button:has-text("Continue with demo data")')
  if (await keep.count()) { await keep.first().click(); await pg.waitForTimeout(300) }
}
