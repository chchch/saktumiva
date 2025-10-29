import { charSplit, aksaraSplit, graphemeSplit } from '../../lib/split.mjs';
import { parseString, readOne } from '../../lib/browserutils.mjs';
import { processFile, preProcess, findSplitfunc, semanticCleanup, makeWitList } from '../../lib/collate.mjs';
import { filters, unfilterAll } from '../../lib/normalize.mjs';
import MultiAligner from '../../lib/multialign.mjs';

var _state = {};

const getFilterIndices = doc => {
  const ret = [];
  const els = doc.querySelectorAll('normalization[method="markup"] ab');
  for(const el of els) {
    const i = filters.findIndex(e => e.name === el.textContent);
    if(i > -1) ret.push(i);
  }
  return ret;
};

const realign = (newtexts,selectedsigla,blockid,opts) => {
  const eddecl = _state.xml.querySelector('editorialDecl');
  const targeted = eddecl.querySelector('segmentation > ab[type="targetedition"]')?.textContent;
  const tok = eddecl.querySelector('segmentation > ab[type="tokenization"]')?.innerHTML;
  const tagfilters = [...eddecl.querySelectorAll('ab[type="tagfilters"] tag[subtype="ignore"]')].map(t => t.textContent);
  const recursive = eddecl.querySelector('segmentation > ab[type="scoring"] > ab[type="recursive"]')?.innerHTML;
  const configfunc = tok === 'character' ? 'character' :
      recursive ? 'arr' : 'arr_simple';
  const scoringel = eddecl.querySelector('segmentation > ab[type="scoring"]');
  const scores = {
    match: parseFloat(scoringel.querySelector('ab[type="match"]').textContent),
    mismatch: parseFloat(scoringel.querySelector('ab[type="mismatch"]').textContent),
    gap_open: parseFloat(scoringel.querySelector('ab[type="gapopen"]').textContent),
    gap_extend: parseFloat(scoringel.querySelector('ab[type="gapextend"]').textContent),
    recursive: scoringel.querySelector('ab[type="recursive"]').textContent === 'true' ? true : false,
    //realigndepth: opts.hasOwnProperty('realigndepth') ? opts.realigndepth : parseInt(scoringel.querySelector('ab[type="realigndepth"]').textContent),
    realigndepth: 0,
    prop: 'norm'
  };
  const selectedtexts = [...selectedsigla].map(s => {return {siglum: s, text: newtexts.get(s)};});
  const toadd = preProcess(blockid, selectedtexts,
      {splitfunc: findSplitfunc(tok), selectedfilters: getFilterIndices(eddecl), ignoretags: tagfilters}
  )
  const toaddobjs = toadd.map(t => {
    return {siglum: t.siglum, textobj: 
      t.text.map(tt => {return {norm: tt};})
    };
  });
  const revisedsigla = new Set(toadd.map(t => t.siglum)); // ac/pc might get merged into main

  const filtersmap = new Map(toadd.map(t => [t.siglum,t.filters]));

  const oldtexts = [..._state.xml.querySelectorAll('TEI')].map(tei => {
    const siglum = tei.getAttribute('n');
    if(revisedsigla.has(siglum)) return null;

    const textobj = [...tei.querySelectorAll('w')].map(w => {
      const ret = {};
      const cl = w.closest('cl');
      if(cl) {
        if(cl.firstElementChild === w)
          ret.clstart = true;
        else if(cl.lastElementChild === w)
          ret.clend = true;
      }
      ret.unnorm = w.innerHTML;
      const lemma = w.getAttribute('lemma');
      ret.norm = lemma === null ? ret.unnorm : lemma; 
      if(tok !== 'character' && recursive === 'true')
        ret.norm = charSplit(ret.norm); //TODO: specify transliteration scheme
      return ret;
    });
    return {siglum: siglum, textobj: textobj};
  }).filter(e => e);
  /*
  const alignWorker = new Worker('./lib/realignworker.mjs',{type: 'module'});
  alignWorker.postMessage([oldtexts,newtexts,configfunc,scores]);
  alignWorker.onmessage = e => {
    if(e.data.hasOwnProperty('progress')) {
      console.log(e.data.message);
      return;
    }
    console.log(e.data);
  };
  */
  const ma = new MultiAligner(configfunc,scores);
  const alignment = ma.alignAppend(oldtexts,toaddobjs);
  const clean = postProcess(alignment, 
                            filtersmap, 
                            revisedsigla.has(targeted) ? oldtexts[0].siglum : targeted);
  const newwits = makeWitList(newtexts);

  return {rows: clean, tree: alignment.tree, witnesses: newwits};
};

const postProcess = (alignment, filtersmap, targeted) => {
  const clean = alignment.alignment.map(arr => arr.map(obj => {
    const norm = Array.isArray(obj.norm) ?  obj.norm.join('') : obj.norm;
    if(!obj.hasOwnProperty('unnorm')) return norm;

    const unnorm = Array.isArray(obj.unnorm) ? obj.unnorm.join('') : obj.unnorm;
    if(norm === unnorm) return unnorm;

    return [unnorm,norm];
  }));
  const newclean = [];
  let targetrow;
  for(const [index, row] of clean.entries()) {
    const id = alignment.sigla.shift();
    if(id === targeted) targetrow = alignment.alignment[index];
    const f = filtersmap.get(id);
    if(!f) {
      newclean.push({siglum: id, text: row});
      continue;
    }
    const unfiltered = semanticCleanup(unfilterAll([...row],f));
    const ret = new Array(unfiltered.length);
    for(let n=0;n<unfiltered.length;n++) {
      if(unfiltered[n] === row[n])
        ret[n] = unfiltered[n];
      else
        ret[n] = [unfiltered[n],row[n]];
    }
    newclean.push({siglum: id, text: ret});
  }
  const xml = restoreGroups(newclean, targetrow);
  //TODO: restore groups from targeted
  return xml;
};

const restoreGroups = (alignment, ref) => {
  const NS = _state.xml.documentElement.namespaceURI;
  const ret = [];
  for(const row of alignment) {
    let cl = null;   
    let forcecl = false;
    const text = _state.xml.createElementNS(NS,'text');

    for(const [index, entry] of ref.entries()) {
      const w = _state.xml.createElementNS(NS,'w');
      w.setAttribute('n',index);

      const item = row.text[index];
      if(Array.isArray(item)) {
        w.append(item[0]);
        w.setAttribute('lemma',item[1]);
      }
      else
        w.append(item);

      if(entry.hasOwnProperty('clstart') || forcecl) {
        if(cl) text.appendChild(cl);
        cl = _state.xml.createElementNS(NS,'cl');
        cl.appendChild(w);
        forcecl = false;
      }
      else if(entry.hasOwnProperty('clend')) {
          cl.appendChild(w);
          text.appendChild(cl);
          forcecl = true;
          cl = null;
      }
      else if(cl)
        cl.appendChild(w);
      else
        text.appendChild(w);
    }
    ret.push({siglum: row.siglum, text: text});
  }
  return ret;
};

const Realigner = {
  init: state => {_state = state;},
  realign: realign
};

export default Realigner;
