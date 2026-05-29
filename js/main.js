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


});
