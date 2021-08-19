import settings from "../settings.js";

const ordinalPlural = new Intl.PluralRules("en", { type: "ordinal" });

export function formatCurrency(num: number, ordinal: boolean = false) {
	let numStr = num.toLocaleString("en");

	if (ordinal) {
		switch (ordinalPlural.select(num)) {
			case "one":
				numStr += "st";
				break;

			case "two":
				numStr += "nd";
				break;

			case "few":
				numStr += "rd";
				break;

			case "other":
				numStr += "th";
				break;
		}
	}

	return numStr + " " + pluralCurrency(num);
}

const cardinalPlural = new Intl.PluralRules("en");

export function pluralCurrency(num: number) {
	return settings.interactions.currency[cardinalPlural.select(num)];
}

export function pluralFooter(num: number) {
	return settings.interactions.embedFooter[cardinalPlural.select(num)].replace(/\{num\}/g, formatCurrency(num));
}