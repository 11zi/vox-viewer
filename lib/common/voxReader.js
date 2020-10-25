import { VOXLoader } from '../threeJS/VOXLoader';

console.log('voxReader.js');

// 需要
const loader = new VOXLoader();

function fileData(_url, _img_url, _name, _description){
  this.url = _url;
  this.img_url = _img_url ? _img_url : '';
  this.name = _name ? _name : '';
  this.description = _description ? _description : '';
}

function VoxFile(_data) {
  // 懒得判断值是否存在了
  this.data = new fileData(_data._url, _img_url, _name, _description);

  console.log('你创建了一个VOX对象, 你知道你在做什么吗?');
  this.loadVox=function(){
    loader.load(_url,function(chunks){
      // on load
    },function(){
      // on progress
    },function(){
      // on error
    })
  }
}

export {voxReader}