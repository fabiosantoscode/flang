'use strict'

const assert = require('assert').strict

const core = require('../lib/core.js')

describe('tokenizer', () => {
  it('can tokenize', () => {
    assert.deepEqual(core.tokenize('(a b)'), ['(', 'a', 'b', ')'])
    assert.deepEqual(core.tokenize('foo.bar'), ['foo.bar'])
    assert.deepEqual(core.tokenize('< > >= +'), ['<', '>', '>=', '+'])
    assert.deepEqual(core.tokenize('[1 2 3]'), ['[', 1, 2, 3, ']'])
  })
  it('does not tokenize internal call tokens', () => {
    assert.throws(() => core.tokenize('(/str)'))
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
  it('can parse lambdas', () => {
    assert.deepEqual(core.parse('(fn (x) x)'), ['do', ['fn', ['x'], 'x']])
  })
  it('can parse lists', () => {
    assert.deepEqual(core.parse('[42]'), ['do', ['/list', 42]])
  })
  it('deals with trailing whitespace', () => {
    assert.deepEqual(core.parse(`42 `), ['do', 42])
  })
})

for (const test of ['interpreter', 'compiler']) {
  const evaluate = test === 'interpreter'
    ? core.parseEvaluate
    : code => (0, eval)(core.compile(core.parse(code)))
  describe(test, () => {
    it('can evaluate', () => {
      assert.equal(evaluate('1 2 3 42'), 42)
    })
    it('evaluates cmpops', () => {
      assert.equal(evaluate('(< 1 2)'), true)
      assert.equal(evaluate('(<= 1 2 3)'), true)
      assert.equal(evaluate('(>= 3 2 1)'), true)
    })
    it('evaluates binOps', () => {
      assert.equal(evaluate('(- 1 2)'), -1)
      assert.equal(evaluate('(+ 1 2 3)'), 6)
    })
    it('evaluates if', () => {
      assert.equal(evaluate('(if 1 1 0)'), 1)
      assert.equal(evaluate('(if 0 1 0)'), 0)
    })
    it('evaluates strings', () => {
      assert.equal(evaluate('"sup"'), 'sup')
    })
    if (test === 'compiler') {
      it('compiles lambdas', () => {
        assert.equal(core.parseCompile('(fn [] 42)'), '(() => 42)')
      })
      it('compiles lambdas with name', () => {
        assert.equal(
          core.parseCompile('(fn foo [] 42069)'),
          '(function foo(){return 42069})'
        )
      })
    }
    it('evaluates lambdas', () => {
      assert.equal(evaluate('((fn [] 10))'), 10)
    })
    it('evaluates lambdas with arguments', () => {
      assert.equal(evaluate('((fn [x] x) 42)'), 42)
    })
    it('evaluates def', () => {
      assert.equal(evaluate('(def x 42) x'), 42)
    })
    it('redefines variables', () => {
      assert.equal(evaluate('(def x 0) (set x 42) x'), 42)
    })
  })
}
