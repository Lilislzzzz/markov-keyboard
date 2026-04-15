import * as R from 'ramda';

// ─── Corpus ──────────────────────────────────────────────────────────────────

const corpus = [
  'le chat mange la souris',
  'le chat dort sur le canapé',
  'la souris court dans le jardin',
  'le chien court après le chat',
  'le chien dort dans le jardin',
  'la souris mange du fromage',
  'le fromage est sur la table',
  'le chat regarde la table',
];

// ─── Tokenisation ─────────────────────────────────────────────────────────────

const tokenize = R.pipe(R.toLower, R.trim, R.split(' '), R.reject(R.isEmpty));

const tokenizeAll = R.pipe(R.map(tokenize), R.flatten);

// ─── Construction des bigrammes ───────────────────────────────────────────────
// Un bigramme est une paire [mot, mot_suivant]

const toBigrams = (words) =>
  R.aperture(2, words);

const extractBigrams = R.pipe(R.map(tokenize), R.chain(toBigrams));

// ─── Construction de la table de transitions ─────────────────────────────────
// { mot: { mot_suivant: occurrences } }

const incrementOrOne = R.defaultTo(0);

const addOccurrence = (table, [word, next]) =>
  R.over(
    R.lensPath([word, next]),
    R.pipe(incrementOrOne, R.add(1)),
    table,
  );

const buildTransitionTable = R.reduce(addOccurrence, {});

// ─── Calcul des probabilités ──────────────────────────────────────────────────

const toFrequencies = (counts) => {
  const total = R.pipe(R.values, R.sum)(counts);
  return R.map(R.divide(R.__, total), counts);
};

const buildProbabilityTable = R.map(toFrequencies);

// ─── Prédiction ───────────────────────────────────────────────────────────────

const sortByProbability = R.pipe(
  R.toPairs,
  R.sortWith([R.descend(R.last)]),
);

const predictNextWords = R.curry((probabilityTable, word) =>
  R.pipe(
    R.prop(word),
    R.defaultTo({}),
    sortByProbability,
    R.map(R.applySpec({ word: R.head, probability: R.last })),
  )(probabilityTable),
);

const predictTopN = R.curry((n, probabilityTable, word) =>
  R.pipe(predictNextWords(probabilityTable), R.take(n))(word),
);

// ─── Formatage de l'affichage ────────────────────────────────────────────────

const formatProbability = R.pipe(R.multiply(100), (n) => n.toFixed(1), R.concat(R.__, '%'));

const formatPrediction = R.applySpec({
  suggestion: R.prop('word'),
  confidence: R.pipe(R.prop('probability'), formatProbability),
});

const formatPredictions = R.map(formatPrediction);

// ─── Statistiques du corpus ───────────────────────────────────────────────────

const countVocabulary = R.pipe(tokenizeAll, R.uniq, R.length);

const countBigrams = R.pipe(extractBigrams, R.length);

const buildCorpusStats = R.applySpec({
  sentences: R.length,
  vocabulary: countVocabulary,
  bigrams: countBigrams,
});

// ─── Pipeline principal ───────────────────────────────────────────────────────

const buildModel = R.pipe(extractBigrams, buildTransitionTable, buildProbabilityTable);

const runPrediction = R.curry((model, word) =>
  R.applySpec({
    input: R.always(word),
    predictions: R.always(R.pipe(predictTopN(3, model), formatPredictions)(word)),
  })(),
);

const runDemo = (corpus) => {
  const model = buildModel(corpus);
  const stats = buildCorpusStats(corpus);

  const testWords = ['le', 'la', 'chat', 'souris', 'chien'];

  return R.applySpec({
    stats: R.always(stats),
    predictions: R.always(R.map(runPrediction(model), testWords)),
  })();
};

console.log(JSON.stringify(runDemo(corpus), null, 2));
