import {SonyBluray} from "./index";

export interface SonyBlurayClient {
  buttonPress(buttonName: any): Promise<void>;
  on(): Promise<void>;
  off(): Promise<void>;
  getStatus(): Promise<SonyBluray.Status>;
  start(): Promise<void>;
}