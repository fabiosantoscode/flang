'use strict'

const whitespace = ' \n\r'
const binaryOperators = [
  '+',
  '-',
  '*',
  '/'
]
const comparisonOperators = [
  '>',
  '<',
  '>=',
  '<='
]
const punc = '()[]{}:.-+'
const strDelim = `'"`
const booleans = ['true', 'false']
const numberKeywords = ['NaN', 'Infinity']
exports.tokenize = (source) => {
  const tokens = []

  let i = 0
  let line = 1
  let col = 0

  const next = () => {
    if (i >= source.length) {
      throw new Error('trying to go past end')
    }
    const char = source[i]
    if (char === '\n') {
      line += 1
      col = 0
    }
    i++
    col++
    return char
  }

  const peek = () => {
    if (i >= source.length) return ''
    else return source[i]
  }

  const isIdentifier = (start) => {
    const char = peek()
    if (start) {
      return /^[a-zA-Z_$]$/.test(char)
    }
    return isIdentifier(true) || /^[0-9-]$/.test(char)
  }

  const canBeOp = (start) => {
    if (peek() === '') {
      return false
    }
    const starters = binaryOperators
      .concat(comparisonOperators)
      .find(s => s.startsWith(start + peek()))
    return Boolean(starters)
  }

  const isNumeral = () => /^[0-9]$/.test(peek())

  while (peek() !== '') {
    while (whitespace.includes(peek())) next()

    if (peek() === '') break

    if (punc.includes(peek())) {
      tokens.push(next())
    } else if (isNumeral()) {
      let num = ''
      while (isNumeral()) {
        num += next()
      }
      tokens.push(Number(num))
    } else if (isIdentifier(true)) {
      let ident = ''
      while (isIdentifier() && peek()) {
        ident += next()
      }
      if (booleans.includes(ident)) {
        tokens.push(JSON.parse(ident))
      } else if (numberKeywords.includes(ident)) {
        tokens.push(eval(ident))
      } else {
        tokens.push(ident)
      }
    } else if (strDelim.includes(peek())) {
      let str = ''
      const endStr = next()
      while (peek() && peek() !== endStr) {
        str += next()
      }
      if (!peek()) {
        throw new Error('Unterminated string at ' + line + ':' + col)
      }
      next()
      tokens.push(['/str', str])
    } else if (canBeOp('')) {
      let binOpSoFar = next()
      while (canBeOp(binOpSoFar)) {
        binOpSoFar += next()
      }
      tokens.push(binOpSoFar)
    } else {
      throw new Error('Syntax error at ' + line + ':' + col + ': unknown character ' + peek())
    }
  }

  return tokens
}

exports.parse = (source) => {
  const tokens = exports.tokenize(source)

  let i = 0

  const next = () => {
    const tok = tokens[i]
    i += 1
    return tok
  }

  const peek = () => {
    if (i > tokens.length) return ''
    return tokens[i]
  }

  const parseExpression = () => {
    if (peek()[0] === '/str') {
      const str = next()
      return str
    } else if (typeof peek() === 'number') {
      return next()
    } else if (peek() === '(') {
      next()
      const sExpr = []
      while (peek() !== '' && peek() !== ')') {
        sExpr.push(parseExpression())
      }
      next()
      return sExpr
    } else if (/^[a-zA-Z$_-]+$/.test(peek())) {
      return next()
    } else if (binaryOperators.includes(peek()) || comparisonOperators.includes(peek())) {
      return next()
    } else {
      throw new Error('Unexpected ' + peek())
    }
  }

  const program = ['do']

  while (i < tokens.length) {
    program.push(parseExpression())
  }

  return program
}

const binaryOps = binaryOperators.map(op => [op, function operator (first, ...rest) {
  if (!rest.length) {
    return first
  }
  // eslint-disable-next-line no-unused-vars
  const restResult = operator(...rest)
  return eval('first ' + op + ' restResult')
}])

const comparisonOps = comparisonOperators.map(op => [op, function operator (first, second, ...rest) {
  if (!rest.length) {
    return eval('first ' + op + ' second')
  }
  return operator(eval('first ' + op + ' second'), ...rest)
}])

const unaryOps = []

const nativeGlobals = Object.fromEntries([
  ...binaryOps,
  ...comparisonOps,
  ...unaryOps
])

const evaluate = exports.evaluate = (expression) => {
  const isAtom = !Array.isArray(expression)
  if (isAtom) {
    return expression
  }
  const [head, ...args] = expression
  if (head in nativeGlobals) {
    const func = nativeGlobals[head]
    return func(...args)
  }
  if (head === 'do') {
    for (var i = 0; ; i++) {
      const isLast = i === args.length - 1
      const val = evaluate(args[i])
      if (isLast) return val
    }
  } else if (head === 'if') {
    const [cond, then, alternate] = args
    if (evaluate(cond)) {
      return evaluate(then)
    } else if (alternate != null) {
      return evaluate(alternate)
    }
    return null
  } else {
    throw new Error('Unknown function or macro ' + head)
  }
}

exports.parseEvaluate = (source) => {
  return evaluate(exports.parse(source))
}
