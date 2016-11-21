const repl = require('repl');
const SonyBluray = require('.').default;
var sonyBluray = new SonyBluray({
  name: 'bluray',
  address: '192.168.0.166',
  mac: '78:61:7c:a9:cc:c9'
});

sonyBluray.start({})
  .then(()=> {
    console.log('sonyBluray exported');
    const r = repl.start('> ');
    r.context.sonyBluray = sonyBluray;
  })
  .catch((err)=> {
    console.error('could not start', err);
  });
