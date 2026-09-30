//import { BinaryHeap } from './structurae/binary-heap.js';

//class MaxHeap extends BinaryHeap {};
//MaxHeap.compare = (a,b) => a.count > b.count;

const bpe = (arrarr,iterations = 600) => {
  const arrclone = arrarr.map(arr => arr.map(a => Array.isArray(a) ? a.join('') : a));
  const statmap = init(arrclone);
  let n = 0;
  while(n < iterations) {
    const max = bpe1(arrclone,statmap);
    console.log(statmap);
    if(max === 1) return arrclone.map(arr => arr.filter(s => s !== null));
    n = n + 1;
  }
  return arrclone.map(arr => arr.filter(s => s !== null));
};

const init = arrarr => {
  const statmap = new Map();
  // count
  for(const arr of arrarr) {
    for(let n=0;n<arr.length-1;n++) {
      const gram = [arr[n],arr[n+1]].join(''); // in case arr[n] is ['k','ṣ','a'], etc.
      let obj = statmap.get(gram);
      if(!obj) { obj = {count: 0, places: [], grams: [arr[n],arr[n+1]]}; statmap.set(gram, obj); }
      obj.count = obj.count + 1;
      obj.places.push({arr: arr,n: n});
    }
  }
  return statmap;
};

const findPregram = (arr, n) => {
  if(n === 0) return null;
  let m = n-1;
  let pre = arr[m];
  while(pre === null) {
    if(m === 0) return null;
    m = m - 1;
    pre = arr[m];
  }
  return m;
};

const findPostgram = (arr, n) => {
  if(n === arr.length - 1) return null;
  let m = n+1;
  let post = arr[m];
  while(post === null) {
    if(m === arr.length - 1) return null;
    m = m - 1;
    post = arr[m];
  }
  return m;
};
const bpe1 = (arrarr,statmap) => {
  const max = [...statmap].reduce((acc,cur) => 
    cur[1].count > acc[1].count ? 
      cur : 
      acc,
    [null, {count: 0}]);
  if(max[1].count === 1) return 1;

  // merge
  for(const place of max[1].places) {
    const pregram = findPregram(place.arr,place.n);
    if(pregram) {
      const obj = statmap.get(place.arr[pregram] + place.arr[place.n]);
      // also need to delete the place
      obj.count = obj.count - 1;
      
      const newpre = place.arr[pregram] + max[0];
      let newobj = statmap.get(newpre);
      if(!newobj) { 
        newobj = {
          count: 0, 
          places: [], 
          grams: [place.arr[pregram],place.arr[max[0]]]
        }; 
        statmap.set(newpre, newobj);
      }
      obj.count = obj.count + 1;
    }
    const postgram = findPostgram(place.arr,place.n+1);
    if(postgram) {
      const obj = statmap.get(postgram);
      // also need to delete the place
      obj.count = obj.count - 1;
    }
    place.arr[place.n] = max[0];
    place.arr[place.n + 1] = null;
  }
  return max[1].count;
};

export default bpe;
