import { expect, test } from '../../fixtures/test'
import {
    expectLocalizedValidation,
    expectNoDataGridTechnicalLeakage,
    expectNoTechnicalLeakage,
    expectSemanticFieldControls
} from '../../support/browser/runtimeUx'

test('runtime UX oracles inspect visible control values and compact structured cells', async ({ page }) => {
    const exposedId = '0190a9b5-3cde-7abc-8def-0123456789a2'
    await page.setContent(`
      <main>
        <section data-testid="visible-id-surface">
          <label for="record-ref">Record</label>
          <input id="record-ref" value="${exposedId}" />
        </section>
        <section data-testid="hidden-id-surface" hidden>
          <input value="${exposedId}" />
        </section>
        <section data-testid="accessible-name-surface">
          <button aria-label="Open record ${exposedId}">Open record</button>
        </section>
        <section data-testid="image-alt-surface">
          <img alt="Preview of record ${exposedId}" src="/preview.png" />
        </section>
        <section data-testid="title-surface">
          <button title="Open record ${exposedId}">Open record</button>
        </section>
        <section data-testid="structured-grid">
          <div class="MuiDataGrid-root">
            <div class="MuiDataGrid-virtualScroller">
              <div role="row"><div role="gridcell">{"src":"/internal/assets/hero.png","alt":"raw media payload"}</div></div>
            </div>
          </div>
        </section>
        <section data-testid="localized-validation-surface">
          <p class="MuiFormHelperText-root Mui-error">This field is required.</p>
        </section>
        <section data-testid="localized-description-controls">
          <label>English Description<textarea></textarea></label>
          <label>Russian Description<input /></label>
        </section>
      </main>
    `)

    await expect(
        expectNoTechnicalLeakage(page.getByTestId('visible-id-surface'), {
            label: 'Visible record reference field',
            checkUuidSubstrings: true
        })
    ).rejects.toThrow('visible raw UUID value')

    await expect(
        expectNoTechnicalLeakage(page.getByTestId('image-alt-surface'), {
            label: 'Visible image alternative text',
            checkUuidSubstrings: true
        })
    ).rejects.toThrow('visible raw UUID value')

    await expect(
        expectNoTechnicalLeakage(page.getByTestId('title-surface'), {
            label: 'Visible control tooltip',
            checkUuidSubstrings: true
        })
    ).rejects.toThrow('visible raw UUID value')

    await expectNoTechnicalLeakage(page.getByTestId('hidden-id-surface'), {
        label: 'Hidden record reference field',
        checkUuidSubstrings: true
    })

    await expect(
        expectNoTechnicalLeakage(page.getByTestId('accessible-name-surface'), {
            label: 'Visible accessible name',
            checkUuidSubstrings: true
        })
    ).rejects.toThrow('visible raw UUID value')

    await expect(
        expectNoDataGridTechnicalLeakage(page.getByTestId('structured-grid'), {
            label: 'Compact structured action cell',
            requireVisibleGrid: false
        })
    ).rejects.toThrow('visible raw JSON/object text')

    await expect(
        expectLocalizedValidation(page.getByTestId('localized-validation-surface'), 'ru', { label: 'Russian required-field fallback' })
    ).rejects.toThrow('must not expose internal validation text for ru')

    await expect(
        expectSemanticFieldControls(page.getByTestId('localized-description-controls'), { longTextLabels: ['Description'] })
    ).rejects.toThrow('control #2 must be multiline')
})
