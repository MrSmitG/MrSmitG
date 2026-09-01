import { expect, test, type Page } from '@playwright/test'

type CanvasOperation = 'clearRect' | 'getImageData' | 'putImageData'

async function instrumentCanvas(page: Page, operation: CanvasOperation) {
  await page.addInitScript((failureOperation) => {
    const state = {
      failAlways: false,
      failNext: false,
      failures: 0,
      frames: 0,
      puts: 0,
      toDataUrls: 0,
    }
    ;(window as typeof window & { canvasTestState: typeof state }).canvasTestState = state

    const clearRect = CanvasRenderingContext2D.prototype.clearRect
    const getImageData = CanvasRenderingContext2D.prototype.getImageData
    const putImageData = CanvasRenderingContext2D.prototype.putImageData
    const toDataURL = HTMLCanvasElement.prototype.toDataURL

    const shouldFail = (currentOperation: CanvasOperation) => {
      if (currentOperation !== failureOperation || (!state.failNext && !state.failAlways)) return false
      state.failNext = false
      state.failures += 1
      return true
    }

    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      state.frames += 1
      if (shouldFail('clearRect')) throw new DOMException('transient test failure', 'InvalidStateError')
      return Reflect.apply(clearRect, this, args)
    }
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      if (shouldFail('getImageData'))
        throw new DOMException('transient test failure', 'InvalidStateError')
      return Reflect.apply(getImageData, this, args)
    }
    CanvasRenderingContext2D.prototype.putImageData = function (...args) {
      state.puts += 1
      if (shouldFail('putImageData'))
        throw new DOMException('transient test failure', 'InvalidStateError')
      return Reflect.apply(putImageData, this, args)
    }
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      state.toDataUrls += 1
      return Reflect.apply(toDataURL, this, args)
    }
  }, operation)
}

for (const operation of ['clearRect', 'getImageData', 'putImageData'] as const) {
  test(`continues rendering after a transient ${operation} error`, async ({ page }) => {
    await instrumentCanvas(page, operation)
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => window.canvasTestState.puts)).toBeGreaterThan(5)

    await page.evaluate((nextPayload) => {
      window.canvasTestState.failNext = true
      const input = document.querySelector<HTMLInputElement>('input[placeholder]')!
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setValue.call(input, nextPayload)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }, `payload after ${operation}`)

    await expect.poll(() => page.evaluate(() => window.canvasTestState.failures)).toBe(1)
    const framesAtFailure = await page.evaluate(() => window.canvasTestState.frames)
    await expect
      .poll(() => page.evaluate(() => window.canvasTestState.frames))
      .toBeGreaterThan(framesAtFailure + 5)

    await page.getByRole('button', { name: 'Scan this frame' }).click()
    await expect(page.getByTestId('scan-ok')).toContainText(`payload after ${operation}`)
  })
}

test('blocks scan and export while rendering cannot recover', async ({ page }) => {
  await instrumentCanvas(page, 'getImageData')
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => window.canvasTestState.puts)).toBeGreaterThan(5)

  await page.evaluate(() => {
    window.canvasTestState.failAlways = true
  })
  await expect.poll(() => page.evaluate(() => window.canvasTestState.failures)).toBeGreaterThan(2)

  await page.getByRole('button', { name: 'Scan this frame' }).click()
  await expect(page.getByTestId('scan-fail')).toBeVisible()

  const exportsBefore = await page.evaluate(() => window.canvasTestState.toDataUrls)
  await page.getByRole('button', { name: 'Download PNG' }).click()
  await expect.poll(() => page.evaluate(() => window.canvasTestState.toDataUrls)).toBe(exportsBefore)
})

declare global {
  interface Window {
    canvasTestState: {
      failAlways: boolean
      failNext: boolean
      failures: number
      frames: number
      puts: number
      toDataUrls: number
    }
  }
}
