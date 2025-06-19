let currentTab = 'dictionary';
let isOfflineMode = false;

// Initialize IndexedDB
const dbName = 'dictionaryDB';
const dbVersion = 1;
let db;

const initDB = () => {
  const request = indexedDB.open(dbName, dbVersion);
  
  request.onerror = (event) => {
    console.error('IndexedDB error:', event.target.error);
  };

  request.onsuccess = (event) => {
    db = event.target.result;
  };

  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('words')) {
      db.createObjectStore('words', { keyPath: 'word' });
    }
  };
};

// Initialize IndexedDB when the page loads
initDB();

// Oxford Dictionary API configuration
// Remove Oxford Dictionary API as it requires paid credentials
const displayWordData = (data) => {
  const resultBox = document.getElementById('resultBox');
  let html = `<h2>${data.word}</h2>`;

  if (data.phonetics && data.phonetics.length > 0) {
    const phonetic = data.phonetics.find(p => p.text) || data.phonetics[0];
    html += `
      <div class="pronunciation-box">
        <p><strong>Pronunciation:</strong></p>
        ${phonetic.text ? `<p class="phonetic-text">${phonetic.text}</p>` : ''}
        ${phonetic.audio ? `<div class="audio-box"><audio controls src="${phonetic.audio}"></audio></div>` : ''}
      </div>
    `;
  }

  if (data.meanings) {
    data.meanings.forEach(m => {
      html += `
        <div class="meaning-box">
          <h4 class="part-of-speech">${m.partOfSpeech}</h4>
          ${m.definitions.map(d => `
            <div class="definition-item">
              <p><strong>Definition:</strong> ${d.definition}</p>
              ${d.example ? `<p class="example"><em>Example:</em> "${d.example}"</p>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    });
  }

  html += `<button class="bookmark-btn" onclick="bookmarkWord('${data.word}')">⭐ Bookmark</button>`;
  resultBox.innerHTML = html;
};

function storeWordData(wordData) {
  const transaction = db.transaction(['words'], 'readwrite');
  const store = transaction.objectStore('words');
  store.put(wordData);
}

function toggleOfflineMode() {
  isOfflineMode = !isOfflineMode;
  const statusButton = document.getElementById('offlineModeStatus');
  statusButton.textContent = isOfflineMode ? '🔌 Offline' : '🌐 Online';
  statusButton.classList.toggle('offline', isOfflineMode);
  localStorage.setItem('offlineMode', isOfflineMode);
  loadOfflineMode();
}

function loadOfflineMode() {
  isOfflineMode = localStorage.getItem('offlineMode') === 'true';
  document.getElementById('offlineModeStatus').textContent = isOfflineMode ? '🔌 Offline' : '🌐 Online';
}

function switchTab(tab) {
  try {
    if (!tab) return;
    const tabs = ['dictionary', 'synonyms', 'favorites', 'history'];
    if (!tabs.includes(tab)) return;
    
    const allTabs = document.querySelectorAll('.tab');
    allTabs.forEach(t => {
      if (t.classList.contains('active')) {
        t.style.opacity = '0';
        t.style.transform = 'translateY(20px)';
        setTimeout(() => t.classList.remove('active'), 400);
      }
    });

    const targetTab = document.getElementById(tab + 'Tab');
    if (targetTab) {
      setTimeout(() => {
        targetTab.classList.add('active');
        requestAnimationFrame(() => {
          targetTab.style.opacity = '1';
          targetTab.style.transform = 'translateY(0)';
        });
      }, 400);
      currentTab = tab;
    }
  } catch (error) {
    console.error('Error switching tabs:', error);
  }
}

function toggleTheme() {
  const body = document.body;
  body.style.transition = 'all 0.5s ease-in-out';
  body.classList.toggle('dark');
  const isDark = body.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  document.getElementById('themeToggle').checked = isDark;

  // Animate all elements that change with theme
  document.querySelectorAll('.tab, .word-item, #resultBox, #synonymsBox, #favoritesList, #historyList')
    .forEach(el => el.style.transition = 'all 0.5s ease-in-out');
}

function loadTheme() {
  const theme = localStorage.getItem('theme');
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark', isDark);
  document.getElementById('themeToggle').checked = isDark;
}

// Call loadTheme when the page loads
document.addEventListener('DOMContentLoaded', loadTheme);

async function searchWord() {
  const word = document.getElementById('wordInput').value.trim().toLowerCase();
  if (!word) return;

  const resultBox = document.getElementById('resultBox');
  resultBox.innerHTML = '<p>Loading...</p>';

  // Check IndexedDB for offline data first
  if (isOfflineMode) {
    const transaction = db.transaction(['words'], 'readonly');
    const store = transaction.objectStore('words');
    const request = store.get(word);

    request.onsuccess = (event) => {
      const data = event.target.result;
      if (data) {
        displayWordData(data);
        return;
      } else {
        resultBox.innerHTML = '<p>Word not found in offline storage.</p>';
      }
    };

    request.onerror = () => {
      resultBox.innerHTML = '<p>Error accessing offline storage.</p>';
    };
    return;
  }

  // Online mode: Fetch from Dictionary API
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    const data = await response.json();

    if (data.title === "No Definitions Found") {
      resultBox.innerHTML = '<p>No definition found.</p>';
      return;
    }

    const wordData = data[0];
    displayWordData(wordData);
    storeWordData(wordData); // Store for offline use
    saveToHistory(word);
  } catch (error) {
    resultBox.innerHTML = '<p>Error fetching word data.</p>';
    console.error('Error:', error);
  }
}

function saveToHistory(word) {
  let history = JSON.parse(localStorage.getItem('history')) || [];
  if (!history.includes(word)) {
    history.unshift(word);
    localStorage.setItem('history', JSON.stringify(history));
    renderHistory();
  }
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('history')) || [];
  const list = history.map(w => `<div onclick="searchWordFromHistory('${w}')">${w}</div>`).join('');
  document.getElementById('historyList').innerHTML = list;
}

function searchWordFromHistory(word) {
  document.getElementById('wordInput').value = word;
  searchWord();
}

function bookmarkWord(word) {
  let favs = JSON.parse(localStorage.getItem('favorites')) || [];
  if (!favs.includes(word)) {
    favs.push(word);
    localStorage.setItem('favorites', JSON.stringify(favs));
    renderFavorites();
  }
}

function renderFavorites() {
  let favs = JSON.parse(localStorage.getItem('favorites')) || [];
  document.getElementById('favoritesList').innerHTML = favs.map(f => `<div>${f}</div>`).join('');
}

function exportHistory() {
  let history = JSON.parse(localStorage.getItem('history')) || [];
  let content = history.join('\n');
  let blob = new Blob([content], { type: 'text/plain' });
  let link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'search_history.txt';
  link.click();
}

function startVoiceSearch() {
  try {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    // Add vibration feedback for mobile devices
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    recognition.onstart = function() {
      document.querySelector('.mic-icon').style.color = '#ff8800';
    };

    recognition.onend = function() {
      document.querySelector('.mic-icon').style.color = '';
    };

    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      document.getElementById('wordInput').value = transcript;
      searchWord();
    };

    recognition.onerror = function(event) {
      console.error('Speech recognition error:', event.error);
      document.querySelector('.mic-icon').style.color = '';
    };

    recognition.start();
  } catch (error) {
    console.error('Speech recognition not supported:', error);
    alert('Speech recognition is not supported in your browser.');
  }
}

loadTheme();
renderHistory();
renderFavorites();


function searchSynonyms() {
  const word = document.getElementById('synonymInput').value.trim().toLowerCase();
  if (!word) return;
  const output = document.getElementById('synonymsBox');
  output.innerHTML = '<p>Loading...</p>';

  // Fetch from multiple APIs for comprehensive synonyms/antonyms
  Promise.all([
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`),
    fetch(`https://api.datamuse.com/words?rel=syn&qe=${word}`),
    fetch(`https://api.datamuse.com/words?rel=ant&qe=${word}`)
  ])
    .then(responses => Promise.all(responses.map(res => res.json())))
    .then(([dictData, synonymsData, antonymsData]) => {
      let synonyms = [];
      let antonyms = [];

      // Collect synonyms/antonyms from Dictionary API
      if (!dictData.title) {
        synonyms = dictData[0].meanings.flatMap(m => m.definitions.flatMap(d => d.synonyms || []));
        antonyms = dictData[0].meanings.flatMap(m => m.definitions.flatMap(d => d.antonyms || []));
      }

      // Add synonyms/antonyms from Datamuse
      synonyms = [...new Set([...synonyms, ...synonymsData.map(s => s.word)])];
      antonyms = [...new Set([...antonyms, ...antonymsData.map(a => a.word)])];

      if (synonyms.length === 0 && antonyms.length === 0) {
        output.innerHTML = '<p>No synonyms or antonyms found.</p>';
        return;
      }

      let html = `
        <div class="thesaurus-results">
          ${synonyms.length > 0 ? `
            <div class="synonyms-section">
              <h3>Synonyms</h3>
              <div class="word-grid">
                ${synonyms.map(s => `<div class="word-item" onclick="searchWordFromSynonyms('${s}')">${s}</div>`).join('')}
              </div>
            </div>
          ` : ''}
          ${antonyms.length > 0 ? `
            <div class="antonyms-section">
              <h3>Antonyms</h3>
              <div class="word-grid">
                ${antonyms.map(a => `<div class="word-item" onclick="searchWordFromSynonyms('${a}')">${a}</div>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
      output.innerHTML = html;
    })
    .catch(() => {
      output.innerHTML = '<p>Error fetching synonyms and antonyms.</p>';
    });
}

function searchWordFromSynonyms(word) {
  document.getElementById('synonymInput').value = word;
  searchSynonyms();
}

// Clicking favorite word shows detail in dictionary
function showFromFavorites(word) {
  switchTab('dictionary');
  document.getElementById('wordInput').value = word;
  searchWord();
}

function renderFavorites() {
  let favs = JSON.parse(localStorage.getItem('favorites')) || [];
  document.getElementById('favoritesList').innerHTML = favs.map(f =>
    `<div onclick="showFromFavorites('${f}')">${f}</div>`
  ).join('');
}

// Load saved theme toggle
function loadTheme() {
  const theme = localStorage.getItem('theme');
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark', isDark);
  document.getElementById('themeToggle').checked = isDark;
}
