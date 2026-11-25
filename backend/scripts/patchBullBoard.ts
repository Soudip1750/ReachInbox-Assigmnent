import fs from 'fs';
import path from 'path';

export function patchBullBoardTheme(): void {
  const ejsPath = path.resolve(process.cwd(), 'node_modules/@bull-board/ui/dist/index.ejs');
  const altEjsPath = path.resolve(process.cwd(), 'backend/node_modules/@bull-board/ui/dist/index.ejs');
  const targetPath = fs.existsSync(ejsPath) ? ejsPath : altEjsPath;

  if (fs.existsSync(targetPath)) {
    let html = fs.readFileSync(targetPath, 'utf8');

    // Strip any old patch if present
    html = html.replace(/<style id="bull-board-custom-fix">[\s\S]*?<\/style>/g, '');
    html = html.replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>[\s\S]*?<\/style>/g, '');
    html = html.replace(/<script id="bull-board-admin-logout">[\s\S]*?<\/script>/g, '');

    const customStyle = `<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
    <style id="bull-board-custom-fix">
      :root {
        --menu-width: 330px !important;
        --header-height: 64px !important;
        --completed: #00a859 !important; /* ReachInbox Emerald Green */
        --delayed: #f97316 !important;   /* Orange / Peach Scheduled */
        --active: #0284c7 !important;    /* Clean Sky Blue */
        --failed: #ef4444 !important;    /* Red */
        --waiting: #eab308 !important;   /* Amber */
        --waitingChildren: #fb923c !important;
        --prioritized: #a855f7 !important;
        --paused: #94a3b8 !important;
      }

      body,
      #root {
        background-color: #f8fafc !important;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        color: #0f172a !important;
        -webkit-font-smoothing: antialiased;
      }

      main {
        background-color: #f8fafc !important;
        min-height: 100vh !important;
        padding-left: 330px !important;
      }

      /* Top Header matching Frontend White Theme */
      header,
      [class*="Qp5xkm"] {
        background-color: #ffffff !important;
        border-bottom: 1px solid #f1f5f9 !important;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04) !important;
        height: 64px !important;
        display: flex !important;
        align-items: center !important;
        z-index: 100 !important;
      }

      /* Brand Logo / Title - 330px fixed block so it never overflows or collides */
      header > a:first-child,
      [class*="KmtwbG"] {
        background-color: #ffffff !important;
        box-shadow: none !important;
        border-bottom: none !important;
        border-right: 1px solid #f1f5f9 !important;
        width: 330px !important;
        min-width: 330px !important;
        max-width: 330px !important;
        flex-basis: 330px !important;
        flex-shrink: 0 !important;
        height: 64px !important;
        line-height: 64px !important;
        color: #0f172a !important;
        font-size: 1.05rem !important;
        font-weight: 800 !important;
        letter-spacing: -0.02em !important;
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        padding-left: 1.25rem !important;
        padding-right: 1.25rem !important;
        display: flex !important;
        align-items: center !important;
        gap: 0.6rem !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        transition: color 0.15s ease !important;
      }

      header > a:first-child:hover,
      [class*="KmtwbG"]:hover {
        color: #00a859 !important;
      }

      header > a:first-child svg,
      [class*="KmtwbG"] svg {
        color: #00a859 !important;
        width: 1.35rem !important;
        height: 1.35rem !important;
        flex-shrink: 0 !important;
      }

      /* Header area to the right of brand container */
      [class*="C16NVy"] {
        padding-left: 2rem !important;
        padding-right: 1.5rem !important;
        flex: 1 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        overflow: visible !important;
        gap: 1.5rem !important;
      }

      /* Capitalize Queue Title in Header */
      [class*="C16NVy"] h2,
      [class*="C16NVy"] h1,
      [class*="C16NVy"] > div > div:first-child {
        text-transform: capitalize !important;
        font-weight: 700 !important;
        color: #0f172a !important;
      }

      /* Top navbar right-side action buttons */
      header button,
      [class*="C16NVy"] button {
        color: #64748b !important;
        border-radius: 9999px !important;
      }

      header button svg,
      [class*="C16NVy"] button svg {
        fill: #64748b !important;
        color: #64748b !important;
        transition: all 0.2s ease !important;
      }

      header button:hover svg,
      [class*="C16NVy"] button:hover svg {
        fill: #00a859 !important;
        color: #00a859 !important;
      }

      /* Left Sidebar matching Frontend ON8 Sidebar */
      aside,
      [class*="KM3iIV"] {
        width: 330px !important;
        min-width: 330px !important;
        max-width: 330px !important;
        background: #ffffff !important;
        border-right: 1px solid #f1f5f9 !important;
        box-shadow: none !important;
        color: #334155 !important;
        padding-top: 1.5rem !important;
        top: 64px !important;
      }

      /* QUEUES heading like CORE in frontend */
      [class*="_SQRTj"] {
        color: #94a3b8 !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        letter-spacing: 0.08em !important;
        text-transform: uppercase !important;
        padding: 0 1.5rem 0.75rem !important;
      }

      /* Queue List navigation */
      [class*="xQ9Bfk"] {
        padding: 0 1rem !important;
        list-style: none !important;
      }

      [class*="xQ9Bfk"] li+li {
        border-top: none !important;
        margin-top: 0.35rem !important;
      }

      [class*="xQ9Bfk"] a {
        border-left: none !important;
        border-radius: 0.75rem !important;
        padding: 0.65rem 1rem !important;
        font-size: 0.875rem !important;
        font-weight: 500 !important;
        color: #475569 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        transition: all 0.15s ease !important;
        text-transform: capitalize !important;
      }

      [class*="xQ9Bfk"] a:hover {
        background-color: #f8fafc !important;
        color: #0f172a !important;
      }

      /* Active queue item matching Scheduled/Sent active tab in frontend */
      [class*="xQ9Bfk"] a.xIyUVd,
      [class*="xQ9Bfk"] a[class*="xIyUVd"] {
        background-color: #e8f5e9 !important;
        color: #00a859 !important;
        font-weight: 700 !important;
      }

      /* Remove WAITING CHILDREN tab & progress segment */
      a[href*="waiting-children"],
      a[href*="waitingChildren"],
      a[title*="Waiting Children"],
      a[title*="waiting-children"],
      button[title*="Waiting Children"],
      [class*="xvoGoH"],
      .xvoGoH,
      /* Remove Bull Board version link (e.g. 5.23.0) */
      a[href*="bull-board/releases"],
      a.LzWgje,
      [class*="LzWgje"] {
        display: none !important;
      }

      /* Queue Cards & Job Cards */
      [class*="rUtWBR"],
      [class*="kxGL7W"] {
        background-color: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 1rem !important;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04) !important;
        padding: 1.5rem !important;
        transition: all 0.15s ease !important;
      }

      [class*="rUtWBR"]:hover,
      [class*="kxGL7W"]:hover {
        box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.05) !important;
      }

      /* Capitalize Queue Name in card */
      [class*="rUtWBR"] h4,
      [class*="wKTaT8"] h4 {
        text-transform: capitalize !important;
      }

      /* Progress bar inside queue card */
      [class*="Q495bR"] {
        border-radius: 9999px !important;
        height: 12px !important;
        background-color: #f1f5f9 !important;
        overflow: hidden !important;
      }

      /* Circular percentage progress shower - small, elegant, and optically centered */
      .mpWxwy,
      svg[class*="mpWxwy"] {
        width: 52px !important;
        height: 52px !important;
        overflow: visible !important;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.04)) !important;
      }

      .mpWxwy circle,
      svg[class*="mpWxwy"] circle {
        cx: 26px !important;
        cy: 26px !important;
        r: 20px !important;
        stroke-width: 4px !important;
        transform-origin: 26px 26px !important;
        -webkit-transform-origin: 26px 26px !important;
      }

      /* Background track circle */
      .mpWxwy circle:first-child,
      svg[class*="mpWxwy"] circle:first-child {
        stroke: #f1f5f9 !important;
      }

      /* Small, perfectly centered percentage text */
      .mpWxwy text,
      svg[class*="mpWxwy"] text {
        fill: #00a859 !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        text-anchor: middle !important;
        dominant-baseline: central !important;
        alignment-baseline: central !important;
        transform: translateY(3.5px) !important;
        -webkit-transform: translateY(3.5px) !important;
      }

      /* Job card progress container */
      [class*="WoVp7D"] {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0.25rem !important;
      }

      /* Action buttons matching emerald theme */
      button[class*="cdc4_x"],
      .cdc4_x {
        background-color: #00a859 !important;
        color: #ffffff !important;
        border-radius: 0.5rem !important;
        font-weight: 600 !important;
      }

      button[class*="cdc4_x"]:hover,
      .cdc4_x:hover {
        background-color: #00924d !important;
      }

      #bullboard-logout-section {
        margin-top: 1.25rem;
        padding-top: 1rem;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
      }

      #bullboard-logout-btn {
        background-color: #ef4444;
        color: #ffffff;
        border: none;
        border-radius: 0.5rem;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      #bullboard-logout-btn:hover {
        background-color: #dc2626;
      }
    </style>
    <script id="bull-board-admin-logout">
      (function () {
        function injectLogoutButton() {
          var anchor = document.getElementById('jobs-per-page') || document.getElementById('language');
          if (!anchor) return;
          var formContainer = anchor.closest('form') || anchor.parentElement?.parentElement;
          if (!formContainer || document.getElementById('bullboard-logout-section')) return;

          var wrapper = document.createElement('div');
          wrapper.id = 'bullboard-logout-section';

          var btn = document.createElement('button');
          btn.id = 'bullboard-logout-btn';
          btn.type = 'button';
          btn.textContent = 'Logout';
          btn.addEventListener('click', function () {
            btn.disabled = true;
            btn.textContent = 'Logging out...';
            fetch('/admin/logout', { method: 'POST', credentials: 'include' })
              .then(function (r) { return r.json(); })
              .then(function (data) {
                window.location.href = (data && data.loginUrl) ? data.loginUrl : 'http://localhost:5173/login';
              })
              .catch(function () {
                window.location.href = 'http://localhost:5173/login';
              });
          });

          wrapper.appendChild(btn);
          formContainer.appendChild(wrapper);
        }

        var observer = new MutationObserver(injectLogoutButton);
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
          injectLogoutButton();
        } else {
          document.addEventListener('DOMContentLoaded', function () {
            observer.observe(document.body, { childList: true, subtree: true });
            injectLogoutButton();
          });
        }
      })();
    </script></head>`;

    html = html.replace('</head>', customStyle);
    fs.writeFileSync(targetPath, html, 'utf8');
    console.log('✅ Bull Board CSS patched with fixed layout, centered circle & hidden waiting-children!');
  }
}

// Auto-run if executed directly
patchBullBoardTheme();
