// to open memories, used with other js file

(() => {
    'use strict';
    if (!document.getElementById('computer-screen')) return;

    function send(frame, action) {
        // prevents sensitive information being sent
        // '*' permits local file testing, whose origin can be opaque.
        frame.contentWindow?.postMessage({ type: 'michelle-memories', action }, '*');
    }

    function updateVisibility(panel) {
        const frame = panel.querySelector('.memories-player');
        const windowElement = panel.closest('.app-window');
        if (panel.dataset.playing !== 'true') return;
        const paused = document.hidden || windowElement?.hidden;
        send(frame, paused ? 'pause' : 'resume');
    }

    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-memory-action]');
        if (!button || button.disabled) return;
        const panel = button.closest('.memories-experience');
        if (!panel) return;
        const frame = panel.querySelector('.memories-player');
        const placeholder = panel.querySelector('.memories-placeholder');
        const play = panel.querySelector('[data-memory-action="play"]');
        const restart = panel.querySelector('[data-memory-action="restart"]');
        const stop = panel.querySelector('[data-memory-action="stop"]');
        const status = panel.querySelector('.memories-status');
        const action = button.dataset.memoryAction;

        if (action === 'stop') {
            panel.dataset.playing = 'false';

            // Navigating away unloads p5 and its animation loop, not only hide it
            frame.src = 'about:blank';
            frame.hidden = true;
            placeholder.hidden = false;
            play.disabled = false;
            restart.disabled = true;
            stop.disabled = true;
            status.textContent = 'Stopped. Press Play to start again.';
            return;
        }

        panel.dataset.playing = 'true';
        placeholder.hidden = true;
        frame.hidden = false;
        play.disabled = true;
        restart.disabled = false;
        stop.disabled = false;
        status.textContent = 'Loading the sketch…';

        // Reloading this isolated page also resets x, y, and the trail.
        frame.src = frame.dataset.playerSrc;
        frame.onload = () => updateVisibility(panel);
    });

    window.addEventListener('message', (event) => {
        if (!event.data || event.data.type !== 'michelle-memories-status') return;
        document.querySelectorAll('.memories-experience').forEach(panel => {
            const frame = panel.querySelector('.memories-player');
            if (event.source !== frame.contentWindow || panel.dataset.playing !== 'true') return;
            const status = panel.querySelector('.memories-status');
            if (event.data.state === 'ready') {
                status.textContent = 'Playing. Restart clears the trail.';
                updateVisibility(panel);
            } 
            else if (event.data.state === 'error') {
                status.textContent = 'The sketch could not start. Check the output message and press Restart to retry.';
            }
        });
    });

    function syncAll() {
        document.querySelectorAll('.memories-experience').forEach(updateVisibility);
    }
    
    // The desktop sets hidden on a minimized window. Pause/resume that iframe.
    const host = document.getElementById('windows');
    if (host) new MutationObserver(syncAll).observe(host, {
        subtree: true, attributes: true, attributeFilter: ['hidden']
    });
    document.addEventListener('visibilitychange', syncAll);
})();