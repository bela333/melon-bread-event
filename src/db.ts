import level from "level";
import { z } from "zod";
import { nextReset } from "./utils/resets.js";

export const db: level.LevelDB<string, User> = level("users", {
	valueEncoding: "json"
});

const User = z.object({
	points: z.number(),
	resetAt: z.number(),
	received: z.array(z.string())
});

export type User = z.infer<typeof User>;

export const users: Map<string, User> = new Map();
export let totalBaked: number = 0;

export function updateTotal() {
	totalBaked = 0;

	for (const [id, user] of users) {
		totalBaked += user.points;
	}
}

function loadDatabase() {
	return new Promise((resolve, reject) => {
		totalBaked = 0;

		db.createReadStream()
			.on("data", ({ key, value }) => {
				const user = User.parse(value);
				const id = z.string().parse(key);

				totalBaked += user.points;
				users.set(id, user);
			})
			.on("error", reject)
			.on("end", resolve);
	});
}

export const dbLoaded = db.open().then(loadDatabase);

export async function saveUser(...ids: string[]) {
	ids = ids.filter(id => users.has(id));

	for (const id of ids) {
		if (!users.has(id)) {
			throw new Error(`User ${id} not found.`);
		}
	}

	updateTotal();

	if (ids.length > 1) {
		const batch = db.batch();

		for (const id of ids) {
			batch.put(id, users.get(id)!);
		}

		return batch.write();
	}

	return db.put(ids[0], users.get(ids[0])!);
}

export function getAccount(id: string) {
	if (!users.has(id)) {
		users.set(id, {
			points: 0,
			received: [],
			resetAt: nextReset().toMillis(),
		});
	}

	const user = users.get(id)!;

	if (user.resetAt <= Date.now()) {
		user.resetAt = nextReset().toMillis();
		user.received = [];
	}
	return user;
}
