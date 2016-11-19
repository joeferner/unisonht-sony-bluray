import {UnisonHTDevice} from "unisonht";

export default class SonyBluray implements UnisonHTDevice {
  private options: SonyBluray.Options;

  constructor(options: SonyBluray.Options) {
    this.options = options;
  }

  getName(): string {
    return this.options.name;
  }

  buttonPress(button: string): Promise<void> {
    return Promise.resolve();
  }

  ensureOn(): Promise<void> {
    return Promise.resolve();
  }

  ensureOff(): Promise<void> {
    return Promise.resolve();
  }
}

module SonyBluray {
  export interface Options {
    name: string;
    address: string;
    mac: string;
  }
}