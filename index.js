
let scene,blur_screen, camera, rendertarget,renderer, plane, firstShader,secondShader,engine,world,tissue,blur_amount;

function generatePolyon(points){
    const shape = new THREE.Shape();
    const length = points.length;
    for (let i = 0; i < length; i++) {
        const [x, y] = points[i];
        if (i === 0) {
            shape.moveTo(x, y);
        } else {
            shape.lineTo(x, y);
        }
    }
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({ color: 0x010101 , transparent: true});
    return new THREE.Mesh(geometry, material);
}


function cubicinterpolate(a, b, c, d, t) {
    const t2 = t * t;
    const a0 = d - c - a + b;
    const a1 = a - b - a0;
    const a2 = c - a;
    const a3 = b;
    return a0 * t * t2 + a1 * t2 + a2 * t + a3;
}

function coordinatesFromOffset(offsets) {
    const length = offsets.length;
    const angle = 2 * Math.PI / length;
    let points = Array(length);
    for (let i = 0; i < length; i++) {
        const x = Math.cos(angle * i) * offsets[i];
        const y = Math.sin(angle * i) * offsets[i];
        points[i] = [x, y];
    }
    return points;
}

function generateRandomOffsets(length,base) {
    const offsets = Array(length);
    // generate random points to interpolate
    const main_offsets = Array(Math.floor(length / 40));
    for (let i = 0; i < main_offsets.length; i++) {
        main_offsets[i] = Math.random()*(base/2);
    }
    let sampforoffset=Math.floor(length/main_offsets.length)
    // interpolate between the random points
    for (let i = 0;i<main_offsets.length;i++){
        for (let j = 0; j < sampforoffset; j++) {
            const t = j / sampforoffset;
            offsets[i * sampforoffset + j] = cubicinterpolate(main_offsets[(i - 1 + main_offsets.length) % main_offsets.length], main_offsets[i], main_offsets[(i + 1) % main_offsets.length], main_offsets[(i + 2) % main_offsets.length], t)+ base;
        }
    
    }
    return offsets;
}

function generateTissue() {

    if (tissue) {
        scene.remove(tissue.polygon);
        Matter.World.remove(world, tissue.polygonBody);
    }
    let mag=transformPoint2Casette(new THREE.Vector2(1.0,1.0)).length();
    offset_array=generateRandomOffsets(400,(Math.random()*0.2+1.0)*mag/20.0);
    polygon_points = coordinatesFromOffset(offset_array);
    
    polygon = generatePolyon(polygon_points);
    polygon.position.z = -1;
    scene.add(polygon);
    let verts=[];
    for (let i = 0; i < polygon_points.length; i++) {
        verts.push({ x: polygon_points[i][0], y: polygon_points[i][1] });
    }

    //let polygonBody = Matter.Bodies.polygon(0, 0, polygon_points.length, 50, { isStatic: false });
    var polygonBody = Matter.Body.create({
        position: { x: 0, y: 0 },
        vertices: verts,
        isStatic: false
    });
    Matter.World.add(world, polygonBody);
    // mouse control
    let mouse = Matter.Mouse.create(renderer.domElement);
    let mouseConstraint = Matter.MouseConstraint.create(engine, { mouse: mouse });
    Matter.World.add(world, mouseConstraint);
    // drag polygon
    Matter.Events.on(mouseConstraint, 'mousedown', function(event) {
        //Matter.Body.setVelocity(polygonBody, { x: -Math.min(Math.max(-mouse.position.x+window.innerWidth/2.0,-10.0),10.0), y: Math.min(Math.max(-mouse.position.y+window.innerHeight/2.0,-10.0),10.0) });
        //Matter.Body.setVelocity(polygonBody, { x: (Math.random()-.5)*30.0, y: (Math.random()-0.5)*10.0 });
        // apply force
        Matter.Body.applyForce(polygonBody, { x: 0, y: 0 }, { x:(Math.random()-.5)*1.5, y: (Math.random()-.5)*1.0 });
        //Matter.Body.setAngularVelocity(polygonBody, (Math.random()-.5)*0.2);
        //Matter.Body.setPosition(polygonBody, { x: mouse.position.x-window.innerWidth/2, y: window.innerHeight/2-mouse.position.y });
    });
    tissue={polygon:polygon,polygonBody:polygonBody};
}

function transformPoint2Casette(pt){   
    let change=0.75;
    let aspect = window.innerWidth/window.innerHeight;
    console.log(pt);
    if (aspect > change) {
        pt.x = pt.x/aspect;
    } else {
        pt.x = pt.x/change;
        pt.y = pt.y/change;
        pt.y = pt.y*aspect;
    }
    pt.x=pt.x*window.innerWidth;
    pt.y=pt.y*window.innerHeight;
    return pt;
}

function transformCassette2Pixel(pt){
    let change=0.75;
    let aspect = window.innerWidth/window.innerHeight;
    if (aspect > change) {
        pt.x = pt.x*aspect/window.innerWidth;
        pt.y = pt.y/window.innerHeight;
    } else {
        pt.x = pt.x*change/window.innerWidth;
        pt.y = pt.y*change/window.innerHeight;
        pt.y = pt.y/aspect;
    }
    return pt;
}

function setupTHREE() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // 3. Create a plane to render the blurred texture
    blur_screen = new THREE.Scene();
    blur_screen.background = new THREE.Color(0xffffff);
    const quadGeometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight); // Fullscreen quad
    const quad = new THREE.Mesh(quadGeometry, secondShader);
    blur_screen.add(quad);

    camera = new THREE.OrthographicCamera(
            window.innerWidth / -2, window.innerWidth / 2,
            window.innerHeight / 2, window.innerHeight / -2,
                0.1, 10
        );
    renderer = new THREE.WebGLRenderer({antialias: true});
    rendertarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

    renderer.setSize(window.innerWidth, window.innerHeight);
    // antialiasing not working
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
    camera.position.z = 1;
}

function setupPhysics() {
    engine = Matter.Engine.create();
    world = engine.world;
    world.gravity.y = -9.8;
}

async function loadShader(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load shader: ${url}`);
    }
    return await response.text();
}

async function loadShaders() {
    const vertexShader = `varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
    const firstPassFrag = await loadShader('firstpass.fs');
    const secondPassFrag = await loadShader('secondpass.fs');
    return { vertexShader, firstPassFrag , secondPassFrag};
}

function resize() {
    const aspect = window.innerWidth / window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.updateProjectionMatrix();
    camera.aspect = aspect;
    location.reload();
}
window.addEventListener('resize', resize);


async function init() {
    
        setupTHREE();
        setupPhysics();

        // 2. Load the textures
        const textureLoader = new THREE.TextureLoader();
        const casette = textureLoader.load('resources/tissuecaset.png');
        // 3. Write the shader code
        const { vertexShader, firstPassFrag,secondPassFrag } = await loadShaders();

        // 4. Create a firstShader
        firstShader = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: firstPassFrag,
            uniforms: {
                uTexture1: { value: casette },
                uTime: { value: 0.0 },
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            transparent: true,
            blending: THREE.NormalBlending
        });

        secondShader = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: secondPassFrag,
            uniforms: {
                uTexture: { value: rendertarget.texture },
                uTime: { value: 0.0 },
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                uBlurAmount: { value: blur_amount }
            },
            transparent: true,
            blending: THREE.NormalBlending
        });

        blur_screen.children[0].material = secondShader;
        blur_amount=0.3;



        
        wall_points=[[416,73],[414,1952],[1633,1952],[1621,95]]
        wall_object_points=Array(wall_points.length);
        for (let i = 0; i < wall_points.length; i++) {
            let pt = new THREE.Vector2((wall_points[i][0])/2048-0.5,(-wall_points[i][1])/2048+0.5);
            wall_object_points[i] = transformPoint2Casette(pt);   
        
        }
        for (let i = 0; i < wall_points.length-1; i++) {
            let wall_pos=[wall_object_points[i].x,wall_object_points[i].y];
            let wall_width=wall_object_points[(i + 1) % wall_object_points.length].x-wall_object_points[i].x+5.0;
            let wall_height=wall_object_points[(i + 1) % wall_object_points.length].y-wall_object_points[i].y+5.0;
            let wall = Matter.Bodies.rectangle(wall_pos[0],wall_pos[1], wall_width*2.5, wall_height*2.5, { isStatic: true });
            Matter.World.add(world, wall);
        }
        // draw the lines between the points
        generateTissue();
        document.getElementById("cornerButton").addEventListener("click", function(){ generateTissue(); });
        document.getElementById("topBar").addEventListener("click", function(){ generateTissue(); });

        // constrain the polygon to the screen


        // add plane to physics
       //let planeBody = Matter.Bodies.rectangle(0, 0, window.innerWidth, window.innerHeight, { isStatic: true });
        //Matter.World.add(world, planeBody);



        function onMouseMove(event) {
            // Calculate the normalized device coordinates (NDC) of the mouse position
            let mouse = new THREE.Vector2();
            
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            // Update the position of the polygon based on the mouse position
            polygon.position.x = mouse.x*window.innerWidth/2;
            polygon.position.y = mouse.y * window.innerHeight/2;
        }

        function onTouchMove(event) {
            let touch = event.touches[0];
            let mouse = new THREE.Vector2();
            mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
            polygon.position.x = mouse.x*window.innerWidth/2;
            polygon.position.y = mouse.y * window.innerHeight/2;
        }

        //window.addEventListener('mousemove', onMouseMove);
        //window.addEventListener('touchmove', onTouchMove);



        
        // 5. Create a plane mesh and add it to the scene
        // The plane should be as wide as the window

        const geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);
        plane = new THREE.Mesh(geometry, firstShader);
        scene.add(plane);

        // Position the camera
        camera.position.z = 1;

        // render matter.js objects

        // Render the scene
        function animate() {
            requestAnimationFrame(animate);
            firstShader.uniforms.uTime.value += 0.01;
            secondShader.uniforms.uTime.value += 0.01;
            // animate circle with mouse 
            Matter.Engine.update(engine, 200 / 60);

            // update the alpha of the tissue
            if (tissue) {
                tissue.polygon.material.opacity = Math.max(0.1, tissue.polygon.material.opacity - 0.0001);
            }

            tissue.polygon.position.x = tissue.polygonBody.position.x;
            tissue.polygon.position.y = tissue.polygonBody.position.y;
            tissue.polygon.rotation.z = tissue.polygonBody.angle;
            
            renderer.setRenderTarget(rendertarget);
            renderer.render(scene, camera);
            secondShader.uniforms.uTexture.value = rendertarget.texture;
            secondShader.uniforms.uBlurAmount.value = blur_amount;
            renderer.setRenderTarget(null);
            renderer.render(blur_screen, camera);
        }
        animate();

    }

init();