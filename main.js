// ==========================================
// 1. LẤY PHẦN TỬ GIAO DIỆN HTML
// ==========================================
const canvas = document.getElementById('cadCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

const inputL = document.getElementById('length');
const inputW = document.getElementById('width');
const inputH = document.getElementById('height');
const btnUpdate = document.getElementById('btn-update');

const foldRange = document.getElementById('fold-range');
const foldValue = document.getElementById('fold-value');

const btnAutoFold = document.getElementById('btn-auto-fold');
const btnResetFold = document.getElementById('btn-reset-fold');

const paperTypeSelect = document.getElementById('paper-type');
const boxTypeSelect = document.getElementById('box-type');
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

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
camera.position.set(0, 300, 400);

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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(150, 300, 150);
dirLight.castShadow = true;
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(500, 20, 0x00b37e, 0x323238);
scene.add(gridHelper);

let box3DGroup = null;
let pivots = {};

// ==========================================
// 4. HÀM VẼ CAD 2D (TỰ ĐỘNG THAY ĐỔI THEO KIỂU HỘP)
// ==========================================
function draw2D(L, W, H) {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const startX = centerX - L / 2;
  const startY = centerY - W / 2;
  const boxType = boxTypeSelect ? boxTypeSelect.value : 'standard';

  // Nếp gấp Đáy (Đường nét đứt xanh)
  ctx.save();
  ctx.strokeStyle = '#00b37e';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(startX, startY, L, W);
  ctx.restore();

  // Đường cắt Biên (Nét liền đỏ)
  ctx.save();
  ctx.strokeStyle = '#f75a68';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  // 4 mặt xung quanh
  ctx.rect(startX, startY - H, L, H);      // Mặt trên
  ctx.rect(startX, startY + W, L, H);      // Mặt dưới
  ctx.rect(startX - H, startY, H, W);      // Mặt trái
  ctx.rect(startX + L, startY, H, W);      // Mặt phải

  // Nếu chọn Hộp Tiêu Chuẩn -> Vẽ thêm nắp gài phụ
  if (boxType === 'standard') {
    const flapHeight = H * 0.4;
    ctx.rect(startX, startY - H - flapHeight, L, flapHeight);
  }

  ctx.stroke();
  ctx.restore();
}

// ==========================================
// 5. HÀM DỰNG HỘP 3D (THAY ĐỔI THEO KIỂU HỘP & CHẤT LIỆU)
// ==========================================
function create3DBox(L, W, H) {
  if (box3DGroup) {
    scene.remove(box3DGroup);
  }

  box3DGroup = new THREE.Group();
  pivots = {};

  const boxType = boxTypeSelect ? boxTypeSelect.value : 'standard';

  // Thiết lập màu sắc chất liệu giấy
  let paperColor = 0xd4a373; // Mặc định giấy Kraft
  let roughnessValue = 0.7;
  if (paperTypeSelect) {
    if (paperTypeSelect.value === 'white') { 
      paperColor = 0xf0f0f0; 
      roughnessValue = 0.3; 
    } else if (paperTypeSelect.value === 'cardboard') { 
      paperColor = 0x8d99ae; 
      roughnessValue = 0.9; 
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

  // B. MẶT TRƯỚC
  pivots.front = new THREE.Group();
  pivots.front.position.set(0, W / 2, 0);
  bottomMesh.add(pivots.front);

  const frontGeo = new THREE.PlaneGeometry(L, H);
  const frontMesh = new THREE.Mesh(frontGeo, paperMaterial);
  frontMesh.position.set(0, H / 2, 0);
  pivots.front.add(frontMesh);

  // NẮP GÀI (Chỉ xuất hiện khi chọn Hộp Tiêu Chuẩn)
  if (boxType === 'standard') {
    const flapH = H * 0.4;
    pivots.flap = new THREE.Group();
    pivots.flap.position.set(0, H / 2, 0);
    frontMesh.add(pivots.flap);

    const flapGeo = new THREE.PlaneGeometry(L, flapH);
    const flapMesh = new THREE.Mesh(flapGeo, paperMaterial);
    flapMesh.position.set(0, flapH / 2, 0);
    pivots.flap.add(flapMesh);
  }

  // C. MẶT SAU
  pivots.back = new THREE.Group();
  pivots.back.position.set(0, -W / 2, 0);
  bottomMesh.add(pivots.back);

  const backGeo = new THREE.PlaneGeometry(L, H);
  const backMesh = new THREE.Mesh(backGeo, paperMaterial);
  backMesh.position.set(0, -H / 2, 0);
  pivots.back.add(backMesh);

  // D. MẶT TRÁI
  pivots.left = new THREE.Group();
  pivots.left.position.set(-L / 2, 0, 0);
  bottomMesh.add(pivots.left);

  const leftGeo = new THREE.PlaneGeometry(H, W);
  const leftMesh = new THREE.Mesh(leftGeo, paperMaterial);
  leftMesh.position.set(-H / 2, 0, 0);
  pivots.left.add(leftMesh);

  // E. MẶT PHẢI
  pivots.right = new THREE.Group();
  pivots.right.position.set(L / 2, 0, 0);
  bottomMesh.add(pivots.right);

  const rightGeo = new THREE.PlaneGeometry(H, W);
  const rightMesh = new THREE.Mesh(rightGeo, paperMaterial);
  rightMesh.position.set(H / 2, 0, 0);
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
// 7. VÒNG LẶP ANIMATION HOẠT HỌA
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
// 8. ĐẮNG KÝ SỰ KIỆN NÚT BẤM & TƯƠNG TÁC
// ==========================================
function updateAll() {
  const L = parseFloat(inputL ? inputL.value : 120) || 120;
  const W = parseFloat(inputW ? inputW.value : 80) || 80;
  const H = parseFloat(inputH ? inputH.value : 50) || 50;

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

if (paperTypeSelect) paperTypeSelect.addEventListener('change', updateAll);
if (boxTypeSelect) boxTypeSelect.addEventListener('change', updateAll);

if (btnExport) {
  btnExport.addEventListener('click', () => {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'nsk-cad-dieline.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

// Chạy khởi tạo ứng dụng
updateAll();
animate();