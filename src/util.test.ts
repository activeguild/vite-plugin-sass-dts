import { describe, expect, it } from 'vitest'
import {
  collectionToObj,
  getRelativePath,
  isCSSModuleRequest,
  isCSSRequest,
  isSassException,
  toCamelCase,
  toDashCase,
} from './util'

describe('isCSSRequest', () => {
  it('matches css lang extensions', () => {
    expect(isCSSRequest('/path/to/style.css')).toBe(true)
    expect(isCSSRequest('/path/to/style.scss')).toBe(true)
    expect(isCSSRequest('/path/to/style.sass')).toBe(true)
    expect(isCSSRequest('/path/to/style.pcss')).toBe(true)
    expect(isCSSRequest('/path/to/style.scss?used')).toBe(true)
  })

  it('does not match other extensions', () => {
    expect(isCSSRequest('/path/to/style.less')).toBe(false)
    expect(isCSSRequest('/path/to/module.ts')).toBe(false)
  })
})

describe('isCSSModuleRequest', () => {
  it('matches only `.module.*` css requests', () => {
    expect(isCSSModuleRequest('/path/to/style.module.css')).toBe(true)
    expect(isCSSModuleRequest('/path/to/style.module.scss')).toBe(true)
    expect(isCSSModuleRequest('/path/to/style.scss')).toBe(false)
    expect(isCSSModuleRequest('/path/to/style.module.less')).toBe(false)
  })
})

describe('getRelativePath', () => {
  it('returns a relative path ending with a slash', () => {
    expect(getRelativePath('/a/b', '/a/b/c')).toBe('./c/')
    expect(getRelativePath('/a/b/c', '/a/b')).toBe('../')
  })

  it('returns ./ for the same or missing paths', () => {
    expect(getRelativePath('/a/b', '/a/b')).toBe('./')
    expect(getRelativePath(undefined, undefined)).toBe('./')
  })
})

describe('toDashCase', () => {
  it('converts separators to dashes and lowercases', () => {
    expect(toDashCase('foo_bar')).toBe('foo-bar')
    expect(toDashCase('foo-bar')).toBe('foo-bar')
    expect(toDashCase('foo bar')).toBe('foo-bar')
    expect(toDashCase('foo.bar')).toBe('foo-bar')
    expect(toDashCase('foo/bar')).toBe('foo-bar')
    expect(toDashCase('foo~bar')).toBe('foo-bar')
  })

  it('lowercases camelCase words without inserting dashes', () => {
    expect(toDashCase('fooBar')).toBe('foobar')
    expect(toDashCase('FooBar')).toBe('foobar')
  })
})

describe('toCamelCase', () => {
  it('converts separated words to camelCase', () => {
    expect(toCamelCase('foo_bar')).toBe('fooBar')
    expect(toCamelCase('foo-bar')).toBe('fooBar')
    expect(toCamelCase('foo bar')).toBe('fooBar')
    expect(toCamelCase('foo.bar')).toBe('fooBar')
    expect(toCamelCase('foo/bar')).toBe('fooBar')
    expect(toCamelCase('foo~bar')).toBe('fooBar')
  })

  it('lowercases a leading uppercase letter', () => {
    expect(toCamelCase('FooBar')).toBe('fooBar')
    expect(toCamelCase('fooBar')).toBe('fooBar')
  })
})

describe('isSassException', () => {
  it('detects objects with a `file` property', () => {
    expect(isSassException({ file: '/path/to/style.scss' })).toBe(true)
    expect(isSassException({})).toBe(false)
    expect(isSassException(null)).toBe(false)
    expect(isSassException('error')).toBe(false)
  })
})

describe('collectionToObj', () => {
  it('merges a collection of records into one object', () => {
    expect(collectionToObj([{ a: 1 }, { b: 2 }])).toEqual({ a: 1, b: 2 })
    expect(collectionToObj([])).toEqual({})
  })

  it('lets later entries win on key conflicts', () => {
    expect(collectionToObj([{ a: 1 }, { a: 2 }])).toEqual({ a: 2 })
  })
})
