import { UnisonHT, WebApi } from '@unisonht/unisonht';
import { SonyBluray } from '.';

const port = 3000;
const unisonht = new UnisonHT({
  settingsFileName: '/tmp/unisonht.settings.json',
});
unisonht.use(new WebApi({ port }));

unisonht.use(
  new SonyBluray('bluray', {
    address: '192.168.0.166',
    mac: '78:61:7c:a9:cc:c9',
  }),
);

async function start() {
  try {
    await unisonht.start();
    console.log(`Listening http://localhost:${port}`);
  } catch (err) {
    console.error('failed to start', err);
  }
}

start();
