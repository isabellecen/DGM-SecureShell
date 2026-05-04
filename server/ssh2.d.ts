declare module "ssh2" {
  export interface ConnectConfig {
    host: string;
    port?: number;
    username?: string;
    password?: string;
    readyTimeout?: number;
    tryKeyboard?: boolean;
    hostHash?: string;
    hostVerifier?: (hashedKey: string) => boolean;
  }

  export interface ClientChannel {
    on(event: "close", listener: () => void): this;
    on(event: "data", listener: (data: Buffer) => void): this;
    stderr: {
      on(event: "data", listener: (data: Buffer) => void): void;
    };
  }

  export class Client {
    on(event: "ready", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    connect(config: ConnectConfig): this;
    exec(command: string, callback: (err: Error | undefined, stream: ClientChannel) => void): void;
    end(): void;
  }
}
