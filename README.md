# ⌨️ Clavier Prédictif : Modèle de Markov
**Projet réalisé par :** Camille Barré • Lilou Slezack • Hugo Letassey

---

## 🚀 Présentation du Projet
Ce projet consiste en la création d'un **clavier virtuel intelligent** capable de prédire les mots suivants en temps réel. Inspiré de l'interface **iOS (Apple)**, il propose une barre de suggestions affichant les **3 mots les plus probables** en fonction de la saisie actuelle.

### Fonctionnement de la prédiction :
L'algorithme analyse trois facteurs clés pour suggérer un mot :
1. **Le contexte :** Analyse des 1 ou 2 mots précédents .
2. **La saisie en cours :** Filtrage des probabilités selon les premières lettres tapées.
3. **La fréquence :** Utilisation d'un dictionnaire statistique pour sortir les résultats les plus fréquents.

---

## 🧠 Le Modèle : Chaînes de Markov
Nous utilisons une **Chaîne de Markov**, un modèle probabiliste où la prédiction d'un événement dépend de l'état précédent. 

Dans ce projet :
* **Niveau 1 :** Si vous tapez un mot, le modèle cherche le mot suivant le plus fréquent.
* **Niveau 2 :** Si vous avez déjà tapé deux mots, le modèle affine sa recherche (contexte de 2 mots).
* **Top 3 :** Au lieu de ne proposer qu'un seul résultat, nous trions les probabilités pour extraire les 3 meilleures correspondances, offrant ainsi une expérience utilisateur fluide.



---

## 🛠️ Stack Technique
Pour répondre aux exigences de qualité et de performance, nous avons utilisé :
* **Langage :** JavaScript
* **Programmation Fonctionnelle :** [Ramda.js](https://ramdajs.com/) pour la manipulation des données.
* **Qualité de code :** [BiomeJS](https://biomejs.dev/) pour le linting et le formatage.
* **Interface :** HTML/CSS (Design inspiré d'Apple) et Electron (si applicable). A VOIR

---

## ▶️ Installation et Lancement

1. **Installer les dépendances :**
   ```bash
   npm install
