// ==========================================
// 1. LẤY PHẦN TỬ GIAO DIỆN HTML
// ==========================================
const canvas = document.getElementById('cadCanvas');
const ctx = canvas.getContext('2d');


const inputL = document.getElementById('length');
const inputW = document.getElementById('width');
const inputH = document.getElementById('height');
const btnUpdate = document.getElementById('btn-update');

const foldRange = document.getElementById('fold-range');
const foldValue = document.getElementById('fold-value');

const btnAutoFold = document.getElementById('btn-auto-fold');
const btnResetFold = document.getElementById('btn-reset-fold');

const paperTypeSelect = document.getElementById('paper-type');
const btnExport = document.getElementById('btn-export');

// ==========================================
// 2. BIẾN ĐIỀU KHIỂN ANIMATION
// ==========================================
let isAnimating = false;
let targetAngle = 0;
let currentAngle = 0;

// ==========================================
// 3. KHỞI TẠO THREE.JS (3D)
// ==========================================
const container3D = document.getElementById('threejs-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1a1e');

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(0, 250, 350);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(400, 400);
renderer.shadowMap.enabled = true;

if (container3D) {
  container3D.innerHTML = '';
  container3D.appendChild(renderer.domElement);
}

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Ánh sáng
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 200, 100);
dirLight.castShadow = true;
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(400, 20, 0x00b37e, 0x323238);
scene.add(gridHelper);

let box3DGroup = null;
let pivots = {};

// ==========================================
// 4. HÀM VẼ CAD 2D
// ==========================================
function draw2D(L, W, H) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const startX = centerX - L / 2;
  const startY = centerY - W / 2;

  // Nếp gấp (Xanh)
  ctx.save();
  ctx.strokeStyle = '#00b37e';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(startX, startY, L, W);
  ctx.restore();

  // Đường cắt (Đỏ)
  ctx.save();
  ctx.strokeStyle = '#f75a68';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(startX, startY - H, L, H);
  ctx.rect(startX, startY + W, L, H);
  ctx.rect(startX - H, startY, H, W);
  ctx.rect(startX + L, startY, H, W);
  const flapHeight = H * 0.4;
  ctx.rect(startX, startY - H - flapHeight, L, flapHeight);
  ctx.stroke();
  ctx.restore();
}

// ==========================================
// 5. HÀM DỰNG HỘP 3D
// ==========================================
function create3DBox(L, W, H) {
  if (box3DGroup) {
    scene.remove(box3DGroup);
  }

  box3DGroup = new THREE.Group();
  pivots = {};

  // Lấy màu sắc dựa trên lựa chọn Loại Giấy
  let paperColor = 0xd4a373; // Mặc định: Nâu Kraft
  let roughnessValue = 0.7;

  if (paperTypeSelect) {
    const selectedType = paperTypeSelect.value;
    if (selectedType === 'white') {
      paperColor = 0xf0f0f0;  // Trắng sáng
      roughnessValue = 0.3;  // Hơi bóng
    } else if (selectedType === 'cardboard') {
      paperColor = 0x8d99ae;  // Xám xi măng
      roughnessValue = 0.9;  // Thô nhám
    }
  }

  const paperMaterial = new THREE.MeshStandardMaterial({
    color: paperColor,
    side: THREE.DoubleSide,
    roughness: roughnessValue
  });
  // A. ĐÁY
  const bottomGeo = new THREE.PlaneGeometry(L, W);
  const bottomMesh = new THREE.Mesh(bottomGeo, paperMaterial);
  bottomMesh.rotation.x = -Math.PI / 2;
  bottomMesh.receiveShadow = true;
  box3DGroup.add(bottomMesh);

  // B. TRƯỚC + NẮP
  pivots.front = new THREE.Group();
  pivots.front.position.set(0, 0, -W / 2);
  bottomMesh.add(pivots.front);

  const frontGeo = new THREE.PlaneGeometry(L, H);
  const frontMesh = new THREE.Mesh(frontGeo, paperMaterial);
  frontMesh.position.set(0, H / 2, 0);
  frontMesh.rotation.x = Math.PI / 2;
  pivots.front.add(frontMesh);

  const flapH = H * 0.4;
  pivots.flap = new THREE.Group();
  pivots.flap.position.set(0, H, 0);
  frontMesh.add(pivots.flap);

  const flapGeo = new THREE.PlaneGeometry(L, flapH);
  const flapMesh = new THREE.Mesh(flapGeo, paperMaterial);
  flapMesh.position.set(0, flapH / 2, 0);
  pivots.flap.add(flapMesh);

  // C. SAU
  pivots.back = new THREE.Group();
  pivots.back.position.set(0, 0, W / 2);
  bottomMesh.add(pivots.back);

  const backGeo = new THREE.PlaneGeometry(L, H);
  const backMesh = new THREE.Mesh(backGeo, paperMaterial);
  backMesh.position.set(0, -H / 2, 0);
  backMesh.rotation.x = -Math.PI / 2;
  pivots.back.add(backMesh);

  // D. TRÁI
  pivots.left = new THREE.Group();
  pivots.left.position.set(-L / 2, 0, 0);
  bottomMesh.add(pivots.left);

  const leftGeo = new THREE.PlaneGeometry(H, W);
  const leftMesh = new THREE.Mesh(leftGeo, paperMaterial);
  leftMesh.position.set(-H / 2, 0, 0);
  leftMesh.rotation.y = -Math.PI / 2;
  pivots.left.add(leftMesh);

  // E. PHẢI
  pivots.right = new THREE.Group();
  pivots.right.position.set(L / 2, 0, 0);
  bottomMesh.add(pivots.right);

  const rightGeo = new THREE.PlaneGeometry(H, W);
  const rightMesh = new THREE.Mesh(rightGeo, paperMaterial);
  rightMesh.position.set(H / 2, 0, 0);
  rightMesh.rotation.y = Math.PI / 2;
  pivots.right.add(rightMesh);

  scene.add(box3DGroup);
}

// ==========================================
// 6. CẬP NHẬT GÓC GẤP
// ==========================================
function applyFoldAngle(angleDeg) {
  currentAngle = angleDeg;
  if (foldRange) foldRange.value = angleDeg;
  if (foldValue) foldValue.textContent = `${Math.round(angleDeg)}°`;

  const rad = (angleDeg * Math.PI) / 180;

  if (pivots.front) pivots.front.rotation.x = rad;
  if (pivots.back)  pivots.back.rotation.x  = -rad;
  if (pivots.left)  pivots.left.rotation.y  = rad;
  if (pivots.right) pivots.right.rotation.y = -rad;
  if (pivots.flap)  pivots.flap.rotation.x  = rad;
}

// ==========================================
// 7. VÒNG LẶP ANIMATION
// ==========================================
function animate() {
  requestAnimationFrame(animate);

  if (isAnimating) {
    const step = 1.5;
    if (Math.abs(currentAngle - targetAngle) > step) {
      if (currentAngle < targetAngle) {
        applyFoldAngle(currentAngle + step);
      } else {
        applyFoldAngle(currentAngle - step);
      }
    } else {
      applyFoldAngle(targetAngle);
      isAnimating = false;
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

// ==========================================
// 8. SỰ KIỆN NÚT BẤM
// ==========================================
function updateAll() {
  const L = parseFloat(inputL.value) || 120;
  const W = parseFloat(inputW.value) || 80;
  const H = parseFloat(inputH.value) || 50;

  draw2D(L, W, H);
  create3DBox(L, W, H);
  applyFoldAngle(currentAngle);
}

if (btnUpdate) btnUpdate.addEventListener('click', updateAll);

if (foldRange) {
  foldRange.addEventListener('input', (e) => {
    isAnimating = false;
    applyFoldAngle(parseFloat(e.target.value));
  });
}

if (btnAutoFold) {
  btnAutoFold.addEventListener('click', () => {
    targetAngle = (currentAngle >= 90) ? 0 : 90;
    isAnimating = true;
  });
}

if (btnResetFold) {
  btnResetFold.addEventListener('click', () => {
    targetAngle = 0;
    isAnimating = true;
  });
}

// Chạy khởi tạo lần đầu
updateAll();
animate();
// Đổi loại giấy -> Vẽ lại hộp 3D
if (paperTypeSelect) {
  paperTypeSelect.addEventListener('change', updateAll);
}

// Xuất ảnh bản vẽ 2D dạng file PNG
if (btnExport) {
  btnExport.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'nsk-cad-dieline.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}