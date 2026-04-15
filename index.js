import * as R from 'ramda';
import * as readline from 'readline';
import * as fs from 'fs';

const loadCorpus = (filePath) =>
    fs
        .readFileSync(filePath, 'utf-8')
        .split('\n')
        .map(R.trim)
        .filter(R.complement(R.isEmpty));

const tokenize = R.pipe(R.toLower, R.trim, R.split(' '), R.reject(R.isEmpty));

const toBigrams = (words) => R.aperture(2, words);

const extractBigrams = R.pipe(R.map(tokenize), R.chain(toBigrams));

const addOccurrence = (table, [word, next]) =>
    R.over(
        R.lensPath([word, next]),
        R.pipe(R.defaultTo(0), R.add(1)),
        table,
    );

const buildTransitionTable = R.reduce(addOccurrence, {});

const toFrequencies = (counts) => {
  const total = R.pipe(R.values, R.sum)(counts);
  return R.map(R.divide(R.__, total), counts);
};

const buildProbabilityTable = R.map(toFrequencies);

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

const formatProbability = R.pipe(
    R.multiply(100),
    (n) => n.toFixed(1),
    R.concat(R.__, '%'),
);

const formatPrediction = R.applySpec({
  suggestion: R.prop('word'),
  confidence: R.pipe(R.prop('probability'), formatProbability),
});

const formatPredictions = R.map(formatPrediction);

//Interface interactive

const displayPredictions = (word, predictions) => {
  if (predictions.length === 0) {
    console.log(`\n❌ Mot "${word}" inconnu du corpus.\n`);
    return;
  }
  console.log(`\nAprès "${word}", les mots les plus probables sont:`);
  predictions.forEach(({ suggestion, confidence }, i) => {
    console.log(`   ${i + 1}. ${suggestion.padEnd(20)} ${confidence}`);
  });
  console.log('');
};

const startInteractiveMode = (model, stats) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n📖 Modèle de Markov');
  console.log('Tape un mot pour voir les prédictions. (ctrl+c pour quitter)\n');

  const ask = () => {
    rl.question('> ', (input) => {
      const word = R.pipe(R.toLower, R.trim)(input);
      const predictions = R.pipe(predictTopN(5, model), formatPredictions)(word);
      displayPredictions(word, predictions);
      ask();
    });
  };

  ask();
};

const buildStats = R.curry((corpus, bigrams) =>
    R.applySpec({
      sentences: R.always(corpus.length),
      vocabulary: R.always(R.pipe(R.map(tokenize), R.flatten, R.uniq, R.length)(corpus)),
      bigrams: R.always(bigrams.length),
    })({}),
);

const buildModel = R.pipe(extractBigrams, buildTransitionTable, buildProbabilityTable);

const corpus = loadCorpus('./Texte.txt');
const bigrams = extractBigrams(corpus);
const model = R.pipe(buildTransitionTable, buildProbabilityTable)(bigrams);
const stats = buildStats(corpus)(bigrams);

startInteractiveMode(model, stats);