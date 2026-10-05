import recon from './assets/cards/recon.webp';
import entry from './assets/cards/entry.webp';
import pivot from './assets/cards/pivot.webp';
import escalate from './assets/cards/escalate.webp';
import operation from './assets/cards/operation.webp';
import shield from './assets/cards/shield.webp';
import patch from './assets/cards/patch.webp';
import sensor from './assets/cards/sensor.webp';
import backup from './assets/cards/backup.webp';
import stealth from './assets/cards/stealth.webp';
import supply from './assets/cards/supply.webp';
import purge from './assets/cards/purge.webp';
import phishing from './assets/cards/phishing.webp';
import fraud from './assets/cards/fraud.webp';
import segment from './assets/cards/segment.webp';
import expand from './assets/cards/expand.webp';
import optimize from './assets/cards/optimize.webp';
import ddos from './assets/cards/ddos.webp';
import type {CardId} from '@/lib/game/engine';

// Explicit imports let both Vite builds emit hashed, base-aware URLs (including Android).
export const cardArt: Record<CardId, string> = {
 recon, entry, pivot, escalate, operation, shield, patch, sensor, backup,
 stealth, supply, purge, phishing, fraud, segment, expand, optimize, ddos,
};
