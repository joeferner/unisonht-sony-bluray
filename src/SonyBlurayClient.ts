import { SonyBlurayStatus } from './SonyBlurayStatus';

export interface SonyBlurayClient {
  buttonPress(buttonName: any): Promise<void>;

  on(): Promise<void>;

  off(): Promise<void>;

  getStatus(): Promise<SonyBlurayStatus>;

  start(): Promise<void>;
}
