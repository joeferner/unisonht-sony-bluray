import {Device, DeviceOptions} from "unisonht/lib/Device";

interface SonyBlurayOptions extends DeviceOptions {
  address: string;
  mac: string;
}

export default class SonyBluray extends Device {
  constructor(options: SonyBlurayOptions) {
    super(options);
  }
}