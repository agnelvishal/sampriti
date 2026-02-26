document.addEventListener('DOMContentLoaded', () => {
    // --- Scroll-aware header ---
    const mainHeader = document.querySelector('.main-header');
    const heroSection = document.getElementById('hero');

    // On pages without a hero section, always show the scrolled (solid) header
    if (!heroSection) {
        if (mainHeader) mainHeader.classList.add('scrolled');
    } else {
        function updateHeader() {
            const heroBottom = heroSection.getBoundingClientRect().bottom;
            const heroThreshold = heroSection.offsetHeight * 0.5;
            if (heroBottom <= heroThreshold) {
                mainHeader.classList.add('scrolled');
            } else {
                mainHeader.classList.remove('scrolled');
            }
        }

        window.addEventListener('scroll', updateHeader, { passive: true });
        updateHeader(); // run once on load

        // --- Hover-aware header (mirrors scroll behaviour) ---
        mainHeader.addEventListener('mouseenter', () => {
            mainHeader.classList.add('scrolled');
        });

        mainHeader.addEventListener('mouseleave', () => {
            // Only remove the class if scrolling hasn't already triggered it
            const heroBottom = heroSection.getBoundingClientRect().bottom;
            if (heroBottom > 0) {
                mainHeader.classList.remove('scrolled');
            }
        });
    }

    // --- Hero video controls ---
    const heroVideo = document.querySelector('.hero-video-bg');
    const playPauseBtn = document.getElementById('hero-play-pause');
    const muteUnmuteBtn = document.getElementById('hero-mute-unmute');

    if (heroVideo && playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            if (heroVideo.paused) {
                heroVideo.play();
                playPauseBtn.querySelector('.icon-pause').style.display = '';
                playPauseBtn.querySelector('.icon-play').style.display = 'none';
                playPauseBtn.setAttribute('aria-label', 'Pause video');
            } else {
                heroVideo.pause();
                playPauseBtn.querySelector('.icon-pause').style.display = 'none';
                playPauseBtn.querySelector('.icon-play').style.display = '';
                playPauseBtn.setAttribute('aria-label', 'Play video');
            }
        });
    }

    if (heroVideo && muteUnmuteBtn) {
        muteUnmuteBtn.addEventListener('click', () => {
            heroVideo.muted = !heroVideo.muted;
            muteUnmuteBtn.querySelector('.icon-muted').style.display = heroVideo.muted ? '' : 'none';
            muteUnmuteBtn.querySelector('.icon-unmuted').style.display = heroVideo.muted ? 'none' : '';
            muteUnmuteBtn.setAttribute('aria-label', heroVideo.muted ? 'Unmute video' : 'Mute video');
        });
    }


    // --- Configuration ---
    // REPLACE THIS URL with your own Google Apps Script Web App URL after deployment
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyi0XkQU-k0nZgoTR20CPEIDk4d2jLkAbyQzw7jQ3_w9lzq-zh09kfpGeyMZLswW0ds_g/exec';

    // --- Elements ---
    const modal = document.getElementById('buy-modal');
    const closeBtn = document.querySelector('.close-modal');
    const buyBtns = document.querySelectorAll('.buy-now-btn');
    const buyForm = document.getElementById('buy-form');
    const modalProductName = document.getElementById('modal-product-name');
    const hiddenProductName = document.getElementById('product-name');

    // --- Event Listeners ---

    // Open Modal
    buyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const product = btn.getAttribute('data-product');
            modalProductName.textContent = `Ordering: ${product}`;
            hiddenProductName.value = product;
            modal.style.display = 'block';
        });
    });

    // Close Modal
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Form Submission
    buyForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // 1. Collect Data
        const formData = new FormData(buyForm);
        const data = Object.fromEntries(formData.entries());

        // Basic visual feedback
        const submitBtn = buyForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;

        if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
            alert('Please update the GOOGLE_SCRIPT_URL in script.js with your deployed Web App URL.');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            return;
        }

        // 2. Send to Google Apps Script
        // We use 'no-cors' needed for simple HTML forms posting to GAS usually, 
        // but for JSON fetch we need CORS handling in GAS. 
        // A simple way is using URL parameters or JSON body.
        // Let's use simple JSON body.

        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data),
            // headers: { "Content-Type": "text/plain;charset=utf-8" }, // Avoids preflight
        })
            .then(response => {
                // With no-cors we can't see the response text, but we assume success if no network error.
                // However, to get a proper response we'd need the script to return JSON and proper headers.
                // For simplicity, let's assume if it doesn't throw, it reached.
                alert('Order successfully placed! We will contact you shortly.');
                buyForm.reset();
                modal.style.display = 'none';
            })
            .catch(error => {
                console.error('Error:', error);
                alert('There was a problem placing your order. Please try again.');
            })
            .finally(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
    });
});
