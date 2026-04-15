# markov-keyboard

Modèle de Markov appliqué aux textes pour la prédiction de saisie au clavier, implémenté en JavaScript fonctionnel avec [Ramda](https://ramdajs.com/).

## Principe

Un **modèle de Markov de premier ordre** prédit le prochain mot à partir du mot courant uniquement. À partir d'un corpus de phrases, on construit une **table de transitions** : pour chaque mot, on recense les mots qui le suivent et leur fréquence. Ces fréquences sont ensuite converties en probabilités.

Exemple :

```
"le" → { "chat": 0.4, "chien": 0.3, "jardin": 0.2, "fromage": 0.1 }
```

Quand l'utilisateur tape "le", le modèle suggère "chat" en premier (40% de probabilité).

## Structure

```
markov-keyboard/
├── index.js        # Modèle Markov + pipeline de prédiction
├── .editorconfig
├── .gitignore
├── biome.json          # Linter / formatter
├── package.json
├── README.md
└── Texte.txt
```

## Installation

```bash
npm install
```

## Utilisation

```bash
npm start
```

Exemple de sortie :

```json
{
  "stats": {
    "sentences": 8,
    "vocabulary": 14,
    "bigrams": 40
  },
  "predictions": [
    {
      "input": "le",
      "predictions": [
        { "suggestion": "chat", "confidence": "40.0%" },
        { "suggestion": "chien", "confidence": "30.0%" },
        { "suggestion": "jardin", "confidence": "10.0%" }
      ]
    }
  ]
}
```

## Concepts Ramda utilisés

| Fonction | Usage |
|---|---|
| `R.pipe` | Composition de fonctions gauche → droite |
| `R.map` | Transformation de collections |
| `R.reduce` | Accumulation (construction de la table) |
| `R.applySpec` | Création d'objets structurés |
| `R.converge` | Appliquer plusieurs fonctions puis combiner |
| `R.curry` | Curryfication pour application partielle |
| `R.aperture` | Extraction de bigrammes |
| `R.chain` | flatMap sur les phrases |
| `R.lensPath` + `R.over` | Mise à jour immuable d'objets imbriqués |
| `R.sortWith` + `R.descend` | Tri par probabilité décroissante |
| `R.defaultTo` | Valeurs par défaut sûres |

## Qualité du code

```bash
npm run check     # lint + format en une commande
npm run lint      # lint seul
npm run format    # format seul
```
