import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dictionaries, en, bn, interpolate, LANGUAGES } from '../src/i18n/dictionary.js'

test('every language in LANGUAGES has a dictionary', () => {
  for (const lang of LANGUAGES) {
    assert.ok(dictionaries[lang.code], `missing dictionary for ${lang.code}`)
    assert.ok(lang.dir === 'ltr' || lang.dir === 'rtl')
  }
})

test('Bengali defines exactly the same keys as English (no half-translated strings)', () => {
  const enKeys = Object.keys(en).sort()
  const bnKeys = Object.keys(bn).sort()

  const missingInBn = enKeys.filter((k) => !(k in bn))
  const extraInBn = bnKeys.filter((k) => !(k in en))

  assert.deepEqual(missingInBn, [], `keys missing from bn: ${missingInBn.join(', ')}`)
  assert.deepEqual(extraInBn, [], `unknown keys in bn: ${extraInBn.join(', ')}`)
})

// Strings that are legitimately identical in both languages.
const SHARED = new Set(['invocation', 'emailPlaceholder', 'statusUnpaid'])

test('no translation is left empty or as the English fallback', () => {
  for (const key of Object.keys(en)) {
    if (SHARED.has(key)) continue
    assert.ok(bn[key] && bn[key].trim() !== '', `bn.${key} is empty`)
    assert.notEqual(bn[key], en[key], `bn.${key} is identical to the English string`)
  }
})

test('no dictionary value contains stray CJK characters', () => {
  for (const [lang, dict] of Object.entries(dictionaries)) {
    for (const [key, value] of Object.entries(dict)) {
      assert.ok(
        !/[\u3000-\u9fff]/.test(value),
        `${lang}.${key} contains CJK characters: ${value}`,
      )
    }
  }
})

test('interpolate fills placeholders and leaves unknown ones alone', () => {
  assert.equal(interpolate('Saved {count} for {month}.', { count: 3, month: 'September 2026' }),
    'Saved 3 for September 2026.')
  assert.equal(interpolate('{count} selected', { count: 0 }), '0 selected')
  assert.equal(interpolate('Hi {name}', {}), 'Hi {name}')
  assert.equal(interpolate('No placeholders', { a: 1 }), 'No placeholders')
})

test('placeholders used in English exist in the Bengali string too', () => {
  for (const key of Object.keys(en)) {
    const enVars = [...en[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const bnVars = [...bn[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    assert.deepEqual(bnVars, enVars, `bn.${key} placeholders differ from en.${key}`)
  }
})
