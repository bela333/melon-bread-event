import settings from "../settings.js";

const ordinalPlural = new Intl.PluralRules("en", { type: "ordinal" });

function formatOrdinal(num: number){
	let numStr = num.toLocaleString("en");
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
	return numStr;
}

export function formatPair(num: number) {
	return `${formatOrdinal(num-1)} and ${formatOrdinal(num)} ${pluralCurrency(num)}`
}

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
	return settings.interactions.embedFooter[cardinalPlural.select(num)]
		.replace(/\{num\}/g, formatCurrency(num))
		.replace(/\{num2\}/g, formatCurrency(4558-num));
}