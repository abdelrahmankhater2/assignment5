
/* Particle Globe Animation*/
class ParticleGlobe {
            constructor() {
                this.scene = null;
                this.camera = null;
                this.renderer = null;
                this.particleSystem = null;
                
                this.mouse = { x: 0, y: 0 };
                this.targetMouse = { x: 0, y: 0 };
                this.mouseActive = false;
                this.mouseTimeout = null;
                
                this.uniforms = {
                    time: { value: 0 },
                    mouseInfluence: { value: 0 },
                    mousePosition: { value: new THREE.Vector2(0, 0) },
                    disintegration: { value: 0 },
                    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
                };
                
                this.clock = new THREE.Clock();
                this.isInitialized = false;
                this.animationId = null;
                
                this.init();
            }
            // Initialize the particle globe
            init() {
                this.setupScene();
                this.createParticleSystem();
                this.setupEventListeners();
                this.animate();
                this.isInitialized = true;
            }
            // Setup the Three.js scene, camera, and renderer
            setupScene() {
                this.scene = new THREE.Scene();
                
                this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
                this.camera.position.z = 150;
                
                const canvas = document.getElementById('three-canvas');
                this.renderer = new THREE.WebGLRenderer({ 
                    canvas: canvas,
                    antialias: true,
                    alpha: true 
                });
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                this.renderer.setClearColor(0x000000, 1);
            }
            // Create the particle system with custom shaders
            createParticleSystem() {
                const particleCount = Math.min(12000, window.innerWidth * 3);
                const radius = 50;
                
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(particleCount * 3);
                const originalPositions = new Float32Array(particleCount * 3);
                const random = new Float32Array(particleCount);
                
                for (let i = 0; i < particleCount; i++) {
                    const phi = Math.acos(-1 + (2 * i) / particleCount);
                    const theta = Math.sqrt(particleCount * Math.PI) * phi;
                    
                    const x = radius * Math.cos(theta) * Math.sin(phi);
                    const y = radius * Math.sin(theta) * Math.sin(phi);
                    const z = radius * Math.cos(phi);
                    
                    positions[i * 3] = x;
                    positions[i * 3 + 1] = y;
                    positions[i * 3 + 2] = z;
                    
                    originalPositions[i * 3] = x;
                    originalPositions[i * 3 + 1] = y;
                    originalPositions[i * 3 + 2] = z;
                    
                    random[i] = Math.random();
                }
                // Create the buffer attributes for the geometry
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.setAttribute('originalPosition', new THREE.BufferAttribute(originalPositions, 3));
                geometry.setAttribute('random', new THREE.BufferAttribute(random, 1));
                // Create the shader material with uniforms and shaders
                const vertexShader = `
                    uniform float time;
                    uniform float mouseInfluence;
                    uniform vec2 mousePosition;
                    uniform float disintegration;
                    uniform vec2 resolution;
                    
                    attribute vec3 originalPosition;
                    attribute float random;
                    
                    varying float vRandom;
                    varying float vDistance;
                    varying vec3 vOriginalPosition;
                    varying vec3 vWorldPosition;
                    varying vec2 vScreenPosition;
                    
                    float noise(vec3 pos) {
                        return fract(sin(dot(pos.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
                    }
                    
                    void main() {
                        vRandom = random;
                        vOriginalPosition = originalPosition;
                        
                        vec3 pos = originalPosition;
                        
                        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
                        vWorldPosition = worldPos.xyz;
                        
                        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                        
                        vec4 screenPos = projectionMatrix * mvPosition;
                        vScreenPosition = screenPos.xy / screenPos.w;
                        
                        float mouseDistance = distance(vScreenPosition, mousePosition);
                        vDistance = mouseDistance;
                        
                        if (mouseInfluence > 0.2) {
                            float influenceRadius = 0.8;
                            float influence = smoothstep(influenceRadius, 0.0, mouseDistance) * mouseInfluence;
                            
                            float wave = sin(mouseDistance * 15.0 - time * 8.0) * 0.5 + 0.5;
                            influence *= (0.7 + wave * 0.3);
                            
                            vec3 scatterDirection = normalize(pos + vec3(
                                noise(pos + time * 0.2) * 0.1,
                                noise(pos.yzx + time * 0.25) * 0.1,
                                noise(pos.zxy + time * 0.15) * 0.1
                            ));
                            
                            pos += scatterDirection * influence * 10.0 * (0.5 + random * 0.5);
                            
                            vec2 mouseDir = normalize(vScreenPosition - mousePosition);
                            pos += vec3(mouseDir * influence * 5.0, 0.0);
                        }
                        
                        if (disintegration > 0.05) {
                            vec3 noiseOffset = vec3(
                                noise(originalPosition + time * 0.1) * 2.0 - 1.0,
                                noise(originalPosition.yzx + time * 0.12) * 2.0 - 1.0,
                                noise(originalPosition.zxy + time * 0.08) * 2.0 - 1.0
                            );
                            
                            pos += noiseOffset * disintegration * 6.0 * (0.8 + random * 0.4);
                        }
                        
                        float rotationSpeed = 0.05;
                        float cosY = cos(time * rotationSpeed);
                        float sinY = sin(time * rotationSpeed);
                        
                        pos = vec3(
                            pos.x * cosY - pos.z * sinY,
                            pos.y,
                            pos.x * sinY + pos.z * cosY
                        );
                        
                        mvPosition = modelViewMatrix * vec4(pos, 1.0);
                        gl_Position = projectionMatrix * mvPosition;
                        
                        float size = 0.8 + random * 0.4;
                        if (mouseInfluence > 0.2 && mouseDistance < 0.8) {
                            float proximityEffect = smoothstep(0.8, 0.0, mouseDistance);
                            size *= (1.0 + proximityEffect * mouseInfluence * 0.8);
                        }
                        
                        float distanceFromCamera = length(mvPosition.xyz);
                        gl_PointSize = size * (200.0 / max(distanceFromCamera, 1.0));
                    }
                `;
                // Fragment shader for the particle system
                const fragmentShader = `
                    uniform float time;
                    uniform float mouseInfluence;
                    uniform vec2 mousePosition;
                    uniform vec2 resolution;
                    
                    varying float vRandom;
                    varying float vDistance;
                    varying vec3 vOriginalPosition;
                    varying vec3 vWorldPosition;
                    varying vec2 vScreenPosition;
                    
                    vec3 baseColor = vec3(0.85, 0.9, 1.0);
                    vec3 hoverColor1 = vec3(0.3, 0.8, 1.0);
                    vec3 hoverColor2 = vec3(1.0, 0.4, 0.8);
                    vec3 hoverColor3 = vec3(0.8, 1.0, 0.3);
                    
                    void main() {
                        vec2 center = gl_PointCoord - 0.5;
                        float dist = length(center);
                        
                        if (dist > 0.5) discard;
                        
                        float alpha = 1.0 - smoothstep(0.1, 0.5, dist);
                        
                        vec3 color = baseColor;
                        color += vec3(vRandom * 0.03);
                        
                        if (mouseInfluence > 0.1) {
                            float mouseDistance = distance(vScreenPosition, mousePosition);
                            
                            float ring1 = smoothstep(0.7, 0.0, mouseDistance);
                            float ring2 = smoothstep(0.5, 0.0, mouseDistance);
                            float ring3 = smoothstep(0.3, 0.0, mouseDistance);
                            
                            float wave1 = sin(mouseDistance * 20.0 - time * 6.0) * 0.5 + 0.5;
                            float wave2 = sin(mouseDistance * 15.0 - time * 8.0 + 2.0) * 0.5 + 0.5;
                            float wave3 = sin(mouseDistance * 25.0 - time * 4.0 + 4.0) * 0.5 + 0.5;
                            
                            vec3 interactiveColor = baseColor;
                            
                            if (ring1 > 0.1) {
                                float strength = ring1 * mouseInfluence * (0.6 + wave1 * 0.4);
                                interactiveColor = mix(interactiveColor, hoverColor1, strength * 0.7);
                                alpha += strength * 0.3;
                            }
                            
                            if (ring2 > 0.1) {
                                float strength = ring2 * mouseInfluence * (0.7 + wave2 * 0.3);
                                interactiveColor = mix(interactiveColor, hoverColor2, strength * 0.6);
                                alpha += strength * 0.4;
                            }
                            
                            if (ring3 > 0.1) {
                                float strength = ring3 * mouseInfluence * (0.8 + wave3 * 0.2);
                                interactiveColor = mix(interactiveColor, hoverColor3, strength * 0.8);
                                alpha += strength * 0.5;
                            }
                            
                            color = interactiveColor;
                            
                            if (mouseDistance < 0.2) {
                                float closeGlow = (1.0 - mouseDistance / 0.2) * mouseInfluence;
                                color += vec3(1.0, 1.0, 1.0) * closeGlow * 0.3;
                                alpha += closeGlow * 0.4;
                            }
                        }
                        
                        float twinkle = sin(time * 1.2 + vRandom * 8.0) * 0.03 + 0.97;
                        alpha *= twinkle;
                        alpha = min(alpha, 1.0);
                        
                        gl_FragColor = vec4(color, alpha * 0.8);
                    }
                `;
                // Create the shader material with uniforms and shaders
                const material = new THREE.ShaderMaterial({
                    uniforms: this.uniforms,
                    vertexShader: vertexShader,
                    fragmentShader: fragmentShader,
                    blending: THREE.AdditiveBlending,
                    depthTest: false,
                    transparent: true,
                    vertexColors: false
                });
                // Create the particle system and add it to the scene
                this.particleSystem = new THREE.Points(geometry, material);
                this.scene.add(this.particleSystem);
            }
            // Setup event listeners for mouse movement and window resize
            setupEventListeners() {
                const handleMouseMove = (event) => {
                    this.targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                    this.targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
                    
                    this.mouseActive = true;
                    
                    if (this.mouseTimeout) {
                        clearTimeout(this.mouseTimeout);
                    }
                    
                    this.mouseTimeout = setTimeout(() => {
                        this.mouseActive = false;
                    }, 2500);
                };
                // Add event listeners for mouse and touch movements
                document.addEventListener('mousemove', handleMouseMove, { passive: true });
                
                document.addEventListener('touchmove', (event) => {
                    if (event.touches.length > 0) {
                        const touch = event.touches[0];
                        handleMouseMove({
                            clientX: touch.clientX,
                            clientY: touch.clientY
                        });
                    }
                }, { passive: true });
                
                window.addEventListener('resize', () => {
                    this.camera.aspect = window.innerWidth / window.innerHeight;
                    this.camera.updateProjectionMatrix();
                    this.renderer.setSize(window.innerWidth, window.innerHeight);
                    this.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
                });
            }
            // Main animation loop
            animate() {
                this.animationId = requestAnimationFrame(() => this.animate());
                
                if (!this.isInitialized) return;
                
                const elapsedTime = this.clock.getElapsedTime();
                
                this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.08;
                this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.08;
                
                this.uniforms.time.value = elapsedTime;
                this.uniforms.mousePosition.value.set(this.mouse.x, this.mouse.y);
                
                const targetInfluence = this.mouseActive ? 1.0 : 0.0;
                this.uniforms.mouseInfluence.value += (targetInfluence - this.uniforms.mouseInfluence.value) * 0.04;
                
                const targetDisintegration = this.mouseActive ? 0.15 : 0.0;
                this.uniforms.disintegration.value += (targetDisintegration - this.uniforms.disintegration.value) * 0.005;
                
                this.renderer.render(this.scene, this.camera);
            }
            // Clean up resources when the particle globe is no longer needed
            destroy() {
                if (this.animationId) {
                    cancelAnimationFrame(this.animationId);
                }
                if (this.renderer) {
                    this.renderer.dispose();
                }
                if (this.particleSystem) {
                    this.scene.remove(this.particleSystem);
                }
            }
        }

        // Main initialization
        document.addEventListener('DOMContentLoaded', function() {
            let particleGlobe = null;

            // Create starfield
            function createStarfield() {
                const starfield = document.getElementById('starfield');
                const numStars = 80;
                
                for (let i = 0; i < numStars; i++) {
                    const star = document.createElement('div');
                    star.className = 'star';
                    
                    star.style.left = Math.random() * 100 + '%';
                    star.style.top = Math.random() * 100 + '%';
                    
                    const sizeRandom = Math.random();
                    if (sizeRandom < 0.85) {
                        star.classList.add('size-1');
                    } else if (sizeRandom < 0.95) {
                        star.classList.add('size-2');
                    } else {
                        star.classList.add('size-3');
                    }
                    
                    const behaviorRandom = Math.random();
                    if (behaviorRandom < 0.05) {
                        star.classList.add('moving');
                    } else if (behaviorRandom < 0.08) {
                        star.classList.add('bright');
                    }
                    
                    star.style.animationDelay = Math.random() * 20 + 's';
                    star.style.animationDuration = (Math.random() * 8 + 8) + 's';
                    
                    starfield.appendChild(star);
                }
            }
            // Initialize the starfield
            createStarfield();

            // Page navigation
            function showPage(pageId) {
                document.querySelectorAll('.page').forEach(page => {
                    page.classList.remove('active');
                });
                // Hide all pages
                document.getElementById(pageId + '-page').classList.add('active');
                
                const canvasContainer = document.getElementById('canvas-container');
                const starfield = document.getElementById('starfield');
                
                if (pageId === 'home') {
                    canvasContainer.classList.add('active');
                    starfield.style.display = 'none';
                    if (!particleGlobe) {
                        particleGlobe = new ParticleGlobe();
                    }
                } else {
                    canvasContainer.classList.remove('active');
                    starfield.style.display = 'block';
                    if (particleGlobe) {
                        particleGlobe.destroy();
                        particleGlobe = null;
                    }
                }
                // Update active navigation link
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
                
                const mainElements = document.querySelectorAll('main');
                mainElements.forEach(main => {
                    if (pageId === 'home') {
                        main.classList.add('page-home');
                    } else {
                        main.classList.remove('page-home');
                    }
                });
            }
            // Show the home page by default
            showPage('home');

            // Navigation
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const page = this.getAttribute('data-page');
                    showPage(page);
                });
            });

            // Profile image hover effect
            const landingImage = document.querySelector('.landing-hero img');
            if (landingImage) {
                const originalSrc = 'images/clean.jpg';
                const hoverSrc = 'images/messy.jpg';

                const preloadHoverImage = new Image();
                preloadHoverImage.src = hoverSrc;
                
                preloadHoverImage.onload = function() {
                    landingImage.addEventListener('mouseenter', function() {
                        this.src = hoverSrc;
                    });
                    
                    landingImage.addEventListener('mouseleave', function() {
                        this.src = originalSrc;
                    });
                };
            }

            // Typing effect
            const typedTextSpan = document.getElementById('job-title-typed');
            if (typedTextSpan) {
                const textArray = [
                    "Software Engineer", 
                    "Graphic Designer", 
                    "Problem Solver",
                    "Tech Enthusiast"
                ];
                const typingDelay = 100;
                const erasingDelay = 50;
                const newTextDelay = 2000;
                let textArrayIndex = 0;
                let charIndex = 0;
                // Function to type the text
                function type() {
                    if (charIndex < textArray[textArrayIndex].length) {
                        typedTextSpan.textContent += textArray[textArrayIndex].charAt(charIndex);
                        charIndex++;
                        setTimeout(type, typingDelay);
                    } else {
                        setTimeout(erase, newTextDelay);
                    }
                }
                // Function to erase the text
                function erase() {
                    if (charIndex > 0) {
                        typedTextSpan.textContent = textArray[textArrayIndex].substring(0, charIndex - 1);
                        charIndex--;
                        setTimeout(erase, erasingDelay);
                    } else {
                        textArrayIndex++;
                        if (textArrayIndex >= textArray.length) textArrayIndex = 0;
                        setTimeout(type, typingDelay + 500);
                    }
                }

                setTimeout(type, newTextDelay / 2);
            }

            // Interactive functionality
            function toggleCollapsible(content) {
                content.classList.toggle('expanded');
            }

            // Content sections click to reveal
            document.querySelectorAll('.content-section h2').forEach(heading => {
                heading.addEventListener('click', function() {
                    const content = this.nextElementSibling;
                    if (content && content.classList.contains('collapsible-content')) {
                        toggleCollapsible(content);
                        
                        this.style.transform = 'scale(0.98)';
                        setTimeout(() => {
                            this.style.transform = '';
                        }, 150);
                    }
                });
            });

            // Project cards click to reveal
            document.querySelectorAll('.project-card').forEach(card => {
                const heading = card.querySelector('h3');
                const details = card.querySelector('.project-details');
                
                if (heading && details) {
                    card.addEventListener('click', function(e) {
                        if (e.target.tagName === 'A') return;
                        toggleCollapsible(details);
                        
                        this.style.transform = 'scale(0.98)';
                        setTimeout(() => {
                            this.style.transform = '';
                        }, 150);
                    });
                }
            });

            // Navigation icon hover effects
            const iconHoverEffects = [
                { id: 'home-icon-img', original: 'images/home.png', hover: 'images/home-open.png' },
                { id: 'about-icon-img', original: 'images/me.png', hover: 'images/me-2.png' },
                { id: 'contact-icon-img', original: 'images/contact.png', hover: 'images/contact-open.png' }
            ];
            //  Preload hover icons and add hover effects
            iconHoverEffects.forEach(effect => {
                const iconImage = document.getElementById(effect.id);
                if (iconImage) {
                    const preloadHoverIcon = new Image();
                    preloadHoverIcon.src = effect.hover;

                    preloadHoverIcon.onload = function() {
                        iconImage.addEventListener('mouseenter', function() {
                            this.src = effect.hover;
                        });
                        iconImage.addEventListener('mouseleave', function() {
                            this.src = effect.original;
                        });
                    };
                }
            });

            // Custom Cursor
            const cursor = document.getElementById('cursor');
            let mouseX = 0;
            let mouseY = 0;
            let cursorX = 0;
            let cursorY = 0;
            // Initialize cursor position
            document.addEventListener('mousemove', (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;
            });
            // Animate cursor movement 
            function animateCursor() {
                const delay = 0.1;
                cursorX += (mouseX - cursorX) * delay;
                cursorY += (mouseY - cursorY) * delay;
                
                cursor.style.left = cursorX + 'px';
                cursor.style.top = cursorY + 'px';
                
                requestAnimationFrame(animateCursor);
            }
            animateCursor();

            // Hover effects for cursor
            const interactiveElements = document.querySelectorAll(
                'a, button, .nav-link, .tech-stack-icons a, .project-card, .content-section h2, input, textarea, .terminal-suggestion, .terminal-btn, .terminal-link, .artwork-item'
            );
            // Add hover effects to interactive elements
            interactiveElements.forEach(element => {
                element.addEventListener('mouseenter', () => {
                    cursor.classList.add('hover');
                });
                
                element.addEventListener('mouseleave', () => {
                    cursor.classList.remove('hover');
                });
            });
            // Click effects for cursor
            document.addEventListener('mousedown', () => {
                cursor.classList.add('click');
            });
            // Remove click effect on mouse up
            document.addEventListener('mouseup', () => {
                cursor.classList.remove('click');
            });
            //  Hide cursor on mouse leave and show on mouse enter
            document.addEventListener('mouseleave', () => {
                cursor.style.opacity = '0';
            });
            // Show cursor on mouse enter
            document.addEventListener('mouseenter', () => {
                cursor.style.opacity = '1';
            });

            // Artwork lightbox and effects functionality
            const artworkItems = document.querySelectorAll('.artwork-item');
            const body = document.body;
            
            // Create lightbox modal
            const lightbox = document.createElement('div');
            lightbox.className = 'lightbox-modal';
            lightbox.innerHTML = `
                <div class="lightbox-content">
                    <button class="lightbox-close">&times;</button>
                    <img class="lightbox-image" src="" alt="">
                </div>
            `;
            body.appendChild(lightbox);
            
            const lightboxImage = lightbox.querySelector('.lightbox-image');
            const closeBtn = lightbox.querySelector('.lightbox-close');
            
            // Enhanced artwork interactions
            artworkItems.forEach(item => {
                // Simple hover effect
                item.addEventListener('mousemove', function(e) {
                    const rect = this.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    
                    const deltaX = (e.clientX - centerX) * 0.01;
                    const deltaY = (e.clientY - centerY) * 0.01;
                    
                    this.style.transform = `translateY(-8px) scale(1.02) translate(${deltaX}px, ${deltaY}px)`;
                });
                
                item.addEventListener('mouseleave', function() {
                    this.style.transform = '';
                });

                // Simple click to open lightbox
                item.addEventListener('click', function(e) {
                    const img = this.querySelector('.artwork-image');
                    if (img) {
                        lightboxImage.src = img.src;
                        lightboxImage.alt = img.alt;
                        lightbox.classList.add('active');
                        body.style.overflow = 'hidden';
                    }
                });
            });
            
            // Close lightbox function
            function closeLightbox() {
                lightbox.classList.remove('active');
                body.style.overflow = 'auto';
                setTimeout(() => {
                    if (!lightbox.classList.contains('active')) {
                        lightboxImage.src = '';
                    }
                }, 300);
            }
            // Add event listeners for closing the lightbox
            closeBtn.addEventListener('click', closeLightbox);
            
            lightbox.addEventListener('click', function(e) {
                if (e.target === lightbox) {
                    closeLightbox();
                }
            });
            // Close lightbox on Escape key press
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && lightbox.classList.contains('active')) {
                    closeLightbox();
                }
            });

            // Intersection Observer for staggered animations
            const observerOptions = {
                threshold: 0.1,
                rootMargin: '50px'
            };
            // Create an Intersection Observer to trigger animations when elements come into view
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.animationPlayState = 'running';
                    }
                });
            }, observerOptions);
            
            // Observe all artwork items for enhanced loading animations
            artworkItems.forEach(item => {
                item.style.animationPlayState = 'paused';
                observer.observe(item);
            });

            // OPTIMIZED Terminal functionality
            const terminalOutput = document.getElementById('terminal-output');
            const terminalInput = document.getElementById('terminal-input');
            let commandHistory = [];
            let historyIndex = -1;
            let isExecuting = false;
            // Function to handle terminal commands
            const commands = {
                help: {
                    execute: () => `
<span class="terminal-text info">╭─ AVAILABLE COMMANDS ─────────────────────────────────────╮</span>
<span class="terminal-text">│  <span class="terminal-text success">help</span>        Show this help message                     │</span>
<span class="terminal-text">│  <span class="terminal-text success">contact</span>     Display contact information                │</span>
<span class="terminal-text">│  <span class="terminal-text success">email</span>       Open email client                          │</span>
<span class="terminal-text">│  <span class="terminal-text success">linkedin</span>    Open LinkedIn profile                      │</span>
<span class="terminal-text">│  <span class="terminal-text success">github</span>      Open GitHub profile                        │</span>
<span class="terminal-text">│  <span class="terminal-text success">whoami</span>      About Abdelrahman                          │</span>
<span class="terminal-text">│  <span class="terminal-text success">skills</span>      List technical skills                      │</span>
<span class="terminal-text">│  <span class="terminal-text success">projects</span>    View recent projects                       │</span>
<span class="terminal-text">│  <span class="terminal-text success">clear</span>       Clear terminal screen                      │</span>
<span class="terminal-text info">╰──────────────────────────────────────────────────────────╯</span>`
                },
                // Function to display contact information
                contact: {
                    execute: () => `
<span class="terminal-text success">╭─ CONTACT INFORMATION ────────────────────────────────────╮</span>
<span class="terminal-text">│  📧 Email      <span class="terminal-link" onclick="window.open('mailto:aka7951@nyu.edu')">aka7951@nyu.edu</span>                      │</span>
<span class="terminal-text">│  💼 LinkedIn   <span class="terminal-link" onclick="window.open('https://www.linkedin.com/in/abdelrahmankhater/', '_blank')">linkedin.com/in/abdelrahman-khater</span>   │</span>
<span class="terminal-text">│  🐙 GitHub     <span class="terminal-link" onclick="window.open('https://github.com/abdelrahmankhater2', '_blank')">github.com/abdelrahmankhater2</span>        │</span>
<span class="terminal-text">│  📍 Location   Abu Dhabi, UAE                           │</span>
<span class="terminal-text success">╰──────────────────────────────────────────────────────────╯</span>`
                },
                // Function to open email client
                email: {
                    execute: () => {
                        window.open('mailto:aka7951@nyu.edu?subject=Hello from your portfolio!&body=Hi Abdelrahman,%0D%0A%0D%0AI found your portfolio and would love to connect!');
                        return `<span class="terminal-text success">📬 Email client opened successfully!</span>`;
                    }
                },
                // Function to open LinkedIn profile
                linkedin: {
                    execute: () => {
                        window.open('https://linkedin.com/in/abdelrahmankhater', '_blank');
                        return `<span class="terminal-text success">🔗 Opening LinkedIn profile...</span>`;
                    }
                },
                // Function to open GitHub profile
                github: {
                    execute: () => {
                        window.open('https://github.com/abdelrahmankhater2', '_blank');
                        return `<span class="terminal-text success">🐙 Opening GitHub profile...</span>`;
                    }
                },
                // Function to display personal information
                whoami: {
                    execute: () => `
<span class="terminal-text success">╭─ ABOUT ABDELRAHMAN KHATER ───────────────────────────────╮</span>
<span class="terminal-text">│  👨‍💻 Full-Stack Developer & UI/UX Designer              │</span>
<span class="terminal-text">│  🎓 Computer Science @ NYU (2021-2025)                  │</span>
<span class="terminal-text">│  📚 Minors: Interactive Media & Philosophy               │</span>
<span class="terminal-text">│  🌍 Based in Abu Dhabi, UAE                             │</span>
<span class="terminal-text success">╰──────────────────────────────────────────────────────────╯</span>`
                },
                // Function to display technical skills
                skills: {
                    execute: () => `
<span class="terminal-text success">╭─ TECHNICAL SKILLS ───────────────────────────────────────╮</span>
<span class="terminal-text">│  🔧 Languages: TypeScript • JavaScript • Python         │</span>
<span class="terminal-text">│  ⚛️  Frontend: React • Next.js • Tailwind CSS           │</span>
<span class="terminal-text">│  🖥️  Backend: Node.js • NestJS • Express.js             │</span>
<span class="terminal-text">│  🗄️  Database: PostgreSQL • Redis • MongoDB             │</span>
<span class="terminal-text">│  ☁️  Cloud: AWS • Docker • Kubernetes                   │</span>
<span class="terminal-text success">╰──────────────────────────────────────────────────────────╯</span>`
                },
                
                projects: {
                    execute: () => {
                        showPage('projects');
                        return '<span class="terminal-text success">🎯 Navigating to projects page...</span>';
                    }
                },
                
                clear: {
                    execute: () => {
                        setTimeout(() => {
                            terminalOutput.innerHTML = `
                                <div class="terminal-line">
                                    <span class="terminal-text success">Terminal cleared! 🧹</span>
                                </div>
                                <div class="terminal-line">
                                    <span class="terminal-text">Welcome back! Type 'help' for available commands.</span>
                                </div>
                                <div class="terminal-line">
                                    <span class="terminal-prompt">visitor@portfolio:~$</span>
                                    <span class="terminal-cursor">_</span>
                                </div>`;
                        }, 100);
                        return null;
                    }
                }
            };
            // Function to execute commands
            function executeCommand(input) {
                const command = input.trim().toLowerCase();

                if (commands[command]) {
                    return commands[command].execute();
                } else if (input.trim() === '') {
                    return null;
                } else {
                    return `<span class="terminal-text error">❌ Command not found: '${command}'</span>
<span class="terminal-text">💡 Type 'help' to see available commands</span>`;
                }
            }
            // Function to add output to the terminal
            function addOutput(content) {
                if (content === null) return;
                
                const outputLines = content.split('\n').filter(line => line.trim() !== '');
                const cursorLine = terminalOutput.querySelector('.terminal-cursor').parentElement;
                
                outputLines.forEach((line) => {
                    const div = document.createElement('div');
                    div.className = 'terminal-line';
                    div.innerHTML = line;
                    terminalOutput.insertBefore(div, cursorLine);
                });
                
                document.getElementById('terminal').scrollTop = document.getElementById('terminal').scrollHeight;
            }
            // Function to add command line to the terminal
            function addCommandLine(command) {
                const div = document.createElement('div');
                div.className = 'terminal-line';
                div.innerHTML = `<span class="terminal-prompt">visitor@portfolio:~$</span> <span class="terminal-text">${command}</span>`;
                
                const cursorLine = terminalOutput.querySelector('.terminal-cursor').parentElement;
                terminalOutput.insertBefore(div, cursorLine);
            }

            // Terminal input handling
            if (terminalInput) {
                terminalInput.addEventListener('keydown', (e) => {
                    if (isExecuting) return;

                    if (e.key === 'Enter') {
                        const command = terminalInput.value;
                        if (command.trim() !== '') {
                            isExecuting = true;
                            commandHistory.unshift(command);
                            historyIndex = -1;
                            
                            addCommandLine(command);
                            const output = executeCommand(command);
                            addOutput(output);
                            isExecuting = false;
                        }
                        terminalInput.value = '';
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (historyIndex < commandHistory.length - 1) {
                            historyIndex++;
                            terminalInput.value = commandHistory[historyIndex];
                        }
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (historyIndex > 0) {
                            historyIndex--;
                            terminalInput.value = commandHistory[historyIndex];
                        } else if (historyIndex === 0) {
                            historyIndex = -1;
                            terminalInput.value = '';
                        }
                    }
                });

                // Suggestion buttons
                document.querySelectorAll('.terminal-suggestion').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const command = btn.getAttribute('data-command');
                        terminalInput.value = command;
                        terminalInput.focus();
                        
                        if (['help', 'contact', 'clear', 'whoami', 'skills'].includes(command)) {
                            setTimeout(() => {
                                terminalInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
                            }, 100);
                        }
                    });
                });

                // Terminal controls
                document.querySelectorAll('.terminal-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        
                        if (btn.classList.contains('close')) {
                            const terminal = document.querySelector('.terminal-container');
                            terminal.style.transform = 'scale(0.8)';
                            terminal.style.opacity = '0.3';
                            setTimeout(() => {
                                terminal.style.transform = 'scale(1)';
                                terminal.style.opacity = '1';
                            }, 300);
                        }
                    });
                });

                // Keep input focused
                document.getElementById('terminal').addEventListener('click', () => {
                    terminalInput.focus();
                });
            }
        });