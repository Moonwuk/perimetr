import type {Env} from '../cloudflare/worker';
// The shared routes import this stable object through the cloudflare:workers alias.
// It is configured once before the HTTP socket starts accepting requests.
export const env = {} as Env;
export function configureRuntime(value: Env): void { Object.assign(env, value); }
