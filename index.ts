import {Device, UnisonHT, UnisonHTResponse} from "unisonht";
import * as express from "express";
import {SonyBlurayClientImpl} from "./SonyBlurayClientImpl";
import {SonyBlurayClient} from "./SonyBlurayClient";
import {MockSonyBlurayClient} from "./MockSonyBlurayClient";

export class SonyBluray extends Device {
  private client: SonyBlurayClient;

  constructor(name: string, options: SonyBluray.Options) {
    super(name, options);
    this.client = process.env.NODE_ENV === 'development'
      ? new MockSonyBlurayClient()
      : new SonyBlurayClientImpl({
        address: options.address,
        mac: options.mac,
        irccPort: options.irccPort || 50001,
        port: options.port || 50002,
        deviceIdPrefix: options.deviceIdPrefix || 'UnisonHT',
        deviceName: options.deviceName || 'UnisonHT'
      });
  }

  start(unisonht: UnisonHT): Promise<void> {
    return super.start(unisonht)
      .then(() => {
        unisonht.getApp().post(`${this.getPathPrefix()}/on`, this.handleOn.bind(this));
        unisonht.getApp().post(`${this.getPathPrefix()}/off`, this.handleOff.bind(this));
        return this.client.start();
      });
  }

  protected handleButtonPress(req: express.Request, res: UnisonHTResponse, next: express.NextFunction): void {
    const buttonName = req.query.buttonName;
    res.promiseNoContent(this.client.buttonPress(buttonName));
  }

  handleOn(req: express.Request, res: UnisonHTResponse, next: express.NextFunction): void {
    res.promiseNoContent(this.client.on());
  }

  handleOff(req: express.Request, res: UnisonHTResponse, next: express.NextFunction): void {
    res.promiseNoContent(this.client.off());
  }

  getStatus(): Promise<SonyBluray.Status> {
    return this.client.getStatus();
  }

  public getOptions(): SonyBluray.Options {
    return <SonyBluray.Options>super.getOptions();
  }
}

export module SonyBluray {
  export interface Options extends Device.Options {
    address: string;
    mac: string;
    irccPort?: number;
    port?: number;
    deviceIdPrefix?: string;
    deviceName?: string;
  }

  export interface Status extends Device.Status {

  }
}
