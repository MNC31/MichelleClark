// Usage for navigation and static

(() => {
    'use strict';

    //homepage elements and settings-------------------------------------
    const corridor = document.getElementById('corridor');
    if (!corridor || !corridor.querySelector('.world')) return;

    //avoiding duplicate
    if (corridor.dataset.mallInitialized === 'true') return;
    corridor.dataset.mallInitialized = 'true';

    // constants specific to get by elements
    const directory = document.getElementById('directory');
    const directoryToggle = document.getElementById('directory-toggle');
    const previous = document.getElementById('previous');
    const next = document.getElementById('next');
    const locationLabel = document.getElementById('location');
    const progressFill = document.getElementById('progress-fill');
    const stores = corridor.querySelectorAll('.storefront, .information-bay, .internet-bay');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

    const settings = {
        wheelSpeed: 1,
        walkingStep: 0.7,
        keyboardStep: 180,
        defaultLocation: 'THE MALL OF MEMORIES',
        positionKey: 'michelles-plaza-homepage-position',
        static: { // static overlay based on https://editor.p5js.org/MNC31/sketches/KpY3-DoyY - adapted to not be web-based
        enabled: true,
        opacity: 0.08, 
        pixelSize: 2, 
        framesPerSecond: 12, 
        maxPixels: 300000, 
        },
    };

    const behavior = () => reducedMotion.matches ? 'auto' : 'smooth';

    function walk(distance) {
        corridor.scrollBy({ left: distance, behavior: behavior() });
    }

    function leftInCorridor(element) {
        return element.getBoundingClientRect().left
        - corridor.getBoundingClientRect().left
        - corridor.clientLeft
        + corridor.scrollLeft;
    }

    // allows for mouse wheel for sideway scrolling -----------------
    corridor.addEventListener('wheel', (event) => {
        if (event.ctrlKey || !event.cancelable) return;
        if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

        let unit = 1;
        if (event.deltaMode === 1) unit = 18;
        if (event.deltaMode === 2) unit = corridor.clientWidth;

        const movement = event.deltaY * unit * settings.wheelSpeed;
        const maximum = corridor.scrollWidth - corridor.clientWidth;
        const canMove = (movement < 0 && corridor.scrollLeft > 0) || (movement > 0 && corridor.scrollLeft < maximum - 1);

        if (canMove) {
            event.preventDefault();
            corridor.scrollLeft += movement;
        }
    }, { passive: false });

    // button based walking and directory ---------------------------
    previous?.addEventListener('click', () => {
        walk(-corridor.clientWidth * settings.walkingStep);
    });
    next?.addEventListener('click', () => {
        walk(corridor.clientWidth * settings.walkingStep);
    });

    function setDirectory(open, restoreFocus = false) {
        if (!directory || !directoryToggle) return;
        directory.hidden = !open;
        directoryToggle.setAttribute('aria-expanded', String(open));
        if (restoreFocus) directoryToggle.focus({ preventScroll: true });
    }

    directoryToggle?.addEventListener('click', () => {
        if (directory) setDirectory(directory.hidden);
    });

    document.addEventListener('click', (event) => {
        if (!directory || directory.hidden || !directoryToggle) return;
        if (!directory.contains(event.target) && !directoryToggle.contains(event.target)) setDirectory(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && directory && !directory.hidden) {
            setDirectory(false, true);
        }
    });

    const jumpButtons = [
        ...(directory?.querySelectorAll('[data-jump]') ?? []),
        ...corridor.querySelectorAll('[data-jump]'),
    ];

    jumpButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const id = button.dataset.jump;
            let left = 0;
            if (id !== 'start') {
                const target = document.getElementById(id);
                if (!target || !corridor.contains(target)) {
                    console.warn('No matching mall destination:', id);
                    return;
                }

                left = leftInCorridor(target) - (corridor.clientWidth - target.getBoundingClientRect().width) / 2;
            }

            setDirectory(false);
            corridor.focus({ preventScroll: true });
            corridor.scrollTo({ left, behavior: behavior() });
        });
    });

    //keyboard movement -------------------
    corridor.addEventListener('keydown', (event) => {
        if (event.target !== corridor) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        if (directory && !directory.hidden) return;

        const distances = {
            ArrowLeft: -settings.keyboardStep,
            ArrowRight: settings.keyboardStep,
            PageUp: -corridor.clientWidth * 0.8,
            PageDown: corridor.clientWidth * 0.8,
        };
        
        if (event.key in distances) {
            event.preventDefault();
            walk(distances[event.key]);
        } 
        else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            corridor.scrollTo({
                left: event.key === 'Home' ? 0 : corridor.scrollWidth,
                behavior: behavior(),
            });
        }
    });

    // progress bar position and location -------------------
    let queued = false;

    function updateDisplay() {
        const maximum = corridor.scrollWidth - corridor.clientWidth;
        const percent = maximum > 0 ? Math.max(0, Math.min(100, corridor.scrollLeft / maximum * 100)) : 0;
        if (progressFill) progressFill.style.width = percent + '%';

        const center = corridor.scrollLeft + corridor.clientWidth / 2;
        let label = settings.defaultLocation;
        stores.forEach((store) => {
            const left = leftInCorridor(store);
            if (center >= left && center < left + store.getBoundingClientRect().width) {
                label = store.querySelector('h2')?.textContent.trim().toUpperCase() || store.getAttribute('aria-label') || settings.defaultLocation;
            }
        });

        if (locationLabel) locationLabel.textContent = label;
        queued = false;
    }

    function requestUpdate() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(updateDisplay);
    }

    function savePosition() {
        try {
            sessionStorage.setItem(settings.positionKey, String(corridor.scrollLeft));
        } catch {}
    }

    try {
        const saved = sessionStorage.getItem(settings.positionKey);
        const position = saved === null ? 0 : Number(saved);
        if (Number.isFinite(position)) corridor.scrollLeft = position;
    } catch { }

    corridor.addEventListener('scroll', () => {
        requestUpdate();
        savePosition();
    }, { passive: true });
    window.addEventListener('pagehide', savePosition);
    window.addEventListener('resize', requestUpdate);
    window.addEventListener('pageshow', requestUpdate);
    document.fonts?.ready.then(requestUpdate);
    if (directory) setDirectory(!directory.hidden);
    updateDisplay();

    // more static overlay: adapated from previous link given at the top ---------------------
    const canvas = document.createElement('canvas');
    canvas.id = 'mall-static-overlay';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = `
        position: fixed; inset: 0; width: 100%; height: 100%;
        z-index: 6; pointer-events: none; image-rendering: pixelated;
        opacity: ${settings.static.opacity};
    `;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return; // Navigation still works if canvas is unavailable.
    document.body.appendChild(canvas);

    // control is above effect: control allows for static to be on or off, very user dependent
    const staticButton = document.createElement('button');
    staticButton.type = 'button';
    staticButton.id = 'mall-static-toggle';
    staticButton.setAttribute('aria-label', 'Static overlay');
    staticButton.setAttribute('aria-controls', canvas.id);
    staticButton.style.cssText = `
        position: fixed; right: 16px; bottom: 100px; z-index: 16;
        padding: 9px 11px; border: 1px solid #a09386;
        color: #ccc4b8; background: #36302b;
        font: 10px monospace; letter-spacing: 1px; cursor: pointer;
    `;
    document.body.appendChild(staticButton);

    let enabled = settings.static.enabled;
    let pixels;
    let timer = null;

    function drawStatic() {
        if (!pixels || !enabled) return;
        const data = pixels.data;
        for (let index = 0; index < data.length; index += 4) {
            data[index] = Math.floor(Math.random() * 256);
            data[index + 1] = Math.floor(Math.random() * 256);
            data[index + 2] = Math.floor(Math.random() * 256);
            data[index + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
    }

    function resizeStatic() {
        const area = Math.max(1, innerWidth * innerHeight);
        const scale = Math.max(1, settings.static.pixelSize, Math.sqrt(area / settings.static.maxPixels));
        canvas.width = Math.max(1, Math.ceil(innerWidth / scale));
        canvas.height = Math.max(1, Math.ceil(innerHeight / scale));
        pixels = context.createImageData(canvas.width, canvas.height);
        drawStatic();
    }

    function refreshStatic() {
        if (timer !== null) clearInterval(timer);
        timer = null;
        canvas.hidden = !enabled;
        staticButton.setAttribute('aria-pressed', String(enabled));
        staticButton.textContent = enabled ? 'STATIC: ON' : 'STATIC: OFF';

        if (!enabled || document.hidden) return;
        drawStatic();

        // Reduced-motion preference keeps one still grain frame
        if (!reducedMotion.matches) {
            timer = setInterval(drawStatic, 1000 / Math.max(1, settings.static.framesPerSecond));
        }
    }

    staticButton.addEventListener('click', () => {
        enabled = !enabled;
        refreshStatic();
    });

    reducedMotion.addEventListener('change', refreshStatic);
    document.addEventListener('visibilitychange', refreshStatic);
    window.addEventListener('resize', resizeStatic);
    window.addEventListener('pagehide', () => {
        if (timer !== null) clearInterval(timer);
        timer = null;
    });
    window.addEventListener('pageshow', refreshStatic);

    resizeStatic();
    refreshStatic();

})();