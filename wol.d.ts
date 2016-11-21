declare module "wol" {
  namespace Wol {
    export function wake(mac: string, callback: (err?: Error)=>void): void
  }

  export = Wol;
}