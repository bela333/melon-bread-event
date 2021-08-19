export class TemporarySet<T> implements Set<T> {
	private items: Map<T, number> = new Map();
	readonly [Symbol.toStringTag] = "TemporarySet";

	constructor(public timeout: number) { }

	private prune() {
		for (const [item, time] of this.items.entries()) {
			if (Date.now() > time + this.timeout) {
				this.items.delete(item);
			}
		}
	}

	add(item: T): this {
		this.items.set(item, Date.now())
		return this;
	}

	clear() {
		this.items.clear();
	}

	delete(item: T): boolean {
		return this.items.delete(item);
	}

	has(item: T): boolean {
		this.prune();
		return this.items.has(item);
	}

	get size(): number {
		this.prune();
		return this.items.size;
	}

	*entries() {
		this.prune();

		for (const item of this.items.keys()) {
			yield [item, item] as [T, T];
		}
	}

	*keys() {
		this.prune();

		for (const item of this.items.keys()) {
			yield item;
		}
	}

	values() {
		return this.keys();
	}

	forEach(callback: (value: T, key: T, set: this) => void) {
		for (const item of this.items.keys()) {
			callback(item, item, this);
		}
	}

	[Symbol.iterator]() {
		return this.keys();
	}
}
