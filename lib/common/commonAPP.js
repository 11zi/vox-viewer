// copyright@2020 沈维杰

import { OrbitControls } from '../threeJS/OrbitControls.js';
import { CullFaceNone } from '../threeJS/three.module.js';
import { VOXLoader } from '../threeJS/VOXLoader.js';

console.log('commonAPP.js')

// 读取配置文件



// 组件注册

Vue.component('mdui-progress', {
  template: `<div class="mdui-progress"><div class="mdui-progress-indeterminate"></div></div>`
})

Vue.component('mdui-row', {
  template: `<div class="mdui-row">
</div>`
})

Vue.component('mdui-card', {
  props: ["vox_model"],
  template: `
    <div class="mdui-col-xs-3 mdui-m-t-1 mdui-m-b-1" :id="vox_model.id" @click="browseModel(vox_model)">
      <div class="mdui-card mdui-hoverable mdui-ripple">
        <div class="mdui-card-media">
          <model-canvas-view :v_model="vox_model"></model-canvas-view>
        </div>
        <div class="mdui-card-media-covered">
          <div class="mdui-card-primary">
            <div class="mdui-card-primary-title">{{ vox_model.name }}</div>
          </div>
        </div>
      </div>
    </div>`,
  methods: {
    browseModel: function (file) {
      this.is_progressing = true;
      loadVox(file.url);
      onWindowResized();
      animate();
      this.is_progressing = false;
    }
  }
})

Vue.component('mdui-dialog', {
  props: ["_model"],
  template: `<div>我是mdui-dialog</div>`
})

Vue.component('model-canvas-view', {
  props: ["v_model"],
  template: `<img v-if="v_model.img_url" :src=v_model.img_url :alt=v_model.name><i v-else class="mdui-icon material-icons">broken_image</i>`
})

// 数据层只有模型和加载状态, 别的暂时没考虑
const common = new Vue({
  el: '#common',
  data: {
    vox_models: [],
    next_model_id: 1,
    is_progressing: false,
    is_test: false
  },
  methods: {
    initIndexList: function (models) {
      for (const key in models) {
        if (models.hasOwnProperty(key)) {
          const file = models[key];
          this.vox_models.push(new modelData(file.url, file.img_url, file.name, file.author, file.description, this.next_model_id++));
        }
      }
    }
  }
})

/**
 * underscore.js
 */

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

/**
 * THREE.js
 */

var scene;
var camera;
var renderer;
var controls;
var axesHelper;
var Light;
var vox_dom = document.getElementById('vox');

// 初始化场景,相机,坐标轴
function initTHREE() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.01, 50);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.domElement.id = 'vox-renderer';
  renderer.domElement.style.outline = 'none';
  renderer.setClearColor(0xd9d9d9);

  // axesHelper = new THREE.AxesHelper(8);
  // axesHelper.name = '坐标轴';
  // scene.add(axesHelper);

  // var hemiLight = new THREE.HemisphereLight(0x888888, 0x000000, 1);
  // scene.add(hemiLight);

  // var dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
  // dirLight.position.set(1.5, 3, 2.5);
  // scene.add(dirLight);

  Light = new THREE.Object3D();
  var globalLight = new THREE.AmbientLight(0xcccccc,0.5);
  Light.add(globalLight);
  var lightDirect = new THREE.HemisphereLight(0xffffff, 0x080880, 0.5 );
  Light.add(lightDirect);
  scene.add(Light);

  controls = new OrbitControls(camera, renderer.domElement);

  vox_dom.appendChild(renderer.domElement);
  animate();
  console.log('完成初始化');
}

function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

var vLoader = new VOXLoader();
var modelObj = new THREE.Object3D();
modelObj.name = 'VOX模型挂载对象'
const material = new THREE.MeshStandardMaterial(); // 每一个vox模型都在用这个材质

// 加载vox模型同时重设相机位置&移除旧模型
function loadVox(_url) {
  camera.position.set(24, 1, 2);
  camera.lookAt(0, 0, 0);
  // 第一步卸载是最紧要
  modelObj.traverse(function (obj) {
    if (obj.type === 'Mesh') {
      obj.geometry.dispose();
      obj.material.dispose();
    }
  })
  scene.remove(modelObj);
  modelObj=new THREE.Object3D();
  // 加载
  if (!_url) return;
  vLoader.load(_url, function (chunks) {
    const geometry = new THREE.BoxBufferGeometry(1, 1, 1);

    const color = new THREE.Color();
    const matrix = new THREE.Matrix4();

    for (var i = 0; i < chunks.length; i++) {

      const chunk = chunks[i];

      const size = chunk.size;
      const data = chunk.data;
      const palette = chunk.palette;

      // displayPalette( palette );

      const mesh = new THREE.InstancedMesh(geometry, material, data.length / 4);
      // mesh.scale.setScalar(0.0015);
      modelObj.add(mesh);

      for (var j = 0, k = 0; j < data.length; j += 4, k++) {

        const x = data[j + 0] - size.x / 2;
        const y = data[j + 1] - size.y / 2;
        const z = data[j + 2] - size.z / 2;
        const c = data[j + 3];

        const hex = palette[c];
        const r = (hex >> 0 & 0xff) / 0xff;
        const g = (hex >> 8 & 0xff) / 0xff;
        const b = (hex >> 16 & 0xff) / 0xff;

        mesh.setColorAt(k, color.setRGB(r, g, b));
        mesh.setMatrixAt(k, matrix.setPosition(x, z, - y));
      }
    }
    scene.add(modelObj);
  });
}

/**
 * 加载模型数据
 */

var descriptionList = {
  arr: ['没写描述-x-', 'No Description.', '没有描述TAT', 'undefied', 'nvll', '我,莫得描述'],
  getRandom: function () { return this.arr[Math.floor(Math.random() * this.arr.length)] }
}

function modelData(_url, _img_url, _name, _author, _description, _id) {
  this.id = _id;
  this.url = _url;
  this.img_url = _img_url ? _img_url : './VOX-models/img_not_found.jpg';
  this.name = _name ? _name : 'No name';
  this.description = _description ? _description : descriptionList.getRandom();
  this.author = _author ? _author : 'Unknown';
}

common.initIndexList([
  {
    url: '',
    img_url: '',
    name: '',
    author: '',
    description: ''
  },
  {
    url: '../VOX-models/chr_fox.vox',
    img_url: './VOX-models/chr_fox.png',
    name: 'chr_fox',
    author: '@ Ephtracy',
    autoor_avarar_url: '',
    description: ''
  },
  {
    url: '../VOX-models/chr_gumi.vox',
    img_url: './VOX-models/chr_gumi.png',
    name: 'chr_gumi',
    author: '@ Ephtracy',
    description: ''
  },
  {
    url: '../VOX-models/chr_knight.vox',
    img_url: './VOX-models/chr_knight.png',
    name: 'chr_knight',
    author: '@ Ephtracy',
    description: ''
  },
  {
    url: '../VOX-models/chr_man.vox',
    img_url: './VOX-models/chr_man.png',
    name: 'chr_man',
    author: '@ Ephtracy',
    description: ''
  },
]);

// 打开mdui-dialogue的时候, vox_dom的宽高值还没有更新, 所以要延迟100ms
var onWindowResized = underscore.debounce(function (e) {
  renderer.domElement.width = vox_dom.offsetWidth;
  renderer.domElement.height = Math.floor(vox_dom.offsetWidth * 0.5625);
  renderer.setSize(vox_dom.offsetWidth, Math.floor(vox_dom.offsetWidth * 0.5625));
  camera.updateProjectionMatrix();
}, 100)
window.addEventListener('resize', onWindowResized, false);

initTHREE();

mdui.mutation();