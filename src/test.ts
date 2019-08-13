import { UnisonHT, WebApi } from '@unisonht/unisonht';
import { SonyBluray } from '.';
import promptly from 'promptly';

const port = 3000;
const unisonht = new UnisonHT({
  settingsFileName: '/tmp/unisonht.settings.json',
  prompt: async (message: string) => {
    return await promptly.prompt(message);
  },
});
unisonht.use(new WebApi({ port }));

unisonht.use(
  new SonyBluray('bluray', {
    address: '192.168.0.172',
    mac: 'd8:d4:3c:a0:9e:82',
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
