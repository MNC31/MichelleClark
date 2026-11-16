// movable corkbaord papers

(() => {
    'use strict';

    // elements and settings -------------------------------
    const board = document.getElementById('corkboard');
    if (!board) return;
    const papers = [...board.querySelectorAll('.paper')];
    const reset = document.getElementById('reset-board');
    const status = document.getElementById('board-status');
    const storageKey = 'michelles-plaza-information-board-v1';
    const edge = 22; // decorative paper rotations.
    const states = new Map();
    let topLayer = papers.length;
    let drag = null;

    // reset positions based on the html
    papers.forEach((paper, index) => {
        const state = {x: Number(paper.dataset.x) || edge, y: Number(paper.dataset.y) || edge, z: index + 1,};
        states.set(paper, state);
    });

    function announce(message) {
        if (status) status.textContent = message;
    }

    function title(paper) {
        return paper.querySelector('h2')?.textContent.trim().replace(/\s+/g, ' ') || 'Paper';
    }

    // Positioning and layers ----------------------------------
    function place(paper, x, y) {
        const state = states.get(paper);
        const maxX = Math.max(edge, board.clientWidth - paper.offsetWidth - edge);
        const maxY = Math.max(edge, board.clientHeight - paper.offsetHeight - edge);
        state.x = Math.max(edge, Math.min(maxX, x));
        state.y = Math.max(edge, Math.min(maxY, y));
        paper.style.left = state.x + 'px';
        paper.style.top = state.y + 'px';
        paper.style.zIndex = state.z;
    }

    function bringForward(paper) {
        const state = states.get(paper);
        state.z = ++topLayer;
        paper.style.zIndex = state.z;
    }

    // Store only IDs, positions, and stacking order
    function save() {
        try {
            const snapshot = papers.map((paper) => ({ id: paper.id, ...states.get(paper) }));
            localStorage.setItem(storageKey, JSON.stringify(snapshot));
        } catch { }
    }

    try {
        const snapshot = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (Array.isArray(snapshot)) {
            snapshot.forEach((saved) => {
                if (!saved || typeof saved !== 'object') return;
                const paper = papers.find((item) => item.id === saved.id);
                if (!paper || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return;
                const state = states.get(paper);
                state.x = saved.x;
                state.y = saved.y;
                if (Number.isFinite(saved.z) && saved.z > 0 && saved.z < 100000) {
                    state.z = saved.z;
                    topLayer = Math.max(topLayer, saved.z);
                }
            });
        }
    } catch {}

    papers.forEach((paper) => {
        const state = states.get(paper);
        place(paper, state.x, state.y);
    });

    // pointer dragging-------------------------
    function finishDrag(cancelled = false) {
        if (!drag) return;
        const current = drag;
        drag = null;
        if (cancelled) place(current.paper, current.originalX, current.originalY);
        current.paper.classList.remove('is-dragging');
        if (current.paper.hasPointerCapture(current.pointerId)) {
            current.paper.releasePointerCapture(current.pointerId);
        }
        save();
        announce(title(current.paper) + (cancelled ? ': move cancelled.' : ': placed on the board.'));
    }

    papers.forEach((paper) => {
        // Focusing a paper brings it above other papers, including by keyboard.
        paper.addEventListener('focus', () => bringForward(paper));

        paper.addEventListener('pointerdown', (event) => {
            if (!event.isPrimary || event.button !== 0 || drag) return;
            const state = states.get(paper);
            event.preventDefault();
            paper.focus({ preventScroll: true });
            bringForward(paper);
            drag = {
                paper,
                pointerId: event.pointerId,
                originalX: state.x,
                originalY: state.y,
                pointerX: event.clientX,
                pointerY: event.clientY,
                scrollX: window.scrollX,
                scrollY: window.scrollY,
                viewportX: paper.closest('.board-viewport').scrollLeft,
                viewportY: paper.closest('.board-viewport').scrollTop,
            };
            paper.classList.add('is-dragging');
            paper.setPointerCapture(event.pointerId);
        });

        paper.addEventListener('pointermove', (event) => {
            if (!drag || drag.paper !== paper || drag.pointerId !== event.pointerId) return;
            const viewport = paper.closest('.board-viewport');
            place(
                paper,
                drag.originalX + event.clientX - drag.pointerX + viewport.scrollLeft - drag.viewportX + window.scrollX - drag.scrollX,
                drag.originalY + event.clientY - drag.pointerY + viewport.scrollTop - drag.viewportY + window.scrollY - drag.scrollY
            );
        });

        paper.addEventListener('pointerup', (event) => {
            if (drag?.pointerId === event.pointerId) finishDrag();
        });

        paper.addEventListener('pointercancel', (event) => {
            if (drag?.pointerId === event.pointerId) finishDrag(true);
        });

        paper.addEventListener('lostpointercapture', (event) => {
            if (drag?.pointerId === event.pointerId) finishDrag();
        });

        // keyboard movement----------------------------------------
        paper.addEventListener('keydown', (event) => {
            if (event.ctrlKey || event.altKey || event.metaKey || drag) return;
            const step = event.shiftKey ? 30 : 10;
            const directions = {
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0],
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
            };
            const direction = directions[event.key];
            if (!direction) return;
            event.preventDefault();
            const state = states.get(paper);
            place(paper, state.x + direction[0], state.y + direction[1]);
            save();
            announce(title(paper) + ': position ' + Math.round(state.x) + ', ' + Math.round(state.y) + '.');
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && drag) {
            event.preventDefault();
            finishDrag(true);
        }
    });

    // reset and layout changes----------------------------
    reset?.addEventListener('click', () => {
        finishDrag(true);
        topLayer = papers.length;
        papers.forEach((paper, index) => {
            states.get(paper).z = index + 1;
            place(paper, Number(paper.dataset.x) || edge, Number(paper.dataset.y) || edge);
        });
        save();
        announce('The board has been returned to its original arrangement.');
    });

    function fitPapers() {
        papers.forEach((paper) => {
            const state = states.get(paper);
            place(paper, state.x, state.y);
        });
    }
    
    window.addEventListener('resize', fitPapers);
    document.fonts?.ready.then(fitPapers);
})();