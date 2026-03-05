class FuzzySearch {
    constructor(options = {}) {
        this.keys = options.keys || [{name: 'title', weight: 1}];
    }

    search(items, query, usageBoostFn) {
        if (!query || query.trim() === '') return [];

        const lowerQuery = query.toLowerCase();
        const scored = [];

        for (const item of items) {
            let totalScore = 0;

            for (const key of this.keys) {
                const fieldValue = item[key.name];
                if (!fieldValue) continue;
                const fieldScore = this._scoreField(String(fieldValue).toLowerCase(), lowerQuery);
                totalScore += fieldScore * key.weight;
            }

            if (usageBoostFn) {
                totalScore += usageBoostFn(item);
            }

            if (totalScore > 0) {
                scored.push({item, score: totalScore});
            }
        }

        scored.sort((a, b) => b.score - a.score);
        return scored;
    }

    _scoreField(fieldValue, query) {
        if (fieldValue === query) return 100;
        if (fieldValue.startsWith(query)) return 75;
        if (fieldValue.indexOf(query) > -1) return 50;
        return this._fuzzyMatch(fieldValue, query);
    }

    _fuzzyMatch(text, query) {
        let qi = 0;
        let ti = 0;
        let contiguous = 0;
        let maxContiguous = 0;
        let matched = 0;

        while (qi < query.length && ti < text.length) {
            if (text[ti] === query[qi]) {
                matched++;
                contiguous++;
                if (contiguous > maxContiguous) maxContiguous = contiguous;
                qi++;
            } else {
                contiguous = 0;
            }
            ti++;
        }

        if (qi < query.length) return 0;

        const matchRatio = matched / query.length;
        const contiguousRatio = maxContiguous / query.length;
        const lengthPenalty = query.length / text.length;

        return Math.round((contiguousRatio * 25 + matchRatio * 10 + lengthPenalty * 5));
    }
}

export default FuzzySearch;
