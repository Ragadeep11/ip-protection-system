// frontend/src/plagiarism/textPlagiarism.js

function preprocess(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function termFrequency(text) {
    const words = text.split(" ");
    const freq = {};

    for (const w of words) {
        freq[w] = (freq[w] || 0) + 1;
    }

    return freq;
}

function cosineSimilarity(tfA, tfB) {
    const allWords = new Set([
        ...Object.keys(tfA),
        ...Object.keys(tfB),
    ]);

    let dot = 0, magA = 0, magB = 0;

    for (const w of allWords) {
        const a = tfA[w] || 0;
        const b = tfB[w] || 0;

        dot += a * b;
        magA += a * a;
        magB += b * b;
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

export function checkTextPlagiarism(newText, corpus) {
    const processedNew = preprocess(newText);
    const tfNew = termFrequency(processedNew);

    let maxSimilarity = 0;

    for (const oldText of corpus) {
        const tfOld = termFrequency(preprocess(oldText));
        const sim = cosineSimilarity(tfNew, tfOld);
        maxSimilarity = Math.max(maxSimilarity, sim);
    }

    return maxSimilarity; // 0 → 1
}
