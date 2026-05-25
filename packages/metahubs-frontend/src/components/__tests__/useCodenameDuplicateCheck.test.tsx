import { render, screen } from '@testing-library/react'
import { createLocalizedContent, updateLocalizedContentLocale } from '@universo/utils'
import { describe, expect, it } from 'vitest'
import { useCodenameDuplicateCheck } from '../useCodenameDuplicateCheck'

const buildCodenameVlc = (primary: string, aliases: Record<string, string> = {}) => {
    let value = createLocalizedContent('en', primary)

    for (const [locale, content] of Object.entries(aliases)) {
        value = updateLocalizedContentLocale(value, locale, content)
    }

    return value
}

function TestResult(props: Parameters<typeof useCodenameDuplicateCheck>[0]) {
    const result = useCodenameDuplicateCheck(props)

    return (
        <div>
            <span data-testid='error'>{result.error ?? ''}</span>
            <span data-testid='duplicate'>{result.duplicateValue ?? ''}</span>
        </div>
    )
}

describe('useCodenameDuplicateCheck', () => {
    it('flags duplicates by canonical primary codename only', () => {
        render(
            <TestResult
                codename={buildCodenameVlc('PrimaryCode', { ru: 'Псевдоним' })}
                existingEntities={[
                    {
                        id: 'existing-1',
                        codename: buildCodenameVlc('primarycode', { ru: 'ДругойПсевдоним' })
                    }
                ]}
            />
        )

        expect(screen.getByTestId('error').textContent).toBe('duplicate')
        expect(screen.getByTestId('duplicate').textContent).toBe('PrimaryCode')
    })

    it('ignores alias-only collisions when primary codename stays unique', () => {
        render(
            <TestResult
                codename={buildCodenameVlc('UniquePrimary', { ru: 'SharedAlias' })}
                existingEntities={[
                    {
                        id: 'existing-1',
                        codename: buildCodenameVlc('ExistingPrimary', { ru: 'SharedAlias' })
                    }
                ]}
            />
        )

        expect(screen.getByTestId('error').textContent).toBe('')
        expect(screen.getByTestId('duplicate').textContent).toBe('')
    })
})
