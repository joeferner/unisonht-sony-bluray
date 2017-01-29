import {UnisonHT, UnisonHTDevice} from "unisonht";
import * as xpath from "xpath";
import * as wol from "wol";
import * as http from "http";
import * as xmldom from "xmldom";
import * as getmac from "getmac";
import * as inquirer from "inquirer";
import createLogger from "unisonht/lib/Log";

const log = createLogger('sonyBluray');

export default class SonyBluray implements UnisonHTDevice {
  private options: SonyBluray.Options;
  private commandList;
  private authCode: string;
  private macAddress: string;

  constructor(options: SonyBluray.Options) {
    this.options = options;
    this.options.irccPort = this.options.irccPort || 50001;
    this.options.port = this.options.port || 50002;
    this.options.deviceIdPrefix = this.options.deviceIdPrefix || 'UnisonHT';
    this.options.deviceName = this.options.deviceName || 'UnisonHT';
    this.commandList = {};
  }

  start(unisonht: UnisonHT): Promise<void> {
    return this.getMacAddress()
      .then((macAddress)=> {
        this.macAddress = macAddress;
      });
  }

  getName(): string {
    return this.options.name;
  }

  buttonPress(button: string): Promise<void> {
    button = SonyBluray.toSonyButton(button);
    const commandValue = this.translateButton(button);
    if (!commandValue) {
      return Promise.reject(new Error(`Could not find mapping for button ${button}/${commandValue}`));
    }
    const irccXml = SonyBluray.createIRCCXML(commandValue);

    return new Promise<void>((resolve, reject)=> {
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
      const req = http.request(options, (res)=> {
        res.setEncoding('utf8');
        res.on('end', () => {
          resolve();
        });
        res.on('error', (err)=> {
          reject(`problem with response: ${err.message}`);
        });
      });
      req.on('error', (err) => {
        reject(`problem with request: ${err.message}`);
      });
      log.debug(`sending ircc code ${button}/${commandValue}`);
      req.write(irccXml);
      req.end();
    });
  }

  ensureOn(): Promise<void> {
    return this.ensureOnRepeat(60);
  }

  ensureOff(): Promise<void> {
    // TODO
    return Promise.resolve();
  }

  private ensureOnRepeat(retryCount: number): Promise<void> {
    return new Promise<void>((resolve, reject)=> {
      return this.sendWakeOnLan()
        .then(()=> {
          return this.getStatus();
        })
        .then(()=> {
          return this.getRemoteCommandList();
        })
        .then((commandList)=> {
          this.commandList = commandList;
        })
        .then(()=> {
          resolve();
        })
        .catch((err)=> {
          log.debug(`could not connect (retry: ${retryCount})`);
          if (retryCount == 0) {
            return reject(err);
          }
          setTimeout(()=> {
            this.ensureOnRepeat(retryCount--);
          }, 1000);
        })
    });
  }

  private sendWakeOnLan(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      wol.wake(this.options.mac, (err) => {
        if (err) {
          log.error('send wol failed: ', err);
          return reject(err);
        }
        resolve();
      });
    });
  }

  private getStatus(): Promise<SonyBluray.Status> {
    return this.getPage('/getStatus');
  }

  private getRemoteCommandList(): Promise<{command: string}> {
    return this.getPage('/getRemoteCommandList')
      .then((xml)=> {
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
    return new Promise((resolve, reject)=> {
      var responseData = '';
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
      const req = http.request(options, (res)=> {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode == 403 && retryOnFailure) {
            return this.tryRegistrationRenewal()
              .then(()=> {
                return this.getPage(url);
              });
          }
          if (res.statusCode != 200) {
            var error = new Error(`invalid response code: ${res.statusCode}`);
            (<any>error).statusCode = res.statusCode;
            return reject(error);
          }
          try {
            var xml = new xmldom.DOMParser().parseFromString(responseData);
            resolve(xml);
          } catch (err) {
            log.error(`invalid xml ${responseData}`);
            reject(err);
          }
        });
        res.on('error', (err)=> {
          log.error('res error', err);
        });
      });
      req.on('error', (err) => {
        log.error('req error', err);
        reject(`problem with request: ${err.message}`);
      });
      log.debug(`sending ${url}`);
      req.end();
    });
  }

  private getDeviceId(): string {
    return `${this.options.deviceIdPrefix}:${this.macAddress}`;
  }

  private getMacAddress(): Promise<string> {
    return new Promise((resolve, reject)=> {
      getmac.getMac((err, macAddress)=> {
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
      .catch((err)=> {
        if (err.statusCode && err.statusCode == 403) {
          return this.tryRegistrationInitial()
        }
        throw err;
      })
      .then(()=>{});
  }

  private tryRegistrationInitial(): Promise<void> {
    return this.getPage(this.getRegistrationUrl('initial'), false)
      .catch((err)=> {
        if (err.statusCode && err.statusCode == 401) {
          return this.getRegistrationCodeFromUser()
            .then((code)=> {
              this.authCode = code;
              return this.tryRegistrationInitial();
            });
        }
        throw err;
      })
      .then(()=>{});
  }

  private getRegistrationUrl(type: string): string {
    const deviceName = encodeURIComponent(this.options.deviceName);
    const deviceId = encodeURIComponent(this.getDeviceId());
    return `/register?name=${deviceName}&registrationType=${type}&deviceId=${deviceId}&wolSupport=true`;
  }

  private getRegistrationCodeFromUser(): Promise<string> {
    return new Promise((resolve, reject)=> {
      return inquirer.prompt([{
        type: 'input',
        name: 'code',
        message: 'Authorization code'
      }])
        .then((data)=> {
          return resolve(data['code']);
        })
        .catch((err)=> {
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

  private translateButton(button: string): string {
    return this.commandList[button.toUpperCase()];
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

module SonyBluray {
  export interface Options {
    name: string;
    address: string;
    mac: string;
    irccPort?: number;
    port?: number;
    deviceIdPrefix?: string;
    deviceName?: string;
  }

  export interface Status {

  }
}