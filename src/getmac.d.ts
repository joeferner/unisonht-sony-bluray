declare module 'getmac' {
    namespace Getmac {
        export function getMac(callback: (err: Error, macAddress?: string) => void): void;
    }

    export = Getmac;
}
