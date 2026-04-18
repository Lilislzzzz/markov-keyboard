/**
 * MarkovChain.js
 * Modèle de Markov d'ordre N pour la prédiction et la complétion de texte.
 * Utilise Ramda pour une approche fonctionnelle : fonctions courtes, composables et sans effets de bord.
 */

import * as R from 'ramda';

// ─────────────────────────────────────────────
// TOKENISATION
// ─────────────────────────────────────────────

const normaliseQuotes = R.pipe(
  (s) => s.replace(/[""«»]/g, '"'),
  (s) => s.replace(/['']/g, "'"),
);

const stripBoundaryPunct = (word) =>
  word.replace(/^[^a-zA-ZÀ-ÿ']+|[^a-zA-ZÀ-ÿ']+$/g, '');

const isNonEmpty = (s) => s.length > 0;

/** Découpe un texte brut en tokens nettoyés. */
const tokenise = R.pipe(
  normaliseQuotes,
  R.split(/\s+/),
  R.map(stripBoundaryPunct),
  R.filter(isNonEmpty),
);

// ─────────────────────────────────────────────
// CONSTRUCTION DES N-GRAMMES
// ─────────────────────────────────────────────

const buildContextKey = R.pipe(R.map(R.toLower), R.join(' '));

const ordersUpTo = (maxOrder, index) =>
  R.range(1, Math.min(maxOrder, index + 1) + 1);

const contextKeyAt = (tokens, index, order) =>
  buildContextKey(tokens.slice(index - order + 1, index + 1));

const nextWordAt = (tokens, index) => R.toLower(tokens[index + 1]);

/** Incrémente la fréquence d'un mot dans une map mutable. */
const incrementFreq = (freqMap, word) => {
  freqMap.set(word, (freqMap.get(word) ?? 0) + 1);
  return freqMap;
};

/** Enregistre une transition (contexte → mot suivant) dans la table. */
const recordTransition = (transitions, tokens, index, order) => {
  const key = contextKeyAt(tokens, index, order);
  const next = nextWordAt(tokens, index);
  if (!transitions.has(key)) transitions.set(key, new Map());
  incrementFreq(transitions.get(key), next);
};

/** Construit toutes les transitions n-grammes depuis un tableau de tokens. */
const buildTransitions = (maxOrder, transitions, tokens) => {
  for (let i = 0; i < tokens.length - 1; i++) {
    for (const order of ordersUpTo(maxOrder, i)) {
      recordTransition(transitions, tokens, i, order);
    }
  }
  return transitions;
};

// ─────────────────────────────────────────────
// SCORING ET CLASSEMENT
// ─────────────────────────────────────────────

const sumValues = (map) =>
  R.reduce((acc, v) => acc + v, 0, [...map.values()]);

const toWeightedCandidate = (total) => ([word, count]) => ({
  word,
  probability: count / total,
});

/** Trie les entrées d'une freqMap par probabilité décroissante et prend les N premiers. */
const rankByProbability = (freqMap, topN) => {
  const total = sumValues(freqMap);
  return R.pipe(
    (m) => [...m.entries()],
    R.map(toWeightedCandidate(total)),
    R.sort(R.descend(R.prop('probability'))),
    R.take(topN),
  )(freqMap);
};

const startsWithPrefix = (prefix) => (word) => word.startsWith(prefix);
const isNotPrefix     = (prefix) => (word) => word !== prefix;
const matchesPrefix   = (prefix) => R.both(startsWithPrefix(prefix), isNotPrefix(prefix));

// ─────────────────────────────────────────────
// FRÉQUENCES GLOBALES (UNIGRAMMES)
// ─────────────────────────────────────────────

const isUnigram = ([key]) => !key.includes(' ');

const accumulateFreq = (freq, [, nextMap]) => {
  nextMap.forEach((count, word) => {
    freq.set(word, (freq.get(word) ?? 0) + count);
  });
  return freq;
};

/** Extrait les fréquences globales depuis les transitions unigrammes. */
const globalFrequencies = (transitions) =>
  [...transitions.entries()]
    .filter(isUnigram)
    .reduce(accumulateFreq, new Map());

// ─────────────────────────────────────────────
// SCORING CONTEXTUEL (COMPLÉTION)
// ─────────────────────────────────────────────

/** Calcule les scores contextuels pour les candidats commençant par le préfixe. */
const contextScores = (transitions, contextWords, prefix, maxOrder) => {
  const scores = new Map();
  const orders = R.range(1, Math.min(maxOrder, contextWords.length) + 1).reverse();

  for (const order of orders) {
    const key = buildContextKey(contextWords.slice(-order));
    const nextMap = transitions.get(key);
    if (!nextMap) continue;
    nextMap.forEach((count, word) => {
      if (matchesPrefix(prefix)(word)) {
        scores.set(word, (scores.get(word) ?? 0) + count * order);
      }
    });
  }
  return scores;
};

const scoreCandidate = (ctxScores, globalFreq) => (word) => ({
  word,
  score: (ctxScores.get(word) ?? 0) * 3 + (globalFreq.get(word) ?? 0),
});

const byScoreDesc  = R.descend(R.prop('score'));
const thenAlpha    = (a, b) => a.word.localeCompare(b.word);
const rankByScore  = R.sortWith([byScoreDesc, thenAlpha]);

// ─────────────────────────────────────────────
// BACK-OFF : contexte du plus long au plus court
// ─────────────────────────────────────────────

/** Cherche une freqMap en réduisant progressivement la fenêtre de contexte. */
const backOff = (transitions, contextWords, maxOrder) => {
  const orders = R.range(1, Math.min(maxOrder, contextWords.length) + 1).reverse();
  for (const order of orders) {
    const key = buildContextKey(contextWords.slice(-order));
    if (transitions.has(key)) return transitions.get(key);
  }
  return null;
};

// ─────────────────────────────────────────────
// GÉNÉRATION PROBABILISTE
// ─────────────────────────────────────────────

const totalWeight = R.reduce((acc, c) => acc + (c.probability ?? c.score ?? 1), 0);

/** Échantillonne un candidat proportionnellement à son poids. */
const sampleWeighted = (candidates) => {
  const total = totalWeight(candidates);
  let rand = Math.random() * total;
  for (const c of candidates) {
    rand -= c.probability ?? c.score ?? 1;
    if (rand <= 0) return c.word;
  }
  return candidates[0].word;
};

// ─────────────────────────────────────────────
// SÉRIALISATION
// ─────────────────────────────────────────────

const serialiseTransitions = (transitions) => {
  const obj = {};
  transitions.forEach((nextMap, key) => {
    obj[key] = Object.fromEntries(nextMap);
  });
  return obj;
};

const deserialiseTransitions = (obj) =>
  new Map(
    Object.entries(obj).map(([key, nextObj]) => [
      key,
      new Map(Object.entries(nextObj)),
    ]),
  );

// ─────────────────────────────────────────────
// CLASSE PRINCIPALE
// ─────────────────────────────────────────────

export class MarkovChain {
  /** @param {number} order - Nombre de mots de contexte pris en compte */
  constructor(order = 2) {
    this.order = order;
    this.transitions = new Map();
    this.vocabulary  = new Set();
    this.totalTokens = 0;
  }

  /** Entraîne le modèle sur un corpus texte. */
  train(text) {
    const tokens = tokenise(text);
    this.totalTokens += tokens.length;
    tokens.forEach((w) => this.vocabulary.add(R.toLower(w)));
    buildTransitions(this.order, this.transitions, tokens);
  }

  /** Entraîne sur plusieurs textes. */
  trainMultiple(texts) {
    R.forEach((t) => this.train(t), texts);
  }

  /**
   * Prédit les N mots les plus probables après un contexte.
   * Utilise une stratégie de back-off (contexte long → court).
   * @param {string[]} contextWords
   * @param {number}   topN
   * @returns {{ word: string, probability: number }[]}
   */
  predictNextWord(contextWords, topN = 3) {
    const freqMap = backOff(this.transitions, contextWords, this.order);
    return freqMap ? rankByProbability(freqMap, topN) : [];
  }

  /**
   * Propose des complétions pour un préfixe partiel.
   * Combine score contextuel et fréquence globale.
   * @param {string}   prefix
   * @param {string[]} contextWords
   * @param {number}   topN
   * @returns {{ word: string, score: number }[]}
   */
  completeWord(prefix, contextWords = [], topN = 3) {
    if (!prefix) return [];

    const lowerPrefix = R.toLower(prefix);
    const candidates  = R.filter(matchesPrefix(lowerPrefix), [...this.vocabulary]);
    if (R.isEmpty(candidates)) return [];

    const ctxScores  = contextScores(this.transitions, contextWords, lowerPrefix, this.order);
    const globalFreq = globalFrequencies(this.transitions);
    const scorer     = scoreCandidate(ctxScores, globalFreq);

    return R.pipe(R.map(scorer), rankByScore, R.take(topN))(candidates);
  }

  /**
   * Génère une séquence de mots par échantillonnage probabiliste.
   * @param {string[]} seed
   * @param {number}   length
   * @returns {string}
   */
  generate(seed = [], length = 10) {
    const result = [...seed];
    for (let i = 0; i < length; i++) {
      const predictions = this.predictNextWord(result, 5);
      if (R.isEmpty(predictions)) break;
      result.push(sampleWeighted(predictions));
    }
    return result.join(' ');
  }

  /** @returns {string} JSON sérialisé du modèle */
  toJSON() {
    return JSON.stringify({
      order:       this.order,
      transitions: serialiseTransitions(this.transitions),
      vocabulary:  [...this.vocabulary],
      totalTokens: this.totalTokens,
    });
  }

  /** @param {string} json @returns {MarkovChain} */
  static fromJSON(json) {
    const data  = JSON.parse(json);
    const chain = new MarkovChain(data.order);
    chain.totalTokens = data.totalTokens;
    chain.vocabulary  = new Set(data.vocabulary);
    chain.transitions = deserialiseTransitions(data.transitions);
    return chain;
  }

  getStats() {
    return {
      vocabularySize: this.vocabulary.size,
      ngramCount:     this.transitions.size,
      totalTokens:    this.totalTokens,
      order:          this.order,
    };
  }
}
