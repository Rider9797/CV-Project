
const JSON_PATH = 'assets/camera_data_for_web.json';
const PLY_PATH = 'assets/point_cloud.ply';
const IMAGE_DIR = 'assets/images/'; 



let scene, renderer, camera;
let cameraPoses = []; 
let currentCameraIndex = 0;
let targetCameraIndex = 0;
let pointCloudCenter = new THREE.Vector3(0, 0, 0); 
let pointCloudObject = null; 



let transitionActive = false;
let transitionProgress = 0.0; 
const TRANSITION_DURATION = 90; 


const imageA = document.getElementById('imageA');
const imageB = document.getElementById('imageB');




async function init() {
    
    const data = await loadPoseData(JSON_PATH);
    cameraPoses = processPoses(data.camera_poses);

    setupScene(data.intrinsics.fov_deg);


    await loadPointCloud(PLY_PATH);

    setCameraPose(cameraPoses[currentCameraIndex]);
    setInitialBackground(cameraPoses[currentCameraIndex].label);

    
    createUIControls();

    
    setupEventListeners();

    
    animate();
}

function setupScene(fovDeg) {
    
    const aspect = window.innerWidth / window.innerHeight;

    
    camera = new THREE.PerspectiveCamera(fovDeg, aspect, 0.1, 1000);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 

    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    
    document.body.appendChild(renderer.domElement);

    
    window.addEventListener('resize', onWindowResize, false);
}

async function loadPointCloud(path) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.PLYLoader();

        loader.load(path, (geometry) => {

            geometry.computeBoundingBox();
            const boundingBox = geometry.boundingBox;
            

            pointCloudCenter.copy(boundingBox.getCenter(new THREE.Vector3()));
            
            console.log(` Point Cloud Center:`, pointCloudCenter);
            
            const material = new THREE.PointsMaterial({
                size: 0.02, 
                vertexColors: true 
            });

            pointCloudObject = new THREE.Points(geometry, material);
            scene.add(pointCloudObject);
            
            console.log(` Point Cloud loaded with ${geometry.attributes.position.count} points.`);
            
            
            
            resolve();
        }, 
        (xhr) => {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        }, 
        (error) => {
            console.error(' An error happened loading PLY:', error);
            reject(error);
        });
    });
}

async function loadPoseData(path) {
    try {

        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        console.log(` Camera poses loaded: ${data.camera_poses.length} total.`);

        return data;
    } 
    catch (error) 
    {
        console.error(' Could not load or parse JSON data:', error);
        return { intrinsics: { fov_deg: 75 }, camera_poses: [] };
    }
}




function processPoses(rawPoses) {


    return rawPoses.map((pose, index) => {
        return {
            label: pose.label,
            position: new THREE.Vector3(...pose.position_C), 
            index: index
        };
    });
}

function setCameraPose(pose) {
    
    camera.position.copy(pose.position);
    

    camera.lookAt(pointCloudCenter);
    

    pose.quaternion = camera.quaternion.clone();
    
    updateCounter();
}

function setInitialBackground(label) {
    imageA.src = IMAGE_DIR + label;
    imageA.style.opacity = 1; 
    imageB.style.opacity = 0; 
    console.log(`Initial view: ${label}`);
}




function createUIControls() {


    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'navigation-controls';
    controlsDiv.innerHTML = `
        <button id="prevBtn" class="nav-btn" title="Previous view (Left Arrow Key)"></button>
        <div id="counter-display">
            <span id="current-index">1</span> / <span id="total-cameras">${cameraPoses.length}</span>
        </div>
        <button id="nextBtn" class="nav-btn" title="Next view (Right Arrow Key)"></button>
    `;
    document.body.appendChild(controlsDiv);
}

function updateCounter() {
    const currentSpan = document.getElementById('current-index');
    if (currentSpan) {
        currentSpan.textContent = currentCameraIndex + 1;
    }
}






function animate() {
    requestAnimationFrame(animate);

    if (transitionActive) {
        updateTransition();
    }
    
    renderer.render(scene, camera);
}

function updateTransition() {
    transitionProgress += 1 / TRANSITION_DURATION; 

    if (transitionProgress >= 1.0) {

        transitionProgress = 1.0;
        transitionActive = false;
        
        
        currentCameraIndex = targetCameraIndex;
        
        
        setCameraPose(cameraPoses[currentCameraIndex]); 

        imageA.src = IMAGE_DIR + cameraPoses[currentCameraIndex].label;
        imageA.style.opacity = 1;
        imageB.style.opacity = 0;
        
        
        renderer.domElement.style.cursor = 'default';
        
        console.log(` Transition complete to Camera ${currentCameraIndex + 1}`);

    } else {
        const currentPose = cameraPoses[currentCameraIndex];
        const targetPose = cameraPoses[targetCameraIndex];


        if (!targetPose.quaternion) {
            const tempCam = camera.clone();
            tempCam.position.copy(targetPose.position);
            tempCam.lookAt(pointCloudCenter);
            targetPose.quaternion = tempCam.quaternion.clone();
        }


        camera.position.lerpVectors(currentPose.position, targetPose.position, transitionProgress);
        

        camera.quaternion.slerpQuaternions(currentPose.quaternion, targetPose.quaternion, transitionProgress);
        

        imageA.style.opacity = 1.0 - transitionProgress; 
        imageB.style.opacity = transitionProgress;     
    }
}

function startTransition(newTargetIndex) {
    if (transitionActive || newTargetIndex === currentCameraIndex) return;

    if (newTargetIndex < 0 || newTargetIndex >= cameraPoses.length) {
        console.warn("Target camera index out of bounds.");
        return;
    }
    
    
    targetCameraIndex = newTargetIndex;

    
    
    imageB.src = IMAGE_DIR + cameraPoses[targetCameraIndex].label;

    
    transitionProgress = 0.0;
    transitionActive = true;
    
    
    renderer.domElement.style.cursor = 'wait';
    
    console.log(`Starting transition from Cam ${currentCameraIndex + 1} to Cam ${targetCameraIndex + 1}`);
}




function setupEventListeners() {
    
    const prevBtn = document.getElementById('prevBtn');
    prevBtn.addEventListener('click', navigatePrevious);
    
    
    const nextBtn = document.getElementById('nextBtn');
    nextBtn.addEventListener('click', navigateNext);
    
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            navigatePrevious();
        } else if (e.key === 'ArrowRight') {
            navigateNext();
        }
    });
    


    renderer.domElement.addEventListener('click', navigateNext);
}

function navigatePrevious() {
    const prevIndex = (currentCameraIndex - 1 + cameraPoses.length) % cameraPoses.length;
    startTransition(prevIndex);
}

function navigateNext() {
    const nextIndex = (currentCameraIndex + 1) % cameraPoses.length;
    startTransition(nextIndex);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}



init();