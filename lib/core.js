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
  '<=',
  '==',
  '!='
]
const punc = '()[]{}:.-+'
const strDelim = `'"`
const booleans = ['true', 'false']
const numberKeywords = ['NaN', 'Infinity']
const last = coll => coll[coll.length - 1]

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
    if (char === '\r') return next()
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
    return isIdentifier(true) || /^[0-9-]$/.test(char) || char === '.'
  }

  const canBeOp = (start) => {
    if (peek() === '') {
      return false
    }
    const starters = binaryOperators
      .concat(comparisonOperators)
      .find(s => s.startsWith(start + peek()))
    if (start[0] === '/' && isIdentifier()) {
      throw new Error('Unexpected internal call')
    }
    return Boolean(starters)
  }

  const isNumeral = () => /^[0-9]$/.test(peek())

  const readString = () => {
    const endStr = next()
    const lines = []
    let line = ''
    let leadingWhitespace = 0
    let nonWhitespaceFound
    while (peek() && peek() !== endStr) {
      const ch = next()
      line += ch
      if (whitespace.includes(ch) && !nonWhitespaceFound) {
        leadingWhitespace++
      } else if (!whitespace.includes(ch)) {
        nonWhitespaceFound = true
      }
      if (ch === '\n') {
        lines.push([nonWhitespaceFound, leadingWhitespace, line])
        line = ''
        leadingWhitespace = 0
        nonWhitespaceFound = false
      }
    }
    if (line) {
      lines.push([nonWhitespaceFound, leadingWhitespace, line])
    }
    if (!peek()) {
      throw new Error('Unterminated string at ' + line + ':' + col)
    }
    next()
    if (lines.length > 1) {
      let leastLeadingWhitespace = Infinity
      for (let i = 0; i < lines.length; i++) {
        const [nonWhitespaceFound, leadingWhitespace] = lines[i]
        if (!nonWhitespaceFound) {
          lines.splice(i, 1)
          i--
          continue
        }

        if (leastLeadingWhitespace > leadingWhitespace) {
          leastLeadingWhitespace = leadingWhitespace
        }
      }
      if (lines.length && last(last(lines)[2]) === '\n') {
        last(lines)[2] = last(lines)[2].slice(0, -1)
      }
      return lines
        .map(([_, __, line]) =>
          line.slice(leastLeadingWhitespace))
        .join('')
    }
    return last(lines[0])
  }

  while (peek() !== '') {
    while (peek() && whitespace.includes(peek())) next()

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
      tokens.push(['/str', readString()])
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

const parse = exports.parse = (source) => {
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
    } else if (peek() === '[') {
      next()
      const list = ['/list']
      while (peek() !== '' && peek() !== ']') {
        list.push(parseExpression())
      }
      next()
      return list
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

const unaryOps = [
  ['/str', x => x]
]

const nativeGlobals = Object.fromEntries([
  ...binaryOps,
  ...comparisonOps,
  ...unaryOps
])

class Scope {
  constructor (parent) {
    this.parent = parent
    this.variables = new Map()
  }

  lookup (name) {
    if (this.variables.has(name)) return this.variables.get(name)
    if (this.parent) return this.parent.lookup(name)
    throw new Error('Unknown variable ' + name)
  }
}

class Fn {
  constructor (name, argList, body, parentScope) {
    this.name = name
    this.argList = argList
    this.body = body
    this.parentScope = parentScope
    Object.freeze(this)
  }
}

const toArgList = argList => {
  if (argList[0] !== '/list') {
    throw new Error('function was not given a list as the argument list')
  }
  argList.shift()
  if (!argList.every(x => typeof x === 'string')) {
    throw new Error('non-name argument in argument list')
  }
  return argList
}

const compile = exports.compile = (expression) => {
  if (typeof expression === 'string') return expression
  if (typeof expression === 'number') return expression
  if (typeof expression === 'boolean') return expression

  let [head, ...args] = expression

  if (Array.isArray(head)) {
    return `(${compile(head)})(${args.map(compile).join(', ')})`
  }

  if (head === 'do') {
    if (!args.length) return 'null'
    args = args.map(compile)
    if (args.length === 1) return args[0]
    const last = args.pop()
    return '(()=>{' + args.join(';') + ';return ' + last + '})()'
  } else if (head === 'if') {
    args = args.map(compile)
    if (args.length < 3) args.push('null')
    return `(${args[0]}?${args[1]}:${args[2]})`
  } else if (head === 'def') {
    return `let ${args[0]}=${compile(args[1])}`
  } else if (head === 'set') {
    return `(${args[0]}=${compile(args[1])})`
  } else if (head === 'fn') {
    const name = args[0][0] === '/list' ? '' : args.shift()
    const argList = args.shift().slice(1).join(',')
    const body = compile(['do', ...args])
    if (name) {
      return `(function ${name}(${argList}){return ${body}})`
    }
    return `((${argList}) => ${body})`
  } else if (head === '/str') {
    return JSON.stringify(args[0])
  } else if (head === '/list') {
    return JSON.stringify(args)
  } else if (comparisonOperators.includes(head)) {
    return `(${args.map(compile).reduce((a, b) => `(${a})${head}${b}`)})`
  } else if (binaryOperators.includes(head)) {
    return '(' + args.map(compile).join(head) + ')'
  } else if (typeof head === 'string') {
    return `${head}(${args.map(compile).join(',')})`
  }

  throw new Error('unknown expression ' + head)
}

const evaluate = exports.evaluate = (expression, stack = [new Scope(null)]) => {
  const scope = stack[stack.length - 1]
  if (typeof expression === 'string') {
    return scope.lookup(expression)
  }
  const isAtom = !Array.isArray(expression)
  const push = (s = new Scope(scope)) => stack.concat(s)
  if (isAtom) {
    return expression
  }
  let [head, ...args] = expression
  if (Array.isArray(head)) {
    head = evaluate(head, stack)
  }
  if (head instanceof Fn) {
    const fnScope = new Scope(head.parentScope)
    head.argList.forEach((arg, i) => {
      fnScope.variables.set(arg, evaluate(args[i], stack))
    })
    return evaluate(head.body, push(fnScope))
  }
  if (head in nativeGlobals) {
    const func = nativeGlobals[head]
    return func(...args)
  }
  if (head === 'do') {
    let val
    const doStack = push()
    for (let i = 0; i < args.length; i++) {
      val = evaluate(args[i], doStack)
    }
    return val
  } else if (head === 'if') {
    const [cond, then, alternate] = args
    if (evaluate(cond, stack)) {
      return evaluate(then, stack)
    } else if (alternate != null) {
      return evaluate(alternate, stack)
    }
    return null
  } else if (head === 'fn') {
    let name
    if (!Array.isArray(args[0])) {
      name = args.shift()
    }
    if (!Array.isArray(args[0])) {
      throw new Error('function without arguments list')
    }
    const argList = toArgList(args.shift())
    return new Fn(name, argList, ['do', ...args], scope)
  } else if (head === 'set') {
    const value = evaluate(args[1], scope)
    scope.variables.set(args[0], value)
    return value
  } else if (head === 'def') {
    const value = evaluate(args[1], scope)
    scope.variables.set(args[0], value)
    return value
  } else {
    throw new Error('Unknown function or macro ' + head)
  }
}

exports.parseEvaluate = source => evaluate(parse(source))
exports.parseCompile = source => compile(parse(source))
