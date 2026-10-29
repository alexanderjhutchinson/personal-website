import { ITEMS, type ItemId } from "./items";

export interface Slot {
  item: ItemId;
  count: number;
}

export const HOTBAR_SIZE = 10;

export class Inventory {
  readonly slots: (Slot | null)[] = Array.from({ length: HOTBAR_SIZE }, () => null);
  selected = 0;
  onChange: () => void = () => {};

  get current() {
    return this.slots[this.selected];
  }

  put(index: number, item: ItemId, count: number) {
    this.slots[index] = { item, count };
    this.onChange();
  }

  /** Add to an existing stack or the first empty slot. Returns false when there's no room. */
  add(item: ItemId, count = 1) {
    if (ITEMS[item].stackable) {
      const stack = this.slots.find((s) => s?.item === item);
      if (stack) {
        stack.count += count;
        this.onChange();
        return true;
      }
    }
    const empty = this.slots.findIndex((s) => s === null);
    if (empty === -1) return false;
    this.slots[empty] = { item, count };
    this.onChange();
    return true;
  }

  consume(index: number, count = 1) {
    const slot = this.slots[index];
    if (!slot) return;
    slot.count -= count;
    if (slot.count <= 0) this.slots[index] = null;
    this.onChange();
  }

  select(index: number) {
    const next = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    if (next === this.selected) return;
    this.selected = next;
    this.onChange();
  }
}
