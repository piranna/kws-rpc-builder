module.exports = process.env.RPCBUILDER_COV
  ? require('./lib-cov/index')
  : require('./lib/index')
