# GitHub Stats Server

Ce projet met en place un serveur Express qui interagit avec l'API GitHub pour récupérer des informations sur le nombre de lignes de code écrites dans différents langages de programmation dans les dépôts GitHub d'un utilisateur. Les données sont mises en cache pour optimiser les performances et réduire le nombre de requêtes vers l'API.

## Prérequis

Pour exécuter ce projet, vous aurez besoin de :

- Node.js (version 12 ou ultérieure)
- Un compte GitHub avec un jeton d'accès personnel (PAT)

## Installation

1. Clonez ce dépôt :

   ```bash
   git clone https://github.com/NikXpro/github_stats.git
   ```

2. Accédez au répertoire du projet :

   ```bash
   cd github_stats
   ```

3. Installez les dépendances :

   ```bash
   npm install
   ```

4. Créez un fichier `.env` et définissez les variables d'environnement suivantes :
   ```env
   GITHUB_USERNAME=your_github_username
   GITHUB_TOKEN=your_github_token
   PORT=3000  # Optionnel, par défaut 3000
   ```

## Utilisation

Pour lancer le serveur :

```bash
npm start
```

Le serveur sera disponible à l'adresse http://localhost:3000.

## Endpoints

`GET /languages/:username`

Cet endpoint renvoie le nombre total de lignes de code écrites dans différents langages de programmation pour un utilisateur GitHub donné.

#### Exemple :

```bash
curl http://localhost:3000/languages/github_username
```

#### Réponse :

```json
{
  "JavaScript": 12345,
  "Python": 6789,
  "Java": 1011
}
```

`GET /languages/:username/:repoName`

Cet endpoint renvoie le nombre total de lignes de code écrites dans différents langages de programmation pour un dépôt GitHub spécifique d'un utilisateur donné.

#### Exemple :

```bash
curl http://localhost:3000/languages/github_username/repository_name
```

#### Réponse :

```json
{
  "JavaScript": 12345,
  "Python": 6789,
  "Java": 1011
}
```

## Gestion du Cache

Le cache est stocké dans un fichier cache.json et est chargé au démarrage du serveur. Lorsqu'une requête est traitée, le cache est mis à jour si nécessaire.

## Gestion de la Blacklist

Le fichier blacklist.json permet de spécifier des dépôts ou des chemins à ignorer lors du comptage des lignes de code. Le format attendu est le suivant :

```json
{
  "repos": ["repo_to_ignore"],
  "paths": ["path_to_ignore/file_to_ignore"],
  "languages": ["language_to_ignore"]
}
```

## Remerciements

Ce projet utilise le service [CodeTabs](https://codetabs.com/count-loc/count-loc-online.html) pour compter les lignes de code dans les dépôts GitHub. Assurez-vous de respecter les termes d'utilisation de ce service lors de son intégration dans vos projets.

## Contribuer

Les contributions sont les bienvenues ! Veuillez soumettre une pull request ou ouvrir une issue pour discuter des changements que vous souhaitez apporter.

## Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.
