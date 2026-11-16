//isolated js script adadpted from the original link here: https://editor.p5js.org/MNC31/sketches/pJ9e91C1n 

let x = 0;
let y = 0;
let myShader;
let sketchReady = false;
let pauseRequested = false;

function report(state) {
  window.parent.postMessage({ type: 'michelle-memories-status', state }, '*');
}

function showError(message) {
    const label = document.getElementById('player-message');
    label.hidden = false;
    label.textContent = message;
    if (typeof noLoop === 'function') noLoop();
    report('error');
}

function setup() {
    try {
        if (typeof buildColorShader !== 'function') {
            throw new Error('This sketch needs a p5.js 2.x build with buildColorShader support.');
        }

        const canvas = createCanvas(700, 700, WEBGL);
        canvas.parent('sketch-host');
        pixelDensity(1);
        background(0);
        strokeWeight(10);
        colorMode(HSB);
        myShader = buildColorShader(shaderCallback);

        describe('A wandering colored point leaves a trail on a black canvas. Four rectangles of RGB static interrupt and erase parts of the trail.');

        sketchReady = true;
        document.getElementById('player-message').hidden = true;
        if (pauseRequested || document.hidden) noLoop();
        report('ready');
    } 
    catch (error) {
        showError(error.message || 'Unable to start WebGL.');
    }
}

function shaderCallback() {
    let r = random();
    let g = random();
    let b = random();
    finalColor.begin();
    finalColor.set([r, g, b, 1]);
    finalColor.end();
}

function draw() {
    if (!sketchReady) return;
    try {
        //does not clear the background each time
        shader(myShader);
        noStroke();
        square(-300, -300, 200);
        square(100, 0, 200);
        square(-250, 50, 150);
        square(100, -150, 50);

        x += random(-5, 5);
        y += random(-5, 5);

        // Restore ordinary drawing for the colored point
        resetShader();
        strokeWeight(10);
        const lineHue = x - y;
        stroke(lineHue, 80, 80);

        // A slight depth offset makes the point visible above the static regions.
        point(x, y, 1);
        
    } 
    catch (error) {
        sketchReady = false;
        showError(error.message || 'The sketch encountered a drawing error.');
    }
}

// Only accept playback messages from the embedding page, not other windows.
window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.data?.type !== 'michelle-memories') return;
    if (event.data.action === 'pause') pauseRequested = true;
    if (event.data.action === 'resume') pauseRequested = false;
    if (!sketchReady) return;
    if (pauseRequested || document.hidden) noLoop();
    else loop();
});

document.addEventListener('visibilitychange', () => {
    if (!sketchReady) return;
    if (document.hidden || pauseRequested) noLoop();
    else loop();
});

window.addEventListener('load', () => {
    if (typeof p5 === 'undefined') {
        showError('p5.js could not load. Check your internet connection, then press Restart.');
    }
});