import type {CardId} from './engine.ts';

export type HandStack = {card: CardId; count: number};

/** Group copies for display without changing the authoritative hand or its order. */
export function groupHandStacks(hand: readonly CardId[]): HandStack[] {
 const stacks = new Map<CardId, HandStack>();
 for (const card of hand) {
  const stack = stacks.get(card);
  if (stack) stack.count++;
  else stacks.set(card, {card, count: 1});
 }
 return [...stacks.values()];
}
