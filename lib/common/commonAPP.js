// copyright@2020 沈维杰
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
  <div class="mdui-col-xs-3 mdui-m-t-1 mdui-m-b-1 mdui-ripple">
    <div class="mdui-card mdui-hoverable">
      <div class="mdui-card-media">
        <model-canvas-view :v_model="vox_model"></model-canvas-view>
      </div>
      <div class="mdui-card-media-covered">
        <div class="mdui-card-primary">
          <div class="mdui-card-primary-title">{{ vox_model.name }}</div>
        </div>
      </div>
    </div>
  </div>`
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
    browseModel: function (vox) {
      is_progressing = true;
      console.log('查看模型')
      is_progressing = false;
    },
    initIndexList: function (models) {
      for (const key in models) {
        if (models.hasOwnProperty(key)) {
          const file = models[key];
          this.vox_models.push(new modelData(file.url,file.img_url,file.name,file.author,file.description,this.next_model_id++));
        }
      }
    }
  },
})

var descriptionList = {
  arr:['没写描述-x-','No Description.','没有描述TAT','undefied','nvll','我,莫得描述'],
  getRandom:function(){return this.arr[Math.floor(Math.random()*this.arr.length)]}
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
    url:'',
    img_url:'',
    name:'',
    author:'',
    description:''
  },
  {
    url:'./VOX-models/chr_fox.vox',
    img_url:'./VOX-models/chr_fox.png',
    name:'chr_fox',
    author:'@ Ephtracy',
    autoor_avarar_url:'',
    description:''
  },
  {
    url:'./VOX-models/chr_gumi.vox',
    img_url:'./VOX-models/chr_gumi.png',
    name:'chr_gumi',
    author:'@ Ephtracy',
    description:''
  },
  {
    url:'./VOX-models/chr_knight.vox',
    img_url:'./VOX-models/chr_knight.png',
    name:'chr_knight',
    author:'@ Ephtracy',
    description:''
  },
  {
    url:'./VOX-models/chr_man.vox',
    img_url:'./VOX-models/chr_man.png',
    name:'chr_man',
    author:'@ Ephtracy',
    description:''
  },
]);

mdui.mutation();