const CONFIG = {
    // ユーザー設定エリア: ここに表示したいMarkdownのURLを書いてください
    // 例: 'https://raw.githubusercontent.com/kaiser-chix/trpg-memo/main/session_logs/session01.md'
    DEFAULT_URL: 'session_sample.md',

    // 自動更新の間隔（ミリ秒）: 30000 = 30秒
    POLL_INTERVAL: 30000,
};

let currentHash = '';
let isTocOpen = false;

const els = {
    content: document.getElementById('markdown-content'),
    status: document.getElementById('update-status'),
    lastUpdated: document.getElementById('last-updated'),
    tocToggle: document.getElementById('toc-toggle'),
    tocOverlay: document.getElementById('toc-overlay'),
    tocClose: document.getElementById('toc-close'),
    tocList: document.getElementById('toc-list')
};

// --- Core Logic ---

function getTargetUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('src') || CONFIG.DEFAULT_URL;
}

async function fetchContent() {
    const url = getTargetUrl();
    els.status.textContent = 'Refreshing...';

    try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();

        if (text !== currentHash) {
            renderForUser(text);
            currentHash = text;
            els.status.textContent = 'Updated';

            // Flash effect
            document.body.style.opacity = '0.9';
            setTimeout(() => document.body.style.opacity = '1', 200);

            generateTOC(); // Re-generate TOC on content update
        } else {
            els.status.textContent = 'No changes';
        }
    } catch (error) {
        console.error('Fetch error:', error);
        els.status.textContent = 'Error: ' + error.message;
        if (!currentHash) {
            els.content.innerHTML = `<div class="loading" style="color:#ff6b6b">
                Failed to load content.<br>
                Check the URL: ${url}<br>
                ${error.message}
            </div>`;
        }
    } finally {
        updateTime();
    }
}

function renderForUser(markdown) {
    const wasAtBottom = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50;
    const currentScrollY = window.scrollY;

    // Configure marked to include IDs for headers if not default
    // Marked guarantees ids by default on headers, so we can link to them.
    const html = DOMPurify.sanitize(marked.parse(markdown));
    els.content.innerHTML = html;

    if (wasAtBottom) {
        window.scrollTo(0, document.body.scrollHeight);
    } else {
        window.scrollTo(0, currentScrollY);
    }
}

// --- TOC Logic ---

function generateTOC() {
    els.tocList.innerHTML = '';
    const headers = els.content.querySelectorAll('h1, h2, h3');

    if (headers.length === 0) {
        els.tocList.innerHTML = '<div style="padding:10px; color:#8b949e">No headers found.</div>';
        return;
    }

    headers.forEach((header, index) => {
        // Ensure header has an ID
        if (!header.id) {
            header.id = `header-${index}`;
        }

        const link = document.createElement('a');
        link.href = `#${header.id}`;
        link.textContent = header.textContent;
        link.className = header.tagName.toLowerCase(); // h1, h2, h3 class

        link.addEventListener('click', (e) => {
            e.preventDefault();
            toggleTOC(false); // Close menu
            header.scrollIntoView({ behavior: 'smooth' });
        });

        els.tocList.appendChild(link);
    });
}

function toggleTOC(show) {
    isTocOpen = typeof show === 'boolean' ? show : !isTocOpen;
    if (isTocOpen) {
        els.tocOverlay.classList.remove('hidden');
    } else {
        els.tocOverlay.classList.add('hidden');
    }
}

// --- Event Listeners ---

els.tocToggle.addEventListener('click', () => toggleTOC(true));
els.tocClose.addEventListener('click', () => toggleTOC(false));
els.tocOverlay.addEventListener('click', (e) => {
    if (e.target === els.tocOverlay) toggleTOC(false);
});

// Settings Modal specific logic (Simplified for this version)
const urlInput = document.getElementById('url-input');
const saveSettingsBtn = document.getElementById('save-settings');
const settingsModal = document.getElementById('settings-modal');

// Double click status bar to open debug/settings
document.querySelector('.status-bar').addEventListener('dblclick', () => {
    urlInput.value = getTargetUrl();
    settingsModal.classList.remove('hidden');
});

saveSettingsBtn.addEventListener('click', () => {
    const newUrl = urlInput.value;
    if (newUrl) {
        const urlObj = new URL(window.location.href);
        urlObj.searchParams.set('src', newUrl);
        window.history.pushState({}, '', urlObj);
        fetchContent();
        settingsModal.classList.add('hidden');
    }
});


function updateTime() {
    const now = new Date();
    els.lastUpdated.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// --- Init ---
fetchContent();
setInterval(fetchContent, CONFIG.POLL_INTERVAL);

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") fetchContent();
});
