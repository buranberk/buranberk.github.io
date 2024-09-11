
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
    const main_offsets = Array(Math.floor(length / 40));
    for (let i = 0; i < main_offsets.length; i++) {
        main_offsets[i] = Math.random()*(base/2);
    }
    let sampforoffset=Math.floor(length/main_offsets.length)
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

    var polygonBody = Matter.Body.create({
        position: { x: 0, y: 0 },
        vertices: verts,
        isStatic: false
    });
    Matter.World.add(world, polygonBody);

    tissue={polygon:polygon,polygonBody:polygonBody,opacity:1.0};
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

    blur_screen = new THREE.Scene();
    blur_screen.background = new THREE.Color(0xffffff);
    const quadGeometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);
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

        const textureLoader = new THREE.TextureLoader();
        const casette = textureLoader.load('resources/tissuecaset.png');
        const { vertexShader, firstPassFrag,secondPassFrag } = await loadShaders();

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
        generateTissue();
        document.getElementById("generate-tissue").addEventListener("click", function(){ generateTissue(); });
        document.getElementById("move-tissue").addEventListener("click", function(){ Matter.Body.applyForce(tissue.polygonBody, { x: 0, y: 0 }, { x:(Math.random()-.5)*2.8, y: (Math.random()-.5)*1.0 }); });


        const geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);
        plane = new THREE.Mesh(geometry, firstShader);
        scene.add(plane);

        camera.position.z = 1;

        function animate() {
            
            firstShader.uniforms.uTime.value += 0.01;
            secondShader.uniforms.uTime.value += 0.01;

            Matter.Engine.update(engine, 200 / 60);


            if (tissue) {
                tissue.opacity = Math.max(0.3, tissue.opacity - 0.0003);
            }
            const opacity = document.getElementById("detected-opacity");

            opacity.innerHTML = "Şeffaflık: " +   Math.round((1-tissue.opacity) * 100) / 100;

            tissue.polygon.position.x = tissue.polygonBody.position.x;
            tissue.polygon.position.y = tissue.polygonBody.position.y;
            tissue.polygon.rotation.z = tissue.polygonBody.angle;

            const debug = document.getElementById("debug-1");
            if (debug.checked) {
                tissue.polygon.material.color.setHex(0xff0000);
                tissue.polygon.material.opacity = 1.0;
                tissue.polygon.material.transparent = false;
            }
            else {
                tissue.polygon.material.color.setHex(0x010101);
                tissue.polygon.material.opacity = tissue.opacity;
                tissue.polygon.material.transparent = true;
            }
            if (tissue.opacity <= 0.301) {
                document.getElementById("center-message").style.display = "block";
            }
            else {
                document.getElementById("center-message").style.display = "none";
            }
            renderer.setRenderTarget(rendertarget);
            renderer.render(scene, camera);
            secondShader.uniforms.uTexture.value = rendertarget.texture;
            secondShader.uniforms.uBlurAmount.value = blur_amount;
            renderer.setRenderTarget(null);
            renderer.render(blur_screen, camera);
            requestAnimationFrame(animate);

        }
        animate();

    }

init();