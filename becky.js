// Setup ES6 auto-transpiler
require('babel/register')({
  sourceMap: 'inline'
});

require('./lib/App.js');