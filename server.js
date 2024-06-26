require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

/**
 * Environment variables
 */
const USERNAME = process.env.GITHUB_USERNAME;
const TOKEN = process.env.GITHUB_TOKEN;
const PORT = process.env.PORT || 3000;

/**
 * File paths
 */
const CACHE_FILE = path.join(__dirname, "cache.json");
const BLACKLIST_FILE = path.join(__dirname, "blacklist.json");

/**
 * In-memory data structures
 */
let cache = {};
let blacklist = {
  repos: [],
  paths: [],
  languages: [],
};

/**
 * Load the cache or blacklist data from file
 * @param {string} filePath - The path to the file
 * @param {Object} defaultValue - The default value if file does not exist or is invalid
 * @returns {Object} - The loaded data or default value
 */
function loadDataFromFile(filePath, defaultValue) {
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath));
      if (data && typeof data === "object") {
        return data;
      }
    } catch (err) {
      console.error(`Error reading ${filePath}:`, err);
    }
  } else {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue));
  }
  return defaultValue;
}

cache = loadDataFromFile(CACHE_FILE, cache);
blacklist = loadDataFromFile(BLACKLIST_FILE, blacklist);

const app = express();
app.use(bodyParser.json());

/**
 * Save the cache to a file
 */
async function saveCacheToFile() {
  try {
    await fs.promises.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error("Error saving cache file:", err);
  }
}

/**
 * Get the GitHub rate limit status
 * @returns {Promise<Object>} - The rate limit status
 */
async function getRateLimit() {
  try {
    const url = "https://api.github.com/rate_limit";
    const response = await axios.get(url, {
      auth: {
        username: USERNAME,
        password: TOKEN,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching rate limit:", error.message);
    throw error;
  }
}

/**
 * Get the repositories for a given GitHub username
 * @param {string} username - The GitHub username
 * @returns {Promise<Array>} - List of repositories
 */
async function getRepositories(username) {
  try {
    const url = `https://api.github.com/users/${username}/repos?per_page=100`;
    const response = await axios.get(url, {
      auth: {
        username: USERNAME,
        password: TOKEN,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching repositories:", error.message);
    throw error;
  }
}

/**
 * Fetch and aggregate lines of code for a given repository
 * @param {Object} repo - The repository object
 * @returns {Promise<Object>} - An object that maps languages to their lines of code
 */
async function fetchLanguageCountsForRepo(repo) {
  const repoName = repo.full_name;
  const latestCommit = repo.pushed_at;

  // Use cache if the data is up-to-date
  if (cache[repoName] && cache[repoName].latestCommit === latestCommit) {
    return cache[repoName].languages;
  }

  const ignoredPaths = blacklist.paths.join(",");
  const url = `https://api.codetabs.com/v1/loc?github=${repoName}&ignored=${ignoredPaths}`;
  const response = await axios.get(url);

  const languages = {};
  response.data.forEach((languageData) => {
    const language = languageData.language;
    const lines = languageData.linesOfCode;

    // Ignore blacklisted languages
    if (!blacklist.languages.includes(language)) {
      languages[language] = (languages[language] || 0) + lines;
    }
  });

  // Update cache
  cache[repoName] = { latestCommit, languages };
  await saveCacheToFile();

  return languages;
}

/**
 * Aggregate lines of code across multiple repositories
 * @param {Array} repos - List of repository objects
 * @returns {Promise<Object>} - An object that maps languages to their total lines of code
 */
async function aggregateLanguageCounts(repos) {
  const languageCounts = {};

  for (const repo of repos) {
    if (!blacklist.repos.includes(repo.name)) {
      const repoLanguages = await fetchLanguageCountsForRepo(repo);
      for (const [language, lines] of Object.entries(repoLanguages)) {
        if (!languageCounts[language]) {
          languageCounts[language] = 0;
        }
        languageCounts[language] += lines;
      }
    }
  }

  return languageCounts;
}

/**
 * Count the lines of code across all repositories or a specific repository of a given GitHub user
 * @param {string} username - The GitHub username
 * @param {string} [repoName] - The optional GitHub repository name
 * @returns {Promise<Object>} - An object that maps languages to their total lines of code
 */
async function countLinesOfCode(username, repoName) {
  const repos = await getRepositories(username);

  if (repoName) {
    const repo = repos.find((r) => r.name === repoName);
    if (repo) {
      return fetchLanguageCountsForRepo(repo);
    } else {
      throw new Error(`Repository ${repoName} not found`);
    }
  } else {
    return aggregateLanguageCounts(repos);
  }
}

/**
 * Route to get the total lines of code in all repositories of a given user
 */
app.get("/languages/:username", async (req, res) => {
  try {
    const rateLimit = await getRateLimit();
    if (rateLimit.rate.remaining === 0) {
      return res
        .status(429)
        .json({ error: "Rate limit exceeded. Try again later." });
    }

    const username = req.params.username;
    const totalLines = await countLinesOfCode(username);
    res.json(totalLines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Route to get the total lines of code for a specific repository of a given user
 */
app.get("/languages/:username/:repoName", async (req, res) => {
  try {
    const rateLimit = await getRateLimit();
    if (rateLimit.rate.remaining === 0) {
      return res
        .status(429)
        .json({ error: "Rate limit exceeded. Try again later." });
    }

    const { username, repoName } = req.params;
    const totalLines = await countLinesOfCode(username, repoName);
    res.json(totalLines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Start the server on the specified port
 */
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
