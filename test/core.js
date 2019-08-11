'use strict'

const assert = require('assert').strict

const core = require('../lib/core.js')

describe('tokenizer', () => {
  it('can tokenize', () => {
    assert.deepEqual(core.tokenize('(a b)'), ['(', 'a', 'b', ')'])
    assert.deepEqual(core.tokenize('< > >= +'), ['<', '>', '>=', '+'])
  })
})

describe('parser', () => {
  it('can parse', () => {
    assert.deepEqual(core.parse(''), ['do'])
    assert.deepEqual(core.parse('()'), ['do', []])
    assert.deepEqual(core.parse('(a b)'), ['do', ['a', 'b']])
  })
  it('can parse binops', () => {
    assert.deepEqual(core.parse('(< (>= 1 2) (- 1 4))'), ['do', ['<', ['>=', 1, 2], ['-', 1, 4]]])
  })
  it('can parse strings', () => {
    assert.deepEqual(core.parse('"sup"'), ['do', ['/str', 'sup']])
  })
  it('can parse numbers', () => {
    assert.deepEqual(core.parse('42'), ['do', 42])
  })
  it('can parse bools', () => {
    assert.deepEqual(core.parse('true false'), ['do', true, false])
  })
  it('can parse recursive expressions', () => {
    assert.deepEqual(core.parse('((a (b c)) d)'), ['do', [['a', ['b', 'c']], 'd']])
  })
})

describe('interpreter', () => {
  it('can evaluate', () => {
    assert.deepEqual(core.parseEvaluate('1 2 3 42'), 42)
  })
  it('evaluates cmpops', () => {
    assert.deepEqual(core.parseEvaluate('(< 1 2)'), true)
    assert.deepEqual(core.parseEvaluate('(<= 1 2 3)'), true)
  })
  it('evaluates binOps', () => {
    assert.deepEqual(core.parseEvaluate('(- 1 2)'), -1)
    assert.deepEqual(core.parseEvaluate('(+ 1 2 3)'), 6)
  })
  it('evaluates if', () => {
    assert.deepEqual(core.parseEvaluate('(if 1 1 0)'), 1)
    assert.deepEqual(core.parseEvaluate('(if 0 1 0)'), 0)
  })
})
