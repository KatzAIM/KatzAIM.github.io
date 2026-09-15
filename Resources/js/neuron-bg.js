// neuron-bg.js
// Interactive Background for KatzAIM
(function() {
    // Configuration
    const CONFIG = {
        dotRadius: 2,
        dotColor: 'rgba(13, 41, 89, 0.4)',       
        activeColor: 'rgba(13, 41, 89, 0.4)',    
        lineColor: 'rgba(13, 41, 89, 0.4)',      
        mouseConnectionRadius: 150,              // Radius for faint connection lines
        mouseTriggerRadius: 40,                  // Must get close to trigger strike
        nodeSpacing: 80,                         
        lightningSpeed: 1000,                    
        holdFrames: 3,                           
        lightningFadeSpeed: 0.05,                
        fireBranches: [1, 1],                    
    };

    // Setup Canvas
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.zIndex = '-1';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width, height;
    let nodes = [];
    let lightnings = [];
    
    let canvasTop = 0;

    // Mouse Tracking
    let mouse = { x: -1000, y: -1000 };
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.pageX;
        mouse.y = e.pageY - canvasTop;
    }, { passive: true });

    // Resize Handling
    function resize() {
        width = document.documentElement.clientWidth;
        
        const header = document.querySelector('header');
        const missionSection = document.querySelector('.section'); 
        
        canvasTop = header ? header.offsetHeight : 0;
        const bottomEdge = missionSection ? missionSection.offsetTop : window.innerHeight;
        
        height = Math.max(0, bottomEdge - canvasTop);
        canvas.style.top = canvasTop + 'px';
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);
        initNodes();
    }

    const observer = new ResizeObserver(() => {
        resize();
    });
    observer.observe(document.body);
    
    window.addEventListener('resize', () => {
        resize();
    });

    // Node Class
    class Node {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.fired = false; 
            this.neighbors = [];
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, CONFIG.dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = this.fired ? CONFIG.activeColor : CONFIG.dotColor;
            ctx.fill();
        }
    }

    // Lightning Line Class
    class Lightning {
        constructor(source, target, branchesToSpawn = 1) {
            this.source = { x: source.x, y: source.y };
            this.target = target;
            this.branchesToSpawn = branchesToSpawn;
            
            this.distance = Math.hypot(target.x - source.x, target.y - source.y);
            this.angle = Math.atan2(target.y - source.y, target.x - source.x);
            
            const offset = (Math.random() - 0.5) * this.distance * 0.3;
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            this.midX = midX + Math.cos(this.angle + Math.PI / 2) * offset;
            this.midY = midY + Math.sin(this.angle + Math.PI / 2) * offset;
            
            this.progress = 0; 
            this.state = 'growing'; // 'growing' -> 'holding' -> 'fading'
            this.holdTimer = CONFIG.holdFrames;
            this.opacity = 0.4;
        }

        update() {
            if (this.state === 'growing') {
                this.progress += CONFIG.lightningSpeed;
                if (this.progress >= this.distance) {
                    this.progress = this.distance;
                    this.state = 'holding';
                    triggerNode(this.target, this.branchesToSpawn);
                }
            } else if (this.state === 'holding') {
                this.holdTimer--;
                if (this.holdTimer <= 0) {
                    this.state = 'fading';
                }
            } else {
                this.opacity -= CONFIG.lightningFadeSpeed;
            }
        }

        draw() {
            if (this.opacity <= 0) return;

            ctx.beginPath();
            ctx.moveTo(this.source.x, this.source.y);
            
            const currentDistance = Math.min(this.progress, this.distance);
            const halfDist = this.distance / 2;

            if (currentDistance > halfDist) {
                ctx.lineTo(this.midX, this.midY);
                const ratio = (currentDistance - halfDist) / halfDist;
                const endX = this.midX + (this.target.x - this.midX) * ratio;
                const endY = this.midY + (this.target.y - this.midY) * ratio;
                ctx.lineTo(endX, endY);
            } else {
                const ratio = currentDistance / halfDist;
                const endX = this.source.x + (this.midX - this.source.x) * ratio;
                const endY = this.source.y + (this.midY - this.source.y) * ratio;
                ctx.lineTo(endX, endY);
            }

            ctx.strokeStyle = `rgba(13, 41, 89, ${this.opacity})`;
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
    }

    function initNodes() {
        nodes = [];
        lightnings = [];
        
        const cols = Math.floor(width / CONFIG.nodeSpacing) + 2;
        const rows = Math.floor(height / CONFIG.nodeSpacing) + 2;
        
        for (let i = -1; i < cols; i++) {
            for (let j = -1; j < rows; j++) {
                const x = i * CONFIG.nodeSpacing + (Math.random() - 0.5) * CONFIG.nodeSpacing * 0.8;
                const y = j * CONFIG.nodeSpacing + (Math.random() - 0.5) * CONFIG.nodeSpacing * 0.8;
                nodes.push(new Node(x, y));
            }
        }

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const distances = [];
            for (let j = 0; j < nodes.length; j++) {
                if (i === j) continue;
                const other = nodes[j];
                const dx = node.x - other.x;
                const dy = node.y - other.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < (CONFIG.nodeSpacing * 2.5) ** 2) {
                    distances.push({ node: other, distSq });
                }
            }
            distances.sort((a, b) => a.distSq - b.distSq);
            node.neighbors = distances.slice(0, 8).map(d => d.node);
        }
    }

    function triggerNode(sourceNode, numBranches = 1) {
        if (numBranches <= 0) return;
        
        const unfiredNeighbors = sourceNode.neighbors.filter(n => !n.fired);
        
        for (let i = unfiredNeighbors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [unfiredNeighbors[i], unfiredNeighbors[j]] = [unfiredNeighbors[j], unfiredNeighbors[i]];
        }

        const targets = unfiredNeighbors.slice(0, numBranches);
        for (const target of targets) {
            target.fired = true; 
            lightnings.push(new Lightning(sourceNode, target, 1));
        }
    }

    function checkMouseTrigger() {
        const activeCount = lightnings.filter(l => l.state !== 'fading').length;
        if (activeCount >= 2) return; 
        
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (!node.fired) {
                const dx = node.x - mouse.x;
                const dy = node.y - mouse.y;
                if (dx * dx + dy * dy < CONFIG.mouseTriggerRadius * CONFIG.mouseTriggerRadius) {
                    // Guaranteed trigger when getting very close
                    node.fired = true; 
                    lightnings.push(new Lightning({x: mouse.x, y: mouse.y}, node, 2 - activeCount));
                    return;
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        checkMouseTrigger();

        if (lightnings.length === 0) {
            let hasFiredNodes = false;
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].fired) {
                    nodes[i].fired = false;
                    hasFiredNodes = true;
                }
            }
            if (hasFiredNodes) {
                mouse.x = -1000;
                mouse.y = -1000;
            }
        }

        // Draw faint connections from mouse to nearby nodes
        if (mouse.x > -1000 && mouse.y > -1000 && mouse.y < height && mouse.y > 0) {
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const dx = node.x - mouse.x;
                const dy = node.y - mouse.y;
                const distSq = dx * dx + dy * dy;
                
                if (distSq < CONFIG.mouseConnectionRadius * CONFIG.mouseConnectionRadius) {
                    const dist = Math.sqrt(distSq);
                    // Fade opacity based on distance (closer = more opaque, up to 0.2)
                    const opacity = 0.2 * (1 - dist / CONFIG.mouseConnectionRadius);
                    ctx.beginPath();
                    ctx.moveTo(mouse.x, mouse.y);
                    ctx.lineTo(node.x, node.y);
                    ctx.strokeStyle = `rgba(13, 41, 89, ${opacity})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }

        for (let i = 0; i < nodes.length; i++) {
            nodes[i].draw();
        }

        for (let i = lightnings.length - 1; i >= 0; i--) {
            const l = lightnings[i];
            l.update();
            if (l.opacity <= 0) {
                lightnings.splice(i, 1);
            } else {
                l.draw();
            }
        }

        requestAnimationFrame(animate);
    }

    // Initialize
    resize();
    animate();
})();
