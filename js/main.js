/* ============================================================
   synontech — main.js
   Scroll-reveal observer + mobile hamburger toggle + stats sync.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ── Current Year Sync ──────────────────────────────────────
    const yearEls = document.querySelectorAll('#current-year');
    yearEls.forEach(el => el.textContent = new Date().getFullYear());

    // ── Scroll Reveal ─────────────────────────────────────────────
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

    // ── HUD Dynamics ──────────────────────────────────────────
    const hudFrames = document.querySelectorAll('.hud-frame');
    const userCoords = document.getElementById('user-coords');

    function updateHUD() {
        hudFrames.forEach(frame => {
            if (Math.random() > 0.95) {
                frame.classList.add('active');
                setTimeout(() => frame.classList.remove('active'), 100);
            }
        });

        if (userCoords && Math.random() > 0.8) {
            const lat = (26.2041 + (Math.random() - 0.5) * 0.01).toFixed(4);
            const lng = (28.0473 + (Math.random() - 0.5) * 0.01).toFixed(4);
            userCoords.innerHTML = `S ${lat}<br>E ${lng}`;
        }
    }

    setInterval(updateHUD, 2000);

    // ── Typing Effect ─────────────────────────────────────────
    function typeEffect(element, speed) {
        const text = element.innerHTML;
        element.innerHTML = '';
        element.style.visibility = 'visible';

        let i = 0;
        const timer = setInterval(() => {
            if (i < text.length) {
                element.append(text.charAt(i));
                i++;
            } else {
                clearInterval(timer);
            }
        }, speed);
    }

    const heroSub = document.querySelector('.hero-sub');
    if (heroSub) {
        heroSub.style.visibility = 'hidden';
        setTimeout(() => typeEffect(heroSub, 30), 1000);
    }

    // ── Mobile Hamburger ──────────────────────────────────────────
    const hamburger = document.getElementById('nav-hamburger');
    const navLinks  = document.getElementById('nav-links');

    if (hamburger && navLinks) {
      hamburger.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', isOpen);
        hamburger.textContent = isOpen ? '✕' : '☰';
      });

      navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
          navLinks.classList.remove('open');
          hamburger.setAttribute('aria-expanded', 'false');
          hamburger.textContent = '☰';
        });
      });
    }



    // ── Broken Link / 404 Fallback ───────────────────────────
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '404.html') {
                // Potential for a cool transition here later
            }
        });
    });

    // ── Email Obfuscation ─────────────────────────────────────
    const user = 'synontech.sa';
    const domain = 'gmail.com';
    const email = `${user}@${domain}`;
    
    document.querySelectorAll('.contact-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `mailto:${email}`;
      });
    });

    // ── MKVoodoo GitHub Release Sync ──────────────────────────
    async function syncMKVoodooRelease() {
        const versionEl = document.getElementById('mkv-version');
        const changelogEl = document.getElementById('mkv-changelog');
        const releaseInfo = document.getElementById('latest-release');
        const downloadBtn = document.getElementById('mkv-download-btn');

        if (!versionEl || !changelogEl) return;

        try {
            const response = await fetch('https://api.github.com/repos/synontechsa-hub/MKVoodoo/releases/latest');
            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            // Set Version
            versionEl.textContent = data.tag_name;

            // Set Changelog (first 300 chars or so, and handle newlines)
            const body = data.body || 'No release notes provided.';
            changelogEl.innerHTML = body.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');

            // Update Download Button to point to specific asset if possible,
            // otherwise keep it to the releases page.
            // Usually we want the .exe for Windows.
            const exeAsset = data.assets.find(asset => asset.name.endsWith('.exe'));
            if (exeAsset) {
                downloadBtn.href = exeAsset.browser_download_url;
            }

            // Show the info section
            releaseInfo.style.display = 'block';
            releaseInfo.classList.add('visible'); // Trigger reveal if observer missed it due to display:none

        } catch (err) {
            console.warn('GitHub release sync failed:', err);
        }
    }

    if (document.body.classList.contains('mkvoodoo-page')) {
        syncMKVoodooRelease();
    }

});
