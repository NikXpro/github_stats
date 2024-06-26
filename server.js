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
};

// Load cache from file on startup
if (fs.existsSync(CACHE_FILE)) {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE));
} else {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
}

// Load blacklist from file on startup
if (fs.existsSync(BLACKLIST_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(BLACKLIST_FILE));
    if (Array.isArray(data.repos) && Array.isArray(data.paths)) {
      blacklist = data;
    } else {
      console.error("Blacklist data is not in the correct format");
    }
  } catch (err) {
    console.error("Error reading blacklist file", err);
  }
}

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
 * Count the lines of code across all repositories of a given GitHub user
 * @param {string} username - The GitHub username
 * @returns {Promise<Object>} - An object that maps languages to their total lines of code
 */
async function countLinesOfCode(username) {
  try {
    const repos = await getRepositories(username);
    const languageCounts = {};

    for (const repo of repos) {
      if (blacklist.repos.includes(repo.name)) {
        continue;
      }

      const repoName = repo.full_name;
      const latestCommit = repo.pushed_at;

      // Use cache if the data is up-to-date
      if (cache[repoName] && cache[repoName].latestCommit === latestCommit) {
        const languages = cache[repoName].languages;
        for (const [language, lines] of Object.entries(languages)) {
          if (!languageCounts[language]) {
            languageCounts[language] = 0;
          }
          languageCounts[language] += lines;
        }
        continue;
      }

      const ignoredPaths = blacklist.paths.join(",");
      const url = `https://api.codetabs.com/v1/loc?github=${repoName}&ignored=${ignoredPaths}`;
      const response = await axios.get(url);

      const languages = {};
      response.data.forEach((languageData) => {
        const language = languageData.language;
        const lines = languageData.linesOfCode;

        languages[language] = (languages[language] || 0) + lines;

        if (!languageCounts[language]) {
          languageCounts[language] = 0;
        }
        languageCounts[language] += lines;
      });

      // Update cache
      cache[repoName] = { latestCommit, languages };
      await saveCacheToFile();
    }

    return languageCounts;
  } catch (error) {
    console.error("Error counting lines of code:", error.message);
    throw error;
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
 * Start the server on the specified port
 */
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
