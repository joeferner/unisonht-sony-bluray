import {SonyBlurayClient} from "./SonyBlurayClient";
import * as http from "http";
import * as wol from "wol";
import * as xpath from "xpath";
import * as xmldom from "xmldom";
import * as getmac from "getmac";
import * as inquirer from "inquirer";
import {SonyBluray} from "./index";
import * as Logger from "bunyan";
import {createLogger} from "../unisonht/lib/Log";

export class SonyBlurayClientImpl implements SonyBlurayClient {
  private commandList;
  private authCode: string;
  private macAddress: string;
  private options: SonyBlurayClientImpl.Options;
  private log: Logger;

  constructor(options: SonyBlurayClientImpl.Options) {
    this.log = createLogger('MockSonyBlurayClient');
    this.options = options;
    this.commandList = {};
  }

  start(): Promise<void> {
    return this.getMacAddress()
      .then((macAddress) => {
        this.macAddress = macAddress;
      });
  }

  buttonPress(buttonName: any): Promise<void> {
    const button = SonyBlurayClientImpl.toSonyButton(buttonName);
    const commandValue = this.translateButton(button);
    if (!commandValue) {
      return Promise.reject(new Error(`Could not find mapping for button ${button}/${commandValue}`));
    }
    const irccXml = SonyBlurayClientImpl.createIRCCXML(commandValue);

    return new Promise<void>((resolve, reject) => {
      const options = {
        hostname: this.options.address,
        port: this.options.irccPort,
        path: '/upnp/control/IRCC',
        method: 'POST',
        headers: {
          'Connection': 'close',
          'X-CERS-DEVICE-ID': this.getDeviceId(),
          'X-CERS-DEVICE-INFO': 'Android4.4.2/TVSideViewForAndroid2.5.1/SM-G900V',
          'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.4.2; SM-G900V Build/KOT49H)',
          'content-type': 'text/xml; charset=utf-8',
          'soapaction': '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"',
          'Content-Length': irccXml.length
        }
      };
      const req = http.request(options, (res) => {
        res.setEncoding('utf8');
        res.on('end', () => {
          resolve();
        });
        res.on('error', (err) => {
          reject(`problem with response: ${err.message}`);
        });
      });
      req.on('error', (err) => {
        reject(`problem with request: ${err.message}`);
      });
      this.log.debug(`sending ircc code ${button}/${commandValue}`);
      req.write(irccXml);
      req.end();
    });
  }

  on(): Promise<void> {
    return this.ensureOnRepeat(60);
  }

  off(): Promise<void> {
    // TODO handle off
    return Promise.resolve();
  }

  getStatus(): Promise<SonyBluray.Status> {
    return this.getPage('/getStatus');
  }

  private ensureOnRepeat(retryCount: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      return this.sendWakeOnLan()
        .then(() => {
          return this.getStatus();
        })
        .then(() => {
          return this.getRemoteCommandList();
        })
        .then((commandList) => {
          this.commandList = commandList;
        })
        .then(() => {
          resolve();
        })
        .catch((err) => {
          this.log.debug(`could not connect (retry: ${retryCount})`);
          if (retryCount == 0) {
            return reject(err);
          }
          setTimeout(() => {
            this.ensureOnRepeat(retryCount--);
          }, 1000);
        })
    });
  }

  private sendWakeOnLan(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      wol.wake(this.options.mac, (err) => {
        if (err) {
          this.log.error('send wol failed: ', err);
          return reject(err);
        }
        resolve();
      });
    });
  }

  private getRemoteCommandList(): Promise<{command: string}> {
    return this.getPage('/getRemoteCommandList')
      .then((xml) => {
        const commandList = {};
        const commands = xpath.select(`//command`, xml);
        for (let i = 0; i < commands.length; i++) {
          const command = commands[i];
          const name = command.getAttribute('name');
          const value = command.getAttribute('value');
          if (name && value) {
            commandList[name.toUpperCase()] = value;
          }
        }
        return commandList;
      });
  }

  private getPage(url: string, retryOnFailure: boolean = true): Promise<Document> {
    return new Promise((resolve, reject) => {
      let responseData = '';
      const headers = {
        'Connection': 'close',
        'X-CERS-DEVICE-ID': this.getDeviceId(),
        'X-CERS-DEVICE-INFO': 'Android4.4.2/TVSideViewForAndroid2.5.1/SM-G900V',
        'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.4.2; SM-G900V Build/KOT49H)'
      };
      if (this.authCode) {
        const pass = new Buffer(`:${this.authCode}`).toString('base64');
        headers['Authorization'] = `Basic ${pass}`;
      }
      const options = {
        hostname: this.options.address,
        port: this.options.port,
        path: url,
        method: 'GET',
        headers: headers
      };
      const req = http.request(options, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode == 403 && retryOnFailure) {
            return this.tryRegistrationRenewal()
              .then(() => {
                return this.getPage(url);
              });
          }
          if (res.statusCode != 200) {
            const error = new Error(`invalid response code: ${res.statusCode}`);
            (<any>error).statusCode = res.statusCode;
            return reject(error);
          }
          try {
            const xml = new xmldom.DOMParser().parseFromString(responseData);
            resolve(xml);
          } catch (err) {
            this.log.error(`invalid xml ${responseData}`);
            reject(err);
          }
        });
        res.on('error', (err) => {
          this.log.error('res error', err);
        });
      });
      req.on('error', (err) => {
        this.log.error('req error', err);
        reject(`problem with request: ${err.message}`);
      });
      this.log.debug(`sending ${url}`);
      req.end();
    });
  }

  private getDeviceId(): string {
    return `${this.options.deviceIdPrefix}:${this.macAddress}`;
  }

  private translateButton(button: string): string {
    return this.commandList[button.toUpperCase()];
  }

  private getMacAddress(): Promise<string> {
    return new Promise((resolve, reject) => {
      getmac.getMac((err, macAddress) => {
        if (err) {
          return reject(err);
        }
        macAddress = macAddress.replace(/:/g, '-');
        resolve(macAddress);
      });
    });
  }

  private tryRegistrationRenewal(): Promise<void> {
    return this.getPage(this.getRegistrationUrl('renewal'), false)
      .catch((err) => {
        if (err.statusCode && err.statusCode == 403) {
          return this.tryRegistrationInitial()
        }
        throw err;
      })
      .then(() => {
      });
  }

  private tryRegistrationInitial(): Promise<void> {
    return this.getPage(this.getRegistrationUrl('initial'), false)
      .catch((err) => {
        if (err.statusCode && err.statusCode == 401) {
          return this.getRegistrationCodeFromUser()
            .then((code) => {
              this.authCode = code;
              return this.tryRegistrationInitial();
            });
        }
        throw err;
      })
      .then(() => {
      });
  }

  private getRegistrationUrl(type: string): string {
    const deviceName = encodeURIComponent(this.options.deviceName);
    const deviceId = encodeURIComponent(this.getDeviceId());
    return `/register?name=${deviceName}&registrationType=${type}&deviceId=${deviceId}&wolSupport=true`;
  }

  private getRegistrationCodeFromUser(): Promise<string> {
    return new Promise((resolve, reject) => {
      return inquirer.prompt([{
        type: 'input',
        name: 'code',
        message: 'Authorization code'
      }])
        .then((data) => {
          return resolve(data['code']);
        })
        .catch((err) => {
          reject(err);
        })
    })
  }

  private static toSonyButton(button: string): string {
    switch (button.toUpperCase()) {
      case 'SELECT':
        return 'Confirm';
      case 'FASTFORWARD':
        return 'Forward';
      case 'SKIP':
        return 'Next';
      case 'REPLAY':
        return 'Prev';
    }
    return button;
  }

  private static createIRCCXML(commandValue: string) {
    return `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">
      <IRCCCode>${commandValue}</IRCCCode>
    </u:X_SendIRCC>
  </s:Body>
</s:Envelope>`;
  }
}

export module SonyBlurayClientImpl {
  export interface Options {
    address: string,
    mac: string,
    irccPort: number;
    port: number;
    deviceIdPrefix: string;
    deviceName: string;
  }
}