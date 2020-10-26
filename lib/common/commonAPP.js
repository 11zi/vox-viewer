// copyright@2020 沈维杰

import { OrbitControls } from '../threeJS/OrbitControls.js';
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
    <div class="mdui-col-md-3 mdui-m-t-1 mdui-m-b-1" :id="vox_model.id" @click="browseModel(vox_model)">
      <div class="mdui-card mdui-hoverable mdui-ripple">
        <div class="mdui-card-media">
          <model-preview :v_model="vox_model"></model-preview>
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
      common.is_progressing = true;

      try {
        common.focus_on.name = file.name;
        common.focus_on.author = file.author;
        common.focus_on.description = file.description;
        common.focus_on.url = file.url;
        common.focus_on.author_avatar_url = '';
        common.focus_on.author_avatar_url = file.author_avatar_url;
      } catch (err) {
        console.info(err)
        console.info(this)
      }

      loadVox(file.url);
      onWindowResized();
      common.is_progressing = false;
    }
  }
})

Vue.component('model-preview', {
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
    focus_on: {
      name: 'name',
      author: 'author',
      description: 'description',
      url: 'url',
      author_avatar_url: 'author_avatar_url'
    }
  },
  methods: {
    initIndexList: function (models) {
      for (const key in models) {
        if (models.hasOwnProperty(key)) {
          const file = models[key];
          this.vox_models.push(new modelData(file.name, file.author, file.author_avatar_url, file.description, this.next_model_id++));
        }
      }
    },
    downloadVoxModel: function () {
      // 发起下载 url:focus_on.url
      window.location.href = this.focus_on.url;
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

  camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.125, 1000);

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
  var globalLight = new THREE.AmbientLight(0xcccccc, 0.6);
  Light.add(globalLight);
  var lightDirect = new THREE.HemisphereLight(0xffffff, 0x080880, 0.6);
  Light.add(lightDirect);
  scene.add(Light);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;

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
  camera.position.set(24, 0, 20);
  camera.lookAt(0, 0, 0);
  // 第一步卸载是最紧要
  modelObj.traverse(function (obj) {
    if (obj.type === 'Mesh') {
      obj.geometry.dispose();
      obj.material.dispose();
    }
  })
  scene.remove(modelObj);
  modelObj = new THREE.Object3D();
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
  arr: ['没写-x-', 'No Description.', '......', 'undefied', 'nvll', 'flase', '懒得写', '没有', '一片空白'],
  getRandom: function () { return this.arr[Math.floor(Math.random() * this.arr.length)] }
}

function modelData(_name, _author, _author_avatar_url, _description, _id) {
  this.name = _name ? _name : 'No name';
  this.author = _author ? _author : 'Unknown';
  this.description = _description ? _description : descriptionList.getRandom();

  this.id = _id;
  this.url = _name ? ('./VOX-models/' + _name + '.vox') : '#';
  this.img_url = _name ? ('./VOX-models/' + _name + '.png') : './VOX-models/img_not_found.jpg';
  this.author_avatar_url = _author_avatar_url ? _author_avatar_url : '';
}

common.initIndexList([
  {
    name: 'chr_fox',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'chr_gumi',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'chr_knight',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'chr_man',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'chr_old',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'chr_poem',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'chr_rain',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'chr_sword',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'ephtracy',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'monu1',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'monu10',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'nature',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'untitled',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  },
  {
    name: 'monu9',
    author: '@ Ephtracy',
    author_avatar_url: '',
    description: ''
  }
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
animate();

mdui.mutation();
