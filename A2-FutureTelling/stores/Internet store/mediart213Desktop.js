//js for the desktop

(() => {
    'use strict';
    const screen = document.getElementById('computer-screen');
    const workspace = document.getElementById('workspace');
    if (!screen || !workspace || screen.dataset.initialized) return;
    screen.dataset.initialized = 'true';

    // app templates and settings ---------------------------------
    const templates = new Map([...document.querySelectorAll('template[data-template]')].map(template => [template.dataset.template, template]));
    const host = document.getElementById('windows');
    const taskList = document.getElementById('task-list');
    const live = document.getElementById('desktop-status');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const apps = new Map();
    
    let active = null;
    let drag = null;
    let staticEnabled = true;
    
    const noiseSettings = { opacity:0.16, grain:2, fps:12, maxPixels:200000 };

    function announce(message) { live.textContent = message; }

    // window size, position, stacking --------------------------------
    function fit(app) {
        if (app.maximized) {
            Object.assign(app.el.style, {left:'0px', top:'0px', width:workspace.clientWidth+'px', height:workspace.clientHeight+'px'});
        } 
        else {
            const width = Math.min(app.width, workspace.clientWidth - 12);
            const height = Math.min(app.height, workspace.clientHeight - 12);
            app.x = Math.max(0, Math.min(app.x,workspace.clientWidth-width));
            app.y = Math.max(0, Math.min(app.y,workspace.clientHeight-height));
            Object.assign(app.el.style, {left:app.x+'px', top:app.y+'px', width:width+'px', height:height+'px'});
        }
    }
    
    function activate(app, focus=false) {
        app.minimized = false;
        app.el.hidden = false;
        active = app.id;
        const others = [...apps.values()].filter(a => a!==app).sort((a,b)=>a.layer-b.layer);
        [...others, app].forEach((item,index) => {
            item.layer = index+2;
            item.el.style.zIndex = item.layer;
            item.el.classList.toggle('active',item===app);
            item.task.setAttribute('aria-pressed',String(item===app));
        });
        if (focus) app.bar.focus({preventScroll:true});
    }
    
    function chooseNext() {
        const next = [...apps.values()].filter(a=>!a.minimized).sort((a,b)=>b.layer-a.layer)[0];
        active = null;
        apps.forEach(a=>{
            a.el.classList.remove('active');
            a.task.setAttribute('aria-pressed','false');
        });
        if (next) activate(next);
    }
    
    function minimize(app) {
        app.minimized = true;
        app.el.hidden = true;
        chooseNext();
        app.task.focus();
        announce(app.title+' minimized. Use its taskbar button to restore it.');
    }
   
    function maximize(app) {
        app.maximized = !app.maximized;
        app.maxButton.setAttribute('aria-label',app.maximized?'Restore window size':'Maximize window');
        fit(app); activate(app);
    }
    
    function close(app) {
        if (drag?.app===app) finishDrag();
        app.el.remove(); 
        app.task.remove(); 
        apps.delete(app.id);
        chooseNext();
        
        if (active) apps.get(active).bar.focus();
        else [...document.querySelectorAll('.desktop-icon')].find(i=>i.dataset.app===app.id)?.focus();
        announce(app.title+' closed.');
    }

    // open app from HTML template ---------------------------------
    function openApp(id) {
        if (apps.has(id)) { 
            activate(apps.get(id),true);
            return; 
        }

        const template = templates.get(id);
        if (!template) return;
        const title = template.dataset.title || id;
        const el = document.createElement('section');
        el.className = 'app-window';
        el.id = 'window-'+id;
        el.setAttribute('role','region');
        el.setAttribute('aria-labelledby','title-'+id);

        const bar = document.createElement('header');
        bar.className = 'titlebar'; bar.tabIndex = 0;
        bar.setAttribute('aria-label','Move '+title+' window with arrow keys');
        const heading = document.createElement('h2');
        heading.className = 'window-title'; heading.id = 'title-'+id; heading.textContent = title;
        bar.append(heading);

        function windowButton(symbol,label) {
            const button = document.createElement('button');
            button.type='button';button.textContent=symbol;button.setAttribute('aria-label',label);
            bar.append(button);return button;
        }

        const minButton=windowButton('_','Minimize window');
        const maxButton=windowButton('□','Maximize window');
        const closeButton=windowButton('×','Close window');
        const content=document.createElement('div');

        content.className='window-content';content.append(template.content.cloneNode(true));
        const status=document.createElement('footer');
        status.className='window-status';status.textContent=template.dataset.status || title;
        el.append(bar,content,status);

        const task=document.createElement('button');
        task.type='button';task.className='task-button';task.textContent=title;
        task.setAttribute('aria-controls',el.id);
        const offset=apps.size*20;

        const app={id,title,el,bar,task,maxButton,x:130+offset,y:35+offset,width:id==='settings'?460:590,height:id==='settings'?310:370, layer:2,minimized:false,maximized:false};
        apps.set(id,app);host.append(el);taskList.append(task);fit(app);
        el.addEventListener('pointerdown',()=>activate(app));
        el.addEventListener('focusin',()=>{if(active!==id)activate(app);});
        task.addEventListener('click',()=>{
            if(active===id&&!app.minimized)minimize(app);
            else activate(app,true);
        });
        minButton.addEventListener('click',()=>minimize(app));
        maxButton.addEventListener('click',()=>maximize(app));
        closeButton.addEventListener('click',()=>close(app));
        addDragging(app);

        if(id==='settings') {
            content.querySelectorAll('input[name="screen-mode"]').forEach(radio=>{
                radio.checked=(radio.value==='atmospheric')===staticEnabled;
                radio.addEventListener('change',()=>{
                    if(radio.checked)setStatic(radio.value==='atmospheric');
                });
            });
        }
        // specific to memories
        activate(app,true);announce(title+' opened.');
    }

    // dragging and keyboard movement --------------------------------------
    function finishDrag(cancel=false) {
        if(!drag)return;
        const current=drag;drag=null;
        if(cancel){
            current.app.x=current.x;
            current.app.y=current.y;
            fit(current.app);
        }

        screen.classList.remove('moving-window');
        if(current.app.bar.hasPointerCapture(current.pointer))current.app.bar.releasePointerCapture(current.pointer);
    }
    function addDragging(app) {
        const bar=app.bar;
        bar.addEventListener('dblclick',event=>{if(!event.target.closest('button'))maximize(app);});
        bar.addEventListener('pointerdown',event=>{
            if(event.button!==0||!event.isPrimary||app.maximized||drag||event.target.closest('button'))return;
            event.preventDefault();
            activate(app,true);
            drag={app,pointer:event.pointerId,px:event.clientX,py:event.clientY,x:app.x,y:app.y};
            screen.classList.add('moving-window');
            bar.setPointerCapture(event.pointerId);
        });

        bar.addEventListener('pointermove',event=>{
            if(drag?.app!==app||drag.pointer!==event.pointerId)return;
            app.x=drag.x+event.clientX-drag.px;app.y=drag.y+event.clientY-drag.py;fit(app);
        });

        bar.addEventListener('pointerup',event=>{if(drag?.pointer===event.pointerId)finishDrag();});
        bar.addEventListener('pointercancel',event=>{if(drag?.pointer===event.pointerId)finishDrag(true);});
        bar.addEventListener('lostpointercapture',event=>{if(drag?.pointer===event.pointerId)finishDrag();});
        bar.addEventListener('keydown',event=>{
            if(event.target!==bar||app.maximized||event.ctrlKey||event.altKey||event.metaKey)return;
            const step=event.shiftKey?30:10;
            const delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];
            if(!delta)return;
            event.preventDefault();app.x+=delta[0];app.y+=delta[1];fit(app);
        });
    }
    document.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&drag){
            event.preventDefault();finishDrag(true);
        }
    });

    // Desktop icons -----------------------------------------------
    document.querySelectorAll('.desktop-icon').forEach(icon=>{
        icon.addEventListener('click',event=>{
            document.querySelectorAll('.desktop-icon').forEach(other=>other.classList.toggle('selected',other===icon));
            
            // Keyboard activation and coarse-pointer taps open immediately
            if(event.detail===0||matchMedia('(pointer: coarse)').matches)openApp(icon.dataset.app);
        });
        icon.addEventListener('dblclick',()=>openApp(icon.dataset.app));
    });

    function updateClock(){
        const now=new Date();const clock=document.getElementById('desktop-clock');
        clock.textContent=now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
        clock.dateTime=now.toISOString();
    }

    updateClock();setInterval(updateClock,15000);

    // Static focused in computer screen-----------------------------
    const canvas=document.getElementById('screen-static');
    const context=canvas.getContext('2d',{alpha:true});
    const staticButton=document.getElementById('static-toggle');
    let buffer;
    let timer=null;
    if(!context)staticEnabled=false;
    canvas.style.opacity=noiseSettings.opacity;
    function drawNoise(){
        if(!context||!buffer||!staticEnabled)return;
        const data=buffer.data;
        for(let i=0;i<data.length;i+=4){
            data[i]=Math.random()*256;data[i+1]=Math.random()*256;
            data[i+2]=Math.random()*256;data[i+3]=255;
        }
        context.putImageData(buffer,0,0);
    }

    function resizeNoise(){
        if(!context)return;
        const scale=Math.max(noiseSettings.grain,Math.sqrt(screen.clientWidth*screen.clientHeight/noiseSettings.maxPixels));
        canvas.width=Math.max(1,Math.ceil(screen.clientWidth/scale));
        canvas.height=Math.max(1,Math.ceil(screen.clientHeight/scale));
        buffer=context.createImageData(canvas.width,canvas.height);
        drawNoise();
    }
    function refreshNoise(){
        if(timer!==null)clearInterval(timer);
        timer=null;canvas.hidden=!staticEnabled;
        screen.classList.toggle('readable',!staticEnabled);
        staticButton.setAttribute('aria-pressed',String(staticEnabled));
        staticButton.textContent=staticEnabled?'STATIC ON':'STATIC OFF';
        document.querySelectorAll('input[name="screen-mode"]').forEach(radio=>{radio.checked=(radio.value==='atmospheric')===staticEnabled;});
        if(!staticEnabled||document.hidden)return;
        drawNoise();
        if(!motion.matches)timer=setInterval(drawNoise,1000/noiseSettings.fps);
    }

    function setStatic(enabled){
        staticEnabled=!!enabled&&!!context;refreshNoise();
    }

    staticButton.addEventListener('click',()=>setStatic(!staticEnabled));
    motion.addEventListener('change',refreshNoise);
    document.addEventListener('visibilitychange',refreshNoise);
    window.addEventListener('pagehide',()=>{if(timer!==null)clearInterval(timer);timer=null;});
    window.addEventListener('pageshow',refreshNoise);
    window.addEventListener('resize',()=>{apps.forEach(fit);resizeNoise();});
    resizeNoise();
    refreshNoise();
    
})();