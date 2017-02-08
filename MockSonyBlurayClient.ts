import {SonyBlurayClient} from "./SonyBlurayClient";
import * as Logger from "bunyan";
import {createLogger} from "../unisonht/lib/Log";
import {SonyBluray} from "./index";

export class MockSonyBlurayClient implements SonyBlurayClient {
  private log: Logger;

  constructor() {
    this.log = createLogger('MockSonyBlurayClient');
  }

  buttonPress(buttonName: any): Promise<void> {
    this.log.info(`buttonPress ${buttonName}`);
    return Promise.resolve();
  }

  on(): Promise<void> {
    this.log.info('on');
    return Promise.resolve();
  }

  off(): Promise<void> {
    this.log.info('off');
    return Promise.resolve();
  }

  getStatus(): Promise<SonyBluray.Status> {
    return Promise.resolve({});
  }

  start(): Promise<void> {
    this.log.info('start');
    return Promise.resolve();
  }
}