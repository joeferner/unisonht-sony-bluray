import {UnisonHT} from "unisonht";
import {SonyBluray} from ".";

const unisonht = new UnisonHT();

unisonht.use(new SonyBluray('bluray', {
  address: '192.168.0.166',
  mac: '78:61:7c:a9:cc:c9'
}));

unisonht.listen(3000);
