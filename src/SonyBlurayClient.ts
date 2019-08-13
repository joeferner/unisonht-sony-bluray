import { SonyBlurayStatus } from './SonyBlurayStatus';
import { SonyBlurayButton } from './SonyBlurayButton';

export interface SonyBlurayClient {
  buttonPress(buttonName: SonyBlurayButton): Promise<void>;

  on(): Promise<void>;

  off(): Promise<void>;

  getStatus(): Promise<SonyBlurayStatus>;

  start(): Promise<void>;
}
