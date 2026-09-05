declare module '@godaddy/terminus' {
  import type { Server } from 'http';

  export class HealthCheckError extends Error {
    causes: any;
    constructor(message: string, causes?: any);
  }

  export interface TerminusOptions {
    healthChecks?: Record<string, (state?: any) => Promise<any>>;
    statusOk?: number;
    statusError?: number;
    timeout?: number;
    signal?: string;
    signals?: string[];
    onSignal?: () => Promise<any>;
    onShutdown?: () => Promise<any>;
    beforeShutdown?: () => Promise<any>;
    logger?: (msg: string, err?: any) => void;
    caseSensitive?: boolean;
    verbatim?: boolean;
    useExit0?: boolean;
  }

  export function createTerminus(server: Server, options?: TerminusOptions): Server;
  export default createTerminus;
}
