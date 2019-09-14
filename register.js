const { addHook } = require('pirates')
const core = require('./lib/core')

if (global.__FLANG_REGISTER__) {
  throw new Error('flang/register imported twice')
}

global.__FLANG_REGISTER__ = require('./package.json').version

const compile = (code, filename) => {
  return core.parseCompile(code)
}

addHook(compile, {
  exts: ['.fl'],
  ignoreNodeModules: true
})
