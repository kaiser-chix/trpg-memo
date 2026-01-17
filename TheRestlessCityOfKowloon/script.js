const CONFIG = {
  // ユーザー設定エリア: ここに表示したいMarkdownのURLを書いてください
  // 例: 'https://raw.githubusercontent.com/kaiser-chix/trpg-memo/main/session_logs/session01.md'
  DEFAULT_URL: "memo.md",

  // 自動更新の間隔（ミリ秒）: 20000 = 20秒
  POLL_INTERVAL: 20000,
};

let currentHash = "";
let isTocOpen = false;

const els = {
  content: document.getElementById("markdown-content"),
  status: document.getElementById("update-status"),
  lastUpdated: document.getElementById("last-updated"),
  tocToggle: document.getElementById("toc-toggle"),
  tocOverlay: document.getElementById("toc-overlay"),
  tocClose: document.getElementById("toc-close"),
  tocList: document.getElementById("toc-list"),
};

// --- Core Logic ---

// --- Core Logic ---

function getTargetUrl() {
  // 1. URLパラメータ 'src' があればそれを優先 (後方互換性のため残す)
  const params = new URLSearchParams(window.location.search);
  if (params.get("src")) {
    return params.get("src");
  }

  // 2. なければ同じフォルダ(設定)のファイルを読み込む
  return CONFIG.DEFAULT_URL;
}

async function fetchContent() {
  const targetUrl = getTargetUrl();
  els.status.textContent = "Refreshing...";

  try {
    // Cache busting: Append timestamp
    // Handle both absolute URLs and relative paths
    const urlObj = new URL(targetUrl, document.baseURI);
    urlObj.searchParams.set("_t", Date.now());
    const fetchUrl = urlObj.toString();

    const response = await fetch(fetchUrl, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();

    if (text !== currentHash) {
      // シンプルに描画。
      // 同じフォルダにある index.html に読み込まれた場合、
      // 画像の相対パス "./img.png" は index.html から見た相対パスとして処理されるため、
      // 特殊な加工なしで正しく表示されるはずです。
      renderForUser(text);
      currentHash = text;
      els.status.textContent = "Updated";

      // Flash effect
      document.body.style.opacity = "0.9";
      setTimeout(() => (document.body.style.opacity = "1"), 200);

      generateTOC();
    } else {
      els.status.textContent = "No changes";
    }
  } catch (error) {
    console.error("Fetch error:", error);
    els.status.textContent = "Error: " + error.message;
    if (!currentHash) {
      els.content.innerHTML = `<div class="loading" style="color:#ff6b6b">
                Failed to load content.<br>
                Check configuration: ${targetUrl}<br>
                ${error.message}
            </div>`;
    }
  } finally {
    updateTime();
  }
}

function renderForUser(markdown) {
  const wasAtBottom =
    window.innerHeight + window.scrollY >= document.body.offsetHeight - 50;
  const currentScrollY = window.scrollY;

  // シンプルな設定: GitHub Flavored Markdown, 改行有効
  // 相対パスの書き換えロジックは削除 (ブラウザ標準の挙動に任せる)
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  const html = DOMPurify.sanitize(marked.parse(markdown));
  els.content.innerHTML = html;

  // --- Post-Processing ---

  // 1. Link Rewriting: Convert .md links to viewer links
  const links = els.content.querySelectorAll("a");
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href.endsWith(".md") && !href.match(/^(http|https):/)) {
      // It's a relative markdown link.
      // We want to reload the viewer with this file as the src.
      // Handle relative paths from the CURRENT target file
      link.onclick = (e) => {
        e.preventDefault();
        // If we are currently viewing "session1/log.md" and link is "next.md", we want "session1/next.md"
        // But getTargetUrl() returns the path.
        const currentTarget = getTargetUrl(); // e.g. "session1/log.md"

        // Simple relative resolution
        // If href starts with /, it's relative to root? No, let's just support simple sibling/subfolder
        let newTarget = href;
        if (currentTarget.includes("/")) {
          const dir = currentTarget.substring(
            0,
            currentTarget.lastIndexOf("/") + 1,
          );
          newTarget = dir + href;
        }

        // Update URL parameters
        const urlObj = new URL(window.location.href);
        urlObj.searchParams.set("src", newTarget);
        window.history.pushState({}, "", urlObj);

        // Force fetch
        fetchContent();
        window.scrollTo(0, 0); // Scroll to top
      };
    }
  });

  // 2. Image Lightbox
  const images = els.content.querySelectorAll("img");
  images.forEach((img) => {
    img.addEventListener("click", () => {
      openLightbox(img.src);
    });
  });

  if (wasAtBottom) {
    window.scrollTo(0, document.body.scrollHeight);
  } else {
    window.scrollTo(0, 200); // Slight offset to show change if not at bottom, or keep position?
    // Keeping position is better usually, but if content changed significantly, maybe top?
    // Let's keep original logic for now.
    window.scrollTo(0, currentScrollY);
  }
}

// --- Lightbox Logic ---
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxClose = document.querySelector(".lightbox-close");

function openLightbox(src) {
  lightbox.classList.add("visible"); // Use class for flex display
  lightbox.style.display = "flex"; // Ensure flex
  lightboxImg.src = src;
}

function closeLightbox() {
  lightbox.classList.remove("visible");
  lightbox.style.display = "none";
}

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) {
    closeLightbox();
  }
});

// --- TOC Logic ---

function generateTOC() {
  els.tocList.innerHTML = "";
  // ... (rest of the file match) ...
  const headers = els.content.querySelectorAll("h1, h2, h3");

  if (headers.length === 0) {
    els.tocList.innerHTML =
      '<div style="padding:10px; color:#8b949e">No headers found.</div>';
    return;
  }

  headers.forEach((header, index) => {
    // Ensure header has an ID
    if (!header.id) {
      header.id = `header-${index}`;
    }

    const link = document.createElement("a");
    link.href = `#${header.id}`;
    link.textContent = header.textContent;
    link.className = header.tagName.toLowerCase(); // h1, h2, h3 class

    link.addEventListener("click", (e) => {
      e.preventDefault();
      toggleTOC(false); // Close menu
      header.scrollIntoView({ behavior: "smooth" });
    });

    els.tocList.appendChild(link);
  });
}

function toggleTOC(show) {
  isTocOpen = typeof show === "boolean" ? show : !isTocOpen;
  if (isTocOpen) {
    els.tocOverlay.classList.remove("hidden");
  } else {
    els.tocOverlay.classList.add("hidden");
  }
}

// --- Event Listeners ---

els.tocToggle.addEventListener("click", () => toggleTOC(true));
els.tocClose.addEventListener("click", () => toggleTOC(false));
els.tocOverlay.addEventListener("click", (e) => {
  if (e.target === els.tocOverlay) toggleTOC(false);
});

// Settings Modal specific logic (Simplified for this version)
const urlInput = document.getElementById("url-input");
const saveSettingsBtn = document.getElementById("save-settings");
const settingsModal = document.getElementById("settings-modal");

// Double click status bar to open debug/settings
document.querySelector(".status-bar").addEventListener("dblclick", () => {
  urlInput.value = getTargetUrl();
  settingsModal.classList.remove("hidden");
});

saveSettingsBtn.addEventListener("click", () => {
  const newUrl = urlInput.value;
  if (newUrl) {
    const urlObj = new URL(window.location.href);
    urlObj.searchParams.set("src", newUrl);
    window.history.pushState({}, "", urlObj);
    fetchContent();
    settingsModal.classList.add("hidden");
  }
});

function updateTime() {
  const now = new Date();
  els.lastUpdated.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// --- Init ---
fetchContent();
setInterval(fetchContent, CONFIG.POLL_INTERVAL);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") fetchContent();
});
