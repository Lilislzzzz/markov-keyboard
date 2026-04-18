/**
 * Predictor.js
 * Façade haut niveau : charge le corpus, expose getSuggestions() et learnFromInput().
 * Utilise Ramda pour les transformations de données.
 */

import * as R from 'ramda';
import { MarkovChain } from './MarkovChain.js';

const DATASET_FILES = [
  '/dataset/comptesse_de_segur.txt',
  '/dataset/Freida_McFadden_-_La_femme_de_m_233_nage_T1_2023.txt',
  '/dataset/Hunger-Games-2.txt',
  '/dataset/HUNGER_GAMES_TOME_1.txt',
  '/dataset/Le_tour_du_monde_en_80 jours.txt',
  '/dataset/Texte.txt',
  '/dataset/discussion_quotidienne.txt',
  '/dataset/actu.txt',
];

const STORAGE_KEY    = 'markov_model_v2';
const LEARN_INTERVAL = 10;
const MIN_TEXT_LEN   = 3;

// ─────────────────────────────────────────────
// CHARGEMENT DES FICHIERS
// ─────────────────────────────────────────────

const fetchText = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};

const filenameOf = (path) => path.split('/').pop();

/** Charge un fichier et entraîne la chaîne, en signalant la progression. */
const loadAndTrain = async (chain, path, onProgress, done, total) => {
  try {
    const text = await fetchText(path);
    chain.train(text);
  } catch (err) {
    console.warn(`Impossible de charger ${path} :`, err);
  } finally {
    onProgress?.(done, total, filenameOf(path));
  }
};

/** Charge tous les fichiers du corpus séquentiellement. */
const loadCorpus = async (chain, files, onProgress) => {
  const total = files.length;
  for (const [i, path] of files.entries()) {
    await loadAndTrain(chain, path, onProgress, i + 1, total);
  }
};

// ─────────────────────────────────────────────
// PERSISTANCE (localStorage)
// ─────────────────────────────────────────────

const readFromStorage = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
};

const writeToStorage = (json) => {
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    console.warn('Impossible de sauvegarder le modèle :', e);
  }
};

const clearStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* silencieux */
  }
};

// ─────────────────────────────────────────────
// ANALYSE DU TEXTE SAISI
// ─────────────────────────────────────────────

const splitWords    = R.pipe(R.trim, R.split(/\s+/), R.filter(Boolean));
const endsWithSpace = (text) => text.endsWith(' ');
const lastWord      = R.last;
const allButLast    = R.init;

const analyseSaisie = (inputText) => {
  const words = splitWords(inputText.trimStart());
  return {
    words,
    isCompletingWord: !endsWithSpace(inputText) && words.length > 0,
    currentWord:      lastWord(words) ?? '',
    contextWords:     endsWithSpace(inputText) ? words : allButLast(words),
  };
};

const emptySuggestions = { type: 'prediction', suggestions: [] };

// ─────────────────────────────────────────────
// CLASSE PRINCIPALE
// ─────────────────────────────────────────────

export class Predictor {
  /** @param {{ order?: number, language?: string }} options */
  constructor({ order = 2, language = 'fr' } = {}) {
    this.chain           = new MarkovChain(order);
    this.language        = language;
    this._trained        = false;
    this._sessionTokens  = 0;
  }

  /**
   * Initialise le modèle : lecture du cache ou entraînement depuis le corpus.
   * @param {Function} [onProgress] - Callback (done, total, filename)
   * @returns {Promise<object>} Statistiques du modèle
   */
  async initialize(onProgress) {
    if (this._restoreFromCache()) return this.chain.getStats();

    await loadCorpus(this.chain, DATASET_FILES, onProgress);
    this._trained = true;
    writeToStorage(this.chain.toJSON());
    return this.chain.getStats();
  }

  /**
   * Retourne 3 suggestions (complétion ou prédiction) pour le texte en cours.
   * @param {string} inputText
   * @param {number} [topN=3]
   * @returns {{ type: string, suggestions: object[], prefix?: string }}
   */
  getSuggestions(inputText, topN = 3) {
    if (!this._trained) return emptySuggestions;

    const { words, isCompletingWord, currentWord, contextWords } =
      analyseSaisie(inputText);

    if (R.isEmpty(words)) return emptySuggestions;

    if (isCompletingWord) {
      const suggestions = this.chain.completeWord(currentWord, contextWords, topN);
      return { type: 'completion', suggestions, prefix: currentWord };
    }

    const suggestions = this.chain.predictNextWord(contextWords, topN);
    return { type: 'prediction', suggestions };
  }

  /**
   * Apprend depuis une saisie utilisateur et sauvegarde périodiquement.
   * @param {string} text
   */
  learnFromInput(text) {
    if (text.trim().length < MIN_TEXT_LEN) return;
    this.chain.train(text);
    this._sessionTokens += 1;
    if (this._sessionTokens % LEARN_INTERVAL === 0) {
      writeToStorage(this.chain.toJSON());
    }
  }

  /** Sauvegarde le modèle courant dans le localStorage. */
  saveToStorage() {
    writeToStorage(this.chain.toJSON());
  }

  /** Remet le modèle à zéro (mémoire + cache). */
  reset() {
    this.chain          = new MarkovChain(this.chain.order);
    this._trained       = false;
    this._sessionTokens = 0;
    clearStorage();
  }

  getStats() {
    return {
      ...this.chain.getStats(),
      sessionContributions: this._sessionTokens,
    };
  }

  // ── Privé ──────────────────────────────────

  _restoreFromCache() {
    const saved = readFromStorage();
    if (!saved) return false;
    try {
      this.chain   = MarkovChain.fromJSON(saved);
      this._trained = true;
      return true;
    } catch {
      return false;
    }
  }
}
