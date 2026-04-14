// load-navbar.js - Fixed version that ensures sticky positioning

function loadNavbar() {
    // First, ensure the CSS is loaded
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = '/navbar-styles.css';
    document.head.appendChild(cssLink);
    
    // Then load the navbar HTML
    fetch('navbar.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(data => {
            const navbarContainer = document.getElementById('navbar-container');
            if (navbarContainer) {
                navbarContainer.innerHTML = data;
                
                // Re-initialize all scripts
                const scripts = navbarContainer.querySelectorAll('script');
                scripts.forEach(oldScript => {
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => {
                        newScript.setAttribute(attr.name, attr.value);
                    });
                    newScript.textContent = oldScript.textContent;
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
                
                // Force reflow to ensure sticky positioning applies
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                }, 50);
            }
        })
        .catch(error => {
            console.error('Failed to load navbar:', error);
            const navbarContainer = document.getElementById('navbar-container');
            if (navbarContainer) {
                navbarContainer.innerHTML = '<div style="background:#a621db; color:white; padding:15px; text-align:center;">⚠️ Navigation failed to load. Please refresh the page.</div>';
            }
        });
}

// Load navbar immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNavbar);
} else {
    loadNavbar();
}