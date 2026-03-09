import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/controls/OrbitControls.js';
import { VOXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/loaders/VOXLoader.js';

console.log('commonAPP.js - Enhanced Shader Edition');

// ─────────────────────────────────────────────
// Vue 组件注册
// ─────────────────────────────────────────────

Vue.component('mdui-progress', {
  template: `<div class="mdui-progress"><div class="mdui-progress-indeterminate"></div></div>`
});

Vue.component('mdui-card', {
  props: ["vox_model"],
  template: `
    <div class="mdui-col-md-3 mdui-m-t-1 mdui-m-b-1" :id="vox_model.id" @click="browseModel(vox_model)">
      <div class="mdui-card mdui-hoverable mdui-ripple">
        <div class="mdui-card-media">
          <model-preview :v_model="vox_model"></model-preview>
        </div>
        <div class="mdui-card-media-covered">
          <div class="mdui-card-primary">
            <div class="mdui-card-primary-title mdui-text-color-theme-100">{{ vox_model.name }}</div>
          </div>
        </div>
      </div>
    </div>`,
  methods: {
    browseModel: function (file) {
      common.is_progressing = true;
      try {
        common.focus_on.name = file.name;
        common.focus_on.author = file.author;
        common.focus_on.description = file.description;
        common.focus_on.url = file.url;
        common.focus_on.author_avatar_url = file.author_avatar_url || '';
      } catch (err) {
        console.info(err);
      }
      loadVox(file.url);
      onWindowResized();
      common.is_progressing = false;
    }
  }
});

Vue.component('model-preview', {
  props: ["v_model"],
  template: `<img v-if="v_model.img_url" :src=v_model.img_url :alt=v_model.name><i v-else class="mdui-icon material-icons">broken_image</i>`
});

// ─────────────────────────────────────────────
// Vue 数据层
// ─────────────────────────────────────────────

const common = new Vue({
  el: '#common',
  data: {
    vox_models: [],
    next_model_id: 1,
    is_progressing: false,
    focus_on: {
      name: 'name',
      author: 'author',
      description: 'description',
      url: 'url',
      author_avatar_url: ''
    }
  },
  methods: {
    initIndexList: function (models) {
      for (const key in models) {
        if (models.hasOwnProperty(key)) {
          const file = models[key];
          this.vox_models.push(
            new modelData(file.name, file.author, file.author_avatar_url, file.description, this.next_model_id++)
          );
        }
      }
    },
    downloadVoxModel: function () {
      window.location.href = this.focus_on.url;
    }
  }
});

// ─────────────────────────────────────────────
// Debounce（来自 underscore.js）
// ─────────────────────────────────────────────

var underscore = {};
underscore.debounce = function (func, wait, immediate) {
  var timeout;
  return function () {
    var context = this, args = arguments;
    var later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};

// ─────────────────────────────────────────────
// 自定义着色器：体素 + AO + 逐实例颜色
// ─────────────────────────────────────────────

/**
 * 顶点着色器
 * - 接收逐实例颜色（instanceColor）
 * - 计算简单的法线方向 AO（六面体素的面朝向权重）
 * - 将世界坐标传给片元着色器用于地面投影
 */
const voxVertexShader = `
  // three.js 会自动注入 instanceColor（vec3）当 mesh.instanceColor 存在时
  // 注：需要 THREE r121 支持，见 InstancedMesh.setColorAt

  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vAO;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vColor = instanceColor;

    // 世界坐标（用于地面柔化阴影）
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;

    // 简单方向性 AO：
    // 顶面（法线朝上）最亮，底面最暗，侧面居中
    float upFactor   = max(0.0, vNormal.y);          // 0~1, 顶面
    float downFactor = max(0.0, -vNormal.y);         // 0~1, 底面
    // AO 权重：顶面=1.0, 侧面=0.75, 底面=0.45
    vAO = 1.0 - downFactor * 0.55 - (1.0 - upFactor - downFactor) * 0.25;

    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

/**
 * 片元着色器
 * - 使用逐实例颜色
 * - 叠加 AO 遮蔽
 * - 半球光照（天空色 + 地面色）
 */
const voxFragmentShader = `
  uniform vec3 uSkyColor;    // 半球光：天空颜色
  uniform vec3 uGroundColor; // 半球光：地面颜色
  uniform float uAmbient;    // 环境光强度

  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vAO;

  void main() {
    // 半球光：根据法线 Y 分量在天空色和地面色之间插值
    float hemi = vNormal.y * 0.5 + 0.5; // 0~1
    vec3 hemiLight = mix(uGroundColor, uSkyColor, hemi);

    // 主方向光（模拟太阳）
    vec3 sunDir = normalize(vec3(1.2, 2.0, 1.5));
    float diffuse = max(dot(vNormal, sunDir), 0.0);

    // 最终光照 = 环境（半球）+ 漫反射，乘以 AO
    vec3 lighting = (hemiLight * uAmbient + vec3(1.0) * diffuse * 0.6) * vAO;

    // 叠加到体素颜色
    vec3 finalColor = vColor * lighting;

    // Gamma 校正（sRGB 近似）
    finalColor = pow(finalColor, vec3(1.0 / 2.2));

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

/**
 * 地面阴影着色器（Blob Shadow / 投影圆盘）
 * 用一个圆形平面，根据到中心的距离渐变透明度，模拟柔化阴影
 */
const shadowVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shadowFragmentShader = `
  uniform float uRadius;   // 阴影半径（归一化 UV 空间）
  uniform float uOpacity;  // 最大不透明度
  uniform float uSoftness; // 边缘柔化程度 (0~1)

  varying vec2 vUv;

  void main() {
    // UV 中心为 (0.5, 0.5)
    vec2 centered = vUv - 0.5;
    float dist = length(centered) * 2.0; // 0 = 中心，1 = 边缘

    // 柔化阴影：使用平滑步函数
    float alpha = 1.0 - smoothstep(1.0 - uSoftness, 1.0, dist);
    alpha *= uOpacity;

    // 椭圆修正：让阴影稍宽（VOX 模型通常正视图更宽）
    float ellipse = length(vec2(centered.x * 0.8, centered.y));
    float alphaEllipse = 1.0 - smoothstep(1.0 - uSoftness, 1.0, ellipse * 2.0);
    alphaEllipse *= uOpacity;

    gl_FragColor = vec4(0.0, 0.0, 0.0, alphaEllipse);
  }
`;

// ─────────────────────────────────────────────
// THREE.js 场景初始化
// ─────────────────────────────────────────────

var scene, camera, renderer, controls;
var shadowMesh; // 地面柔化阴影圆盘
var vox_dom = document.getElementById('vox');

function initTHREE() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd4d4d4);

  // 轻微雾效，增加纵深感
  scene.fog = new THREE.Fog(0xd4d4d4, 60, 120);

  camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.125, 1000);
  camera.position.set(24, 16, 24);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.domElement.id = 'vox-renderer';
  renderer.domElement.className = 'mdui-shadow-1';
  renderer.domElement.style.outline = 'none';
  // 开启物理正确光照和阴影
  renderer.physicallyCorrectLights = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xd4d4d4);

  // ── 地面平面（接收阴影，纯色）
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.6;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  // ── 地面柔化 Blob Shadow（ShaderMaterial 圆盘）
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  const shadowMat = new THREE.ShaderMaterial({
    vertexShader: shadowVertexShader,
    fragmentShader: shadowFragmentShader,
    uniforms: {
      uRadius:   { value: 0.5 },
      uOpacity:  { value: 0.45 },
      uSoftness: { value: 0.55 }
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = -0.58; // 紧贴地面，避免 z-fighting
  shadowMesh.name = 'blobShadow';
  scene.add(shadowMesh);

  // ── 光源（配合自定义着色器的 uniform，这里保留一盏方向光用于内置阴影 Pass）
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(12, 20, 15);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width  = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far  = 200;
  dirLight.shadow.camera.left   = -30;
  dirLight.shadow.camera.right  =  30;
  dirLight.shadow.camera.top    =  30;
  dirLight.shadow.camera.bottom = -30;
  dirLight.shadow.radius = 8; // PCFSoft 柔化半径
  scene.add(dirLight);

  const ambLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambLight);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 80;

  vox_dom.appendChild(renderer.domElement);
  animate();
  console.log('THREE.js 初始化完成（自定义着色器版）');
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// ─────────────────────────────────────────────
// VOX 模型加载（修正颜色 + 自定义着色器）
// ─────────────────────────────────────────────

var vLoader = new VOXLoader();
var modelObj = new THREE.Object3D();
modelObj.name = 'VOX模型挂载对象';

function loadVox(_url) {
  // 重置相机
  camera.position.set(24, 16, 24);
  camera.lookAt(0, 0, 0);

  // 卸载旧模型
  modelObj.traverse(function (obj) {
    if (obj.type === 'Mesh') {
      obj.geometry.dispose();
      obj.material.dispose();
    }
  });
  scene.remove(modelObj);
  modelObj = new THREE.Object3D();
  modelObj.name = 'VOX模型挂载对象';

  if (!_url) return;

  vLoader.load(_url, function (chunks) {

    // ── 逐 chunk 构建带颜色的 InstancedMesh
    for (let i = 0; i < chunks.length; i++) {
      const chunk   = chunks[i];
      const size    = chunk.size;
      const data    = chunk.data;
      const palette = chunk.palette;

      const voxCount = data.length / 4;

      // ── 自定义着色器材质（每个 chunk 独立实例，共享 uniforms 定义）
      const material = new THREE.ShaderMaterial({
        vertexShader:   voxVertexShader,
        fragmentShader: voxFragmentShader,
        uniforms: {
          uSkyColor:    { value: new THREE.Color(0xd0e8ff) }, // 天空：淡蓝
          uGroundColor: { value: new THREE.Color(0x806040) }, // 地面：暖棕
          uAmbient:     { value: 0.55 }
        },
        // 关键：告知 three.js 这个 ShaderMaterial 使用逐实例颜色
        // three.js r121 需要手动在顶点着色器里声明 attribute vec3 instanceColor
        // 但 InstancedMesh 会自动注入，需要开启此 flag：
      });

      // r121 InstancedMesh 颜色注入：需要在 ShaderMaterial 里手动定义 attribute
      // 解决方案：用 onBeforeCompile 注入，或直接在 vertexShader 里声明
      // r121 ShaderMaterial + InstancedMesh: instanceColor 作为 attribute 自动注入
      // 需要在顶点着色器顶部声明：attribute vec3 instanceColor;
      // 我们已在 voxVertexShader 中用 instanceColor（three.js 内建名），
      // 但 ShaderMaterial 不会自动识别，需要额外 attribute 声明。
      // 最兼容 r121 的做法：onBeforeCompile patch

      const patchedMaterial = new THREE.ShaderMaterial({
        vertexShader: `
          attribute vec3 instanceColor;
          ${voxVertexShader}
        `,
        fragmentShader: voxFragmentShader,
        uniforms: {
          uSkyColor:    { value: new THREE.Color(0xd0e8ff) },
          uGroundColor: { value: new THREE.Color(0x806040) },
          uAmbient:     { value: 0.55 }
        }
      });

      const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
      const mesh = new THREE.InstancedMesh(geometry, patchedMaterial, voxCount);
      mesh.castShadow = true;

      // 构建颜色数组（Float32Array，逐实例 RGB）
      const instanceColors = new Float32Array(voxCount * 3);

      const color  = new THREE.Color();
      const matrix = new THREE.Matrix4();

      for (let j = 0, k = 0; j < data.length; j += 4, k++) {
        const x = data[j + 0] - size.x / 2;
        const y = data[j + 1] - size.y / 2;
        const z = data[j + 2] - size.z / 2;
        const c = data[j + 3];

        // ── 正确解析 VOX palette（ABGR 字节序）
        const hex = palette[c];
        const r = ((hex >> 0)  & 0xff) / 255;
        const g = ((hex >> 8)  & 0xff) / 255;
        const b = ((hex >> 16) & 0xff) / 255;

        // 写入逐实例颜色数组
        instanceColors[k * 3 + 0] = r;
        instanceColors[k * 3 + 1] = g;
        instanceColors[k * 3 + 2] = b;

        // 位置矩阵（VOX 坐标：x=右, y=前, z=上 → THREE：x=右, y=上, z=-前）
        mesh.setMatrixAt(k, matrix.setPosition(x, z, -y));
      }

      // 绑定逐实例颜色 attribute
      geometry.setAttribute(
        'instanceColor',
        new THREE.InstancedBufferAttribute(instanceColors, 3)
      );

      mesh.instanceMatrix.needsUpdate = true;
      modelObj.add(mesh);
    }

    scene.add(modelObj);

    // ── 计算模型包围盒，调整地面阴影大小和位置
    const box = new THREE.Box3().setFromObject(modelObj);
    const size3 = new THREE.Vector3();
    box.getSize(size3);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // 将模型底部对齐地面
    const bottomY = box.min.y;
    modelObj.position.y = -bottomY - 0.5;

    // 更新 Blob Shadow：大小匹配模型水平范围
    const shadowRadius = Math.max(size3.x, size3.z) * 0.75;
    shadowMesh.scale.set(shadowRadius * 2, shadowRadius * 2, 1);
    shadowMesh.position.x = center.x;
    shadowMesh.position.z = center.z;

    // 更新方向光的 shadow camera 范围
    const halfExt = Math.max(size3.x, size3.y, size3.z) * 0.8;
    const dl = scene.children.find(c => c.isDirectionalLight);
    if (dl) {
      dl.shadow.camera.left   = -halfExt;
      dl.shadow.camera.right  =  halfExt;
      dl.shadow.camera.top    =  halfExt;
      dl.shadow.camera.bottom = -halfExt;
      dl.shadow.camera.updateProjectionMatrix();
    }

    // 根据模型尺寸自动调整相机距离
    const modelDiag = Math.sqrt(size3.x ** 2 + size3.y ** 2 + size3.z ** 2);
    const dist = modelDiag * 1.6;
    camera.position.set(dist, dist * 0.6, dist);
    camera.lookAt(center.x, center.y * 0.5 - bottomY, center.z);
    controls.target.set(center.x, center.y * 0.5 - bottomY, center.z);
    controls.update();
  });
}

// ─────────────────────────────────────────────
// 模型数据构建
// ─────────────────────────────────────────────

var descriptionList = {
  arr: ['没写-x-', 'No Description.', '......', 'undefied', 'nvll', 'flase', '懒得写', '没有', '一片空白'],
  getRandom: function () { return this.arr[Math.floor(Math.random() * this.arr.length)]; }
};

function modelData(_name, _author, _author_avatar_url, _description, _id) {
  this.name        = _name        || 'No name';
  this.author      = _author      || 'Unknown';
  this.description = _description || descriptionList.getRandom();
  this.id          = _id;
  this.url         = _name ? ('/vox-viewer/VOX-models/' + _name + '.vox') : '#';
  this.img_url     = _name ? ('/vox-viewer/VOX-models/' + _name + '.png') : '/VOX-models/img_not_found.jpg';
  this.author_avatar_url = _author_avatar_url || '';
}

// ─────────────────────────────────────────────
// 模型列表
// ─────────────────────────────────────────────

common.initIndexList([
  { name: 'chr_fox',    author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'chr_gumi',   author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'chr_knight', author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'chr_man',    author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'chr_old',    author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'chr_poem',   author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'chr_rain',   author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'chr_sword',  author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'ephtracy',   author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'monu1',      author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'monu10',     author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'nature',     author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'untitled',   author: '@ Ephtracy', author_avatar_url: '', description: '' },
  { name: 'monu9',      author: '@ Ephtracy', author_avatar_url: '', description: '' }
]);

// ─────────────────────────────────────────────
// 响应式窗口调整
// ─────────────────────────────────────────────

var onWindowResized = underscore.debounce(function () {
  const w = vox_dom.offsetWidth;
  const h = Math.floor(w * 0.5625); // 16:9
  renderer.setSize(w, h);
  camera.aspect = 16 / 9;
  camera.updateProjectionMatrix();
}, 100);

window.addEventListener('resize', onWindowResized, false);

initTHREE();
mdui.mutation();
