import { describe, expect, it } from 'vitest'
import { parse } from 'postcss'
import { objectify } from 'postcss-js'
import { extractClassNameKeys } from './extract'
import { toCamelCase } from './util'
import type { GetParseCaseFunction } from './type'

const extract = (css: string, toParseCase?: GetParseCaseFunction) => [
  ...extractClassNameKeys(objectify(parse(css)), toParseCase).keys(),
]

describe('extractClassNameKeys', () => {
  it('extracts top-level class names', () => {
    const keys = extract(`.foo { color: red; } .bar .baz { color: blue; }`)
    expect(keys).toEqual(['foo', 'bar', 'baz'])
  })

  it('splits combined selectors (pseudo, combinator, comma)', () => {
    const keys = extract(`.a:hover > .b, .c { color: red; }`)
    expect(keys).toEqual(expect.arrayContaining(['a', 'b', 'c']))
  })

  it('skips @import and @apply keys', () => {
    const keys = extract(`@import url('./foo.css');\n.foo { color: red; }`)
    expect(keys).toEqual(['foo'])
  })

  it('extracts keys under :export', () => {
    const keys = extract(`:export { myColor: #fff; }`)
    expect(keys).toEqual(['myColor'])
  })

  it('applies toParseCase to extracted keys', () => {
    const keys = extract(`.foo_bar { color: red; }`, toCamelCase)
    expect(keys).toEqual(['fooBar'])
  })

  it('handles duplicated at-rules objectified as arrays', () => {
    const keys = extract(
      `@media (min-width: 100px) { .a { color: red; } }
       @media (min-width: 100px) { .b { color: blue; } }`
    )
    expect(keys).toEqual(expect.arrayContaining(['a', 'b']))
  })

  describe('ampersand nesting (#122)', () => {
    it('resolves `&_suffix` against the parent selector', () => {
      const keys = extract(`.Root {
        --size: round(var(--spinnerSize, 1.5rem), 1px);
        width: var(--size);

        &:not(&_active) {
          display: none;
        }

        &_active {
          animation: spin 1.2s 500ms var(--easeOut1) infinite;
        }
      }`)
      expect(keys).toEqual(expect.arrayContaining(['Root', 'Root_active']))
      expect(keys).not.toEqual(
        expect.arrayContaining(['not', '_active', '&_active'])
      )
    })

    it('resolves multi-level nesting', () => {
      const keys = extract(`.Root {
        &_active {
          &_inner { color: red; }
        }
      }`)
      expect(keys).toEqual(
        expect.arrayContaining(['Root', 'Root_active', 'Root_active_inner'])
      )
    })

    it('resolves `&` inside nested at-rules against the rule selector', () => {
      const keys = extract(`.Root {
        @media (min-width: 600px) {
          &_wide { color: blue; }
        }
      }`)
      expect(keys).toEqual(expect.arrayContaining(['Root', 'Root_wide']))
    })

    it('resolves comma-separated parent selectors as a product', () => {
      const keys = extract(`.a, .b {
        &_x { color: green; }
      }`)
      expect(keys).toEqual(expect.arrayContaining(['a', 'b', 'a_x', 'b_x']))
    })

    it('applies toParseCase to resolved selectors', () => {
      const keys = extract(`.root { &_active { color: red; } }`, toCamelCase)
      expect(keys).toEqual(expect.arrayContaining(['root', 'rootActive']))
    })

    it('keeps nested selectors without `&` working as before', () => {
      const keys = extract(`.parent {
        .child { color: red; }
      }`)
      expect(keys).toEqual(expect.arrayContaining(['parent', 'child']))
    })
  })
})
