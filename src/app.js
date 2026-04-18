/**
 * app.js
 * Point d'entrée : relie le Predictor (Markov) à l'interface iPhone.
 */

import { Predictor } from './core/Predictor.js';
import { KeyboardUI } from './ui/KeyboardUI.js';

const BOT_REPLY_DELAY_MS = 800;
const BOT_REPLY_TEXT     = 'alors ça mérite un 20/20 ce clavier ? 😏';

async function main() {
  const predictor = new Predictor({ order: 2, language: 'fr' });
  const ui        = new KeyboardUI(document.getElementById('app'));

  ui.showLoading('Chargement du modèle Markov…');

  const stats = await predictor.initialize((done, total, filename) => {
    ui.setLoadingProgress(done, total, filename);
  });

  ui.hideLoading();
  ui.setStatus('ready', `Prêt · ${stats.vocabularySize.toLocaleString()} mots`);

  ui.onInput((inputText) => {
    const result = predictor.getSuggestions(inputText, 3);
    ui.showSuggestions(result);
  });

  ui.onSuggestionClick((suggestion) => {
    ui.insertSuggestion(suggestion);
  });

  ui.onSubmit((text) => {
    predictor.learnFromInput(text);
    ui.addMessage(text);
    ui.clearInput();
    setTimeout(() => ui.addReceivedMessage(BOT_REPLY_TEXT), BOT_REPLY_DELAY_MS);
  });
}

main().catch(console.error);
