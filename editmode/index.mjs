import popupHTML from './editmode.html.mjs';
import { TSTViewer } from '../tst/js/tst.mjs';
import AlignmentViewer from '../tst/js/alignment.mjs';
import { shadowpreview } from './shadowpreview.mjs';
import { processFile, findSplitfunc, filterTexts, postProcess } from '../lib/collate.mjs';
import { handleToXML } from './utils.mjs';
import { appendList, acPcButtons, updateCheckboxes, uncheckType, populateFilters, languageSpecificOptions } from '../lib/uiutils.mjs';
import { alignPreflight } from '../lib/alignui.mjs';
import doCollate from '../lib/collateui.mjs';
import Sanscript from '../lib/sanscript.mjs';
import Realigner from '../matrix-editor/lib/realign.mjs';
import { exportLaTeX } from '../lib/export.mjs';

const _state = {
  dirHandle: null,
  editions: new Map(),
  editionfiles: [],
  witnesses: new Map(),
  witnessesdirs: ['witnesses'],
  witnessesdirHandles: [],
  alignments: new Map(),
  alignmentsdir: 'alignments',
  alignmentsdirHandle: null,
  alltexts: null
};

const natSort = (new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'})).compare;

const sidebar = {};

sidebar.click = (e,params) => {
  const targ = e.target;

  if(targ.closest('#filelist-toggler')) {
    sidebar.toggle();
    return;
  }

  if(targ.closest('.closeicon')) {
    closeBox(targ.closest('[data-path]'));
    return;
  }

  const li = targ.closest('[data-path]');
  if(li) {
    if(li.classList.contains('active') || li.classList.contains('loading')) return;
    document.querySelector('li[data-path].active')?.classList.remove('active');
    for(const box of document.querySelectorAll('.shadowbox'))
      box.style.display = 'none';

    if(li.classList.contains('modified')) {
      li.classList.add('active');
      warnModified(li.dataset.path);
    }
    else {
      openBox(li,params);
      li.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
  }
};

const findListType = li => {
  const maplist = new Map([ ['edlist',_state.editions],['witlist',_state.witnesses],['alignlist',_state.alignments] ]);
  const listname = li.closest('[id]').id;
  return maplist.get(listname);
};

const openBox = async (li,params) => {
  const type = findListType(li);

  if(li.classList.contains('loaded')) {
    const box = document.querySelector(`.shadowbox[data-path="${li.dataset.path}"]`);
    box.style.display = 'flex';
    if(params) {
      const [facs, scrollel] = TSTViewer.checkParams(box.shadowRoot,params);
      const osd = await type.get(li.dataset.path).osd;
      if(osd && facs !== undefined && facs !== osd.currentPage()) osd.goToPage(facs);
      if(scrollel) scrollTo(scrollel);
    }
  }
  else {
    li.classList.add('loading');
    if(type === _state.alignments)
      startMatrixEditor(li.dataset.path);
    else
      await displayFile(type,li.dataset.path,params);
    li.classList.remove('loading');
    li.classList.add('loaded');
    const template = document.querySelector('#closeicon');
    const clone = document.importNode(template.content,true);
    li.appendChild(clone);
  }
  li.classList.add('active');
};

const closeBox = (li,loadnext=true) => {
  const type = findListType(li);
  const box = document.querySelector(`.shadowbox[data-path="${li.dataset.path}"]`);
  const appid = box.shadowRoot?.firstChild.dataset.appid;
  const transid = box.shadowRoot?.firstChild.dataset.transid;
  if(appid) {
    const bc = new BroadcastChannel('apparatus');
    bc.postMessage({uuid: appid, shutdown: true});
    bc.close();
  }
  if(transid) {
    const bc = new BroadcastChannel('transliterator');
    bc.postMessage({uuid: transid, shutdown: true});
    bc.close();
  }
  box.remove();
  li.classList.remove('loaded','modified');
  li.querySelector('.closeicon').remove();
  if(li.classList.contains('active')) {
    li.classList.remove('active');
    if(loadnext) {
      const firstLoaded = document.querySelector('#filelist-content .loaded');
      if(firstLoaded) {
        firstLoaded.click();
        firstLoaded.scrollIntoView({behaviour: 'smooth', block: 'center'});
      }
    }
  }
};

const startMatrixEditor = path => {
  const handle = _state.alignments.get(path).handle;
  const host = document.createElement('article');
  host.className = 'shadowbox';
  host.dataset.path = path;
  const iframe = document.createElement('iframe');
  const uuid = crypto.randomUUID();
  const bc = new BroadcastChannel('matrix-editor');
  bc.onmessage = e => {
    if(e.data.uuid === uuid && e.data.state === 'ready') {
      bc.postMessage({uuid: uuid, handle: handle});
      bc.close();
    }
  };
  iframe.src = `../matrix-editor/index.html?uuid=${uuid}`; 
  host.appendChild(iframe);
  document.querySelector('article').appendChild(host);
  host.style.display = 'flex';
};

sidebar.show = () => sidebar.el.classList.remove('hidden');  

sidebar.hide = () => sidebar.el.classList.add('hidden');

sidebar.toggle = () => {
  if(sidebar.el.classList.contains('hidden'))
    sidebar.show();
  else
    sidebar.hide();
};

sidebar.makeListItem = (path, obj) => {
    const li = document.createElement('li');
    li.dataset.path = path;
    const span = document.createElement('span');
    if(obj.blockid) {
      span.append(obj.blockid);
      li.dataset.blockid = obj.blockid;
    }
    else
      span.append(obj.filename.replace(/\.xml$/,''));
    li.appendChild(span);
    if(obj.title) {
      li.append(': ');
      const small = document.createElement('small');
      small.append(obj.title);
      li.append(small);
    }
    return li;
};

sidebar.update = (type=null) => {
  if(!type || type === 'editions') {
    const edlist = document.getElementById('edlist');
    edlist.replaceChildren();
    const sortededs = [..._state.editions].sort((a, b) => natSort(a[1].filename,b[1].filename)); 
    for(const [path,obj] of sortededs) {
      const li = sidebar.makeListItem(path,obj);
      edlist.appendChild(li);
    }
  }
  if(!type || type === 'witnesses') {
    const witlist = document.getElementById('witlist');
    witlist.replaceChildren();
    const sortedwits = [..._state.witnesses].sort((a, b) => natSort(a[1].filename,b[1].filename)); 
    for(const [path,obj] of sortedwits) {
      const li = sidebar.makeListItem(path,obj);
      witlist.appendChild(li);
    }
  }
  if(!type || type === 'alignments') {
    const alignlist = document.getElementById('alignlist');
    alignlist.replaceChildren();
    const sortedaligns = [..._state.alignments].sort((a, b) => natSort(a[1].filename,b[1].filename)); 
    for(const [path,obj] of sortedaligns) {
      const li = sidebar.makeListItem(path,obj);
      alignlist.appendChild(li);
    }
  }
};

const displayFile = async (objmap, path, params) => {
  const obj = objmap.get(path);
  const doc = await handleToXML(obj.handle);
  const {shadow: shadow, scrollel: scrollel, osd: osd} = await shadowpreview(path, doc, params);
  if(osd) obj.osd = osd;
  hijackLinks(shadow);
  shadow.host.style.display = 'flex';
  if(scrollel) scrollTo(scrollel);
  if(objmap === _state.editions) {
    startEditMode(shadow,doc,path);
  }
};

const scrollTo = el => {
  el.scrollIntoView({behaviour: 'smooth', block: 'center'});
  const doc = el.getRootNode();
  for(const highlit of doc.querySelectorAll('.highlit'))
    highlit.classList.remove('highlit');
  el.classList.add('highlit');
  doc.addEventListener('click',() => {
    el.classList.remove('highlit');
  },{once: true});
};

const injectHTML = (root,xmlDoc) => {
  const blackout = document.createElement('div');
  blackout.id = 'editblackout';
  const shadowRoot = blackout.attachShadow({mode: 'open'});
  shadowRoot.innerHTML = popupHTML;
  root.appendChild(blackout);
  for(const closeicon of shadowRoot.querySelectorAll('.closeicon'))
    closeicon.addEventListener('click',closePopup.bind(null,blackout));
  for(const box of shadowRoot.querySelectorAll('.checklist'))
    box.addEventListener('click',updateCheckboxes);
  shadowRoot.querySelector('#collatebutton').addEventListener('click',collate.bind(null,xmlDoc));
  shadowRoot.getElementById('exportbutton').addEventListener('click',exportFile.bind(null,{root: root, doc: xmlDoc}));
  const blocks = xmlDoc.querySelectorAll('text lg[*|id], text l[*|id], text p[*|id], text div[*|id]'); // TODO: add 'text head[*|id]'
  addEditButtons(root,[...blocks].map(b => b.getAttribute('xml:id')),xmlDoc);
};

const addEditButtons = (root,ids,xmlDoc) => { for(const id of ids) addEditButton(root,id,xmlDoc); };

const addEditButton = (root,id,xmlDoc) => {
  const block = root.querySelector(`[id = "${id}"]`); 
  const wideblock = block.closest('.wide');
  const editbar = document.createElement('div');
  editbar.className = 'editbuttons';
  const iddiv = document.createElement('div');
  iddiv.textContent = id;
  iddiv.className = 'editid';
  const editalign = document.createElement('button');
  editalign.textContent = 'edit alignment';
  editalign.className = 'editalign';
  const updatealign = document.createElement('button');
  updatealign.className = 'updatealign';
  updatealign.textContent = 'update alignment';
  const updateapp = document.createElement('button');
  updateapp.className = 'updateapp';
  updateapp.textContent = 'update apparatus';
  editbar.append(iddiv, editalign, updatealign, updateapp);
  (wideblock || block).append(editbar);
  editbar.addEventListener('click',editbarClick.bind(null,root,id,xmlDoc));
};

const editbarClick = (root,id,xmlDoc,e) => {
  const editalign = e.target.closest('.editalign');
  if(editalign) {
    const alignlist = document.querySelector('#alignlist');
    const li = alignlist.querySelector(`li[data-blockid="${id}"]`);
    if(li) {
      alignlist.parentNode.open = true;
      li.click();
      setTimeout(() => li.scrollIntoView({behavior: 'smooth', block: 'center'}),300);
    }
    else alert('No alignment created yet.');
    return;
  }

  const par = e.target.getRootNode();

  const updatealign = e.target.closest('.updatealign');
  if(updatealign) {
    const path = root.host.dataset.path;
    alignPopup({par: e.target.getRootNode(), doc: xmlDoc, path: path, block: id});
    return;
  }

  const updateapp = e.target.closest('.updateapp');
  if(updateapp) {
    editApp({par: par, doc: xmlDoc, block: id});
    return;
  }
};

const closePopup = (blackout,e) => {
  blackout.style.display = 'none';
  for(const popup of blackout.shadowRoot.querySelectorAll('.popup'))
    popup.style.display = 'none';
};

const injectCSS = root => {
    const style = new CSSStyleSheet;
    style.replaceSync(
`
@font-face {
  'Alegreya Sans';
  src: url('../fonts/AlegreyaSans-Regular.ttf');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  'Alegreya Sans';
  src: url('../fonts/AlegreyaSans-Bold.ttf');
  font-weight: bold;
  font-style: normal;
}

#editbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgb(232,232,231);
  display: flex;
  font-family: 'Alegreya Sans';
}
#editblackout {
    z-index: 10;
    position: fixed;
    display: none;
    align-items: center;
    justify-content: center;
    left: 0;
    top: 0;
    width: 100vw;
    height: 100vh;
    background: none;
    backdrop-filter: blur(5px) brightness(60%) saturate(150%);
}
button {
    margin: 0 0.3rem 0 0.3em;
    padding: 0.3rem;
    font-size: 1.3rem;
    border-radius: 2px 2px 0 0;
    border: none;
    background: none;
    color: black;
    height: fit-content;
    font-size: 1.1rem;
    cursor: pointer;
}
button.important {
    font-weight: bold;
}
button.disabled {
    font-weight: normal;
    opacity: 0.5;
    cursor: default;
}
#topbar_messages {
  font-size: 1.1rem;
  padding: 0.35rem 0 0 0.3rem;
}

button:not(.disabled):hover {
  background-color: rgba(68,24,155,0.9);
  color: white;
}
#buttoncontainer {
    top: 1.4rem;
}

#button_savebutton {
  /*display: none;*/
}

.editbutton {
    height: 1.4rem;
    width: 1.4rem;
    background-color: rgb(249,202,121);
    border-color: rgb(240,202,121);
    border-radius: 0.3rem;
    padding: 0;
    margin: 0;
    position: relative;
    left: -1rem;
    top: 0;
    flex-shrink: 0;
}
.editbutton svg {
    height: 0.7rem;
    width: 0.7rem;
    position: relative;
    top: 0;
    left: 0.2rem;
}
.editbutton:hover {
    background-color: #eeee99;
    border-color: #eeee00;
}
.edited {
    border: 1px dashed red;
    border-radius: 10px;
    margin-bottom: 5px;
    margin-left: -5px;
    padding-left: 5px;
}

*:has(> .editbuttons), div.lg:has(> .editbuttons) {
  position: relative;
  padding-bottom: 1.5rem;
  margin-bottom: 1.5rem;
}

*:has(>.editbuttons):hover {
  background: rgb(245,245,238);
}

*:has(>.editbuttons):hover > .editbuttons {
  visibility: visible;
}

.editbuttons {
  font-family: 'Alegreya Sans';
  font-size: 1rem;
  display: flex;
  flex-direction: row;
  gap: 1rem;
  position: absolute;
  bottom: -1.5rem;
  width: 100%;
  visibility: hidden;
  background: rgb(245,245,238);
}

.editbuttons button {
  font-size: 1rem;
  border-radius: 2px;
  background: rgb(226,226,223);
  border: 1px solid black;
}
`
    );
    root.adoptedStyleSheets.push(style);
};

const fillBlocks = (par,blocks) => {
    const els = [...blocks].map(block => {
      const xmlid = block.getAttribute('xml:id');
      const obj = {textContent: xmlid, value: xmlid, dataset: {} };
      const corresp = block.getAttribute('corresp');
      if(corresp) obj.dataset.corresp = corresp.replaceAll(/#/g,'');
      /*
      const alignlist = document.getElementById('alignlist');
      const path = alignlist.querySelector(`[data-blockid="${xmlid}"]`)?.dataset.path;
      if(path && _state.alignments.has(path))
        obj.dataset.path = path;
      else 
        obj.disabled = true; 
      */
      return obj;
    });
    const blocklist = par.querySelector('#editblackout').shadowRoot.querySelector('#blocklist');
    blocklist.replaceChildren();
    appendList(blocklist,els);
};

const startEditMode = (par,xmlDoc,path) => {
  injectCSS(par);
  injectHTML(par,xmlDoc);
  const blocks = xmlDoc.querySelectorAll('text lg[*|id], text l[*|id], text p[*|id],text div[*|id]');
  fillBlocks(par,blocks);
  const topbar = document.createElement('nav');
  topbar.id = 'editbar';

  const alignbutton = document.createElement('button');
  alignbutton.id = 'button_alignbutton';
  alignbutton.append('Update alignments');
  topbar.appendChild(alignbutton);
  alignbutton.addEventListener('click',alignPopup.bind(null,{par: par, doc: xmlDoc, path: path}));

  const editbutton = document.createElement('button');
  editbutton.id = 'button_editbutton';
  editbutton.append('Update apparatus');
  topbar.appendChild(editbutton);
  editbutton.addEventListener('click',editApp.bind(null,{par: par, doc: xmlDoc}));

  const exportbutton = document.createElement('button');
  exportbutton.id = 'button_exportbutton';
  exportbutton.append('Export');
  topbar.appendChild(exportbutton);
  exportbutton.addEventListener('click',showExportOptions.bind(null,{par: par, doc: xmlDoc}));

  const savebutton = document.createElement('button');
  savebutton.className = 'important disabled';
  savebutton.id = 'button_savebutton';
  savebutton.append('Save');
  savebutton.addEventListener('click',saveDoc.bind(null,{doc: xmlDoc, path: path}));
  //savebutton.addEventListener('click',saveAs);
  topbar.appendChild(savebutton);

  const messagediv = document.createElement('div');
  messagediv.id = 'topbar_messages';
  topbar.appendChild(messagediv);

  par.firstChild.insertBefore(topbar, par.firstChild.firstChild);

  const allchanges = {attributes: true, childList: true, subtree: true, characterData: true};
  const observer = new MutationObserver(() => {
    savebutton.classList.remove('disabled');
    // catch the first mutation event, then sleep for 1 second
    observer.disconnect();
    setTimeout(() => observer.observe(xmlDoc.documentElement,allchanges), 1000);
  });
  observer.observe(xmlDoc.documentElement,allchanges);
};

const parseScript = el => {
  const lang = el.getAttribute('xml:lang');
  if(lang === 'ta') return ['Tamil','ta','tamil'];
  else if(lang.endsWith('-Deva'))
      return ['Devanagari','sa','devanagari']; // TODO: other languages
  return null;
};

const showExportOptions = (opts,e) => {
    const blackout = opts.par.querySelector('#editblackout');
    blackout.style.display = 'flex';
    blackout.shadowRoot.querySelector('#export-popup').style.display = 'flex';
    if(!blackout.shadowRoot.querySelector('#export-script')) {
      const script = parseScript(opts.doc.querySelector('text'));
      if(script) {
        const div = document.createElement('div');
        div.innerHTML = `<input id="export-script" type="checkbox" data-lang="${script[1]}" data-script="${script[2]}" checked="true" /><label for="export-script">Use ${script[0]} script</label>`;
        blackout.shadowRoot.querySelector('#export-options').appendChild(div);
      }
    }
};

const exportFile = async opts => {
    const outdoc = await exportLaTeX(opts.doc,'../',opts.root.querySelector('#editblackout').shadowRoot);
    const thisFilename = opts.root.host.dataset.path.split('/').pop();
    const basename = thisFilename.substring(0,thisFilename.lastIndexOf('.'));
    const fileHandle = await showSaveFilePicker({
        suggestedName: `${basename}.tex`,
        types: [
            { description: 'LaTeX', accept: { 'application/x-latex': [ '.tex'] } }
        ],
    });
    const file = new Blob([outdoc], {type: 'text/x-tex;charset=utf-8'});
    const writer = await fileHandle.createWritable();
    writer.write(file);
    writer.close();
};
const saveDoc = async (opts, e) => {
  const button = e.target.closest('button');
  if(button.classList.contains('disabled')) return;
  
  fsObserver.epause(true);
  fsObserver.wpause(true);
  const out = (new XMLSerializer()).serializeToString(opts.doc);
  const handle = _state.editions.get(opts.path)?.handle || _state.witnesses.get(opts.path)?.handle;
  const writable = await handle.createWritable();
  await writable.write(out);
  await writable.close();
  
  fsObserver.epause(false);
  fsObserver.wpause(false);

  for(const edited of button.getRootNode().querySelectorAll('.edited'))
    edited.classList.remove('edited');

  const msgbox = button.parentNode.querySelector('#topbar_messages');
  msgbox.textContent = `Saved to ${opts.path}.`;
  setTimeout(() => msgbox.textContent = '',1000);

  button.classList.add('disabled');
};

const alignPopup = async (opts,e) => {
  const blackout = opts.par.querySelector('#editblackout');
  blackout.style.display = 'flex';
  const shadow = blackout.shadowRoot;
  const popup = shadow.querySelector('#aligner-popup');
  popup.style.display = 'flex';
  const res = {alltexts: new Map(), allblocks: new Set()};
  const warnings = [];
 
  // do edition first
  warnings.push(...processFile(opts.doc, opts.path, res));
  const edblocks = [...res.allblocks];
  const edsigla = new Map(res.alltexts);
  const first = [...edsigla][0][0];
  shadow.querySelector('#targetedition').innerHTML = `<option value="${first}"></option>`;
  shadow.querySelector('#targetedition').value = first;
  res.alltexts = new Map();

  if(!popup.querySelector('#xmltags div')) {
    populateFilters(popup);
    languageSpecificOptions(opts.doc.querySelector('text'),popup);
  }

  // do witnesses
  for(const [path, obj] of _state.witnesses) {
    // TODO: use Promise.all()?
    const witdoc = await handleToXML(obj.handle);
    warnings.push(...processFile(witdoc, path, res));
  }

  const sigla = [...edsigla.keys(), ...[...res.alltexts.keys()].sort(natSort)];
  const fib = popup.querySelector('#file-input-box .checklist');
  appendList(fib, sigla);
  acPcButtons(fib,res.alltexts);
  const textblocklist = new Set(
    [...shadow.querySelectorAll('#blocklist input[value]')].map(i => i.value)
  );
  const blocks = [...res.allblocks].sort(natSort).map(b => {
    const obj = { textContent: b, value: b };
    if(!textblocklist.has(b)) obj.disabled = true;
    return obj;
  });;
  const xmlidsbox = popup.querySelector('#xml-ids-box .checklist');
  appendList(xmlidsbox, blocks);
  if(warnings.length > 0)
    alert(warnings.join('\n'));
  const button = document.createElement('button');

  button.textContent = 'Align';
  button.id = 'alignsubmit';
  shadow.querySelector('#submitdiv').replaceChildren(button);

  for(const [key, val] of [...edsigla])
    res.alltexts.set(key,val);
  button.addEventListener('click',align.bind(null, shadow, res.alltexts));

  if(opts.block) {
    const checkbox = xmlidsbox.querySelector(`input[value="${opts.block}"]`);
    if(!checkbox) return;

    checkbox.checked = true;
    checkbox.scrollIntoView({behavior: 'smooth', block: 'center'});
    // TODO: only select texts already aligned (if exists)?
    popup.querySelector('#file-input-box input[name="selectall"]').click();
  }
};

const updateAlignment = async (alignment, newdata) => {
  const alignobj = _state.alignments.get(alignment.path);
  const alignxml = alignment.xml;
  const NS = alignment.xml.documentElement.namespaceURI;
  for(const row of newdata.rows) {
    const existing = alignment.xml.querySelector(`TEI[n="${row.siglum}"]`);
    if(existing)
      existing.replaceChildren(row.text);
    else {
      const TEI = alignment.xml.createElementNS(NS,'TEI');
      TEI.setAttribute('n',row.siglum);
      TEI.appendChild(row.text);
      alignment.xml.documentElement.appendChild(TEI);
    }
  }
  
  const listWit = alignment.xml.querySelector('listWit');
  const tempel = alignment.xml.createElementNS(NS,'TEI');
  tempel.innerHTML = newdata.witnesses;
  for(const witness of tempel.firstChild.childNodes) {
    if(witness.nodeType !== 1) continue;
    const xmlid = witness.getAttribute('xml:id');
    const existingwit = listWit.querySelector(`[*|id="${xmlid}"]`);
    if(existingwit)
      listWit.replaceChild(witness.cloneNode(true),existingwit);
    else
      listWit.appendChild(witness.cloneNode(true));
  }

  const nexml = (new DOMParser()).parseFromString(newdata.tree, 'text/xml');
  const tree = nexml.querySelector('tree');
  const thisid = tree.getAttribute('id');
  if(alignment.xml.querySelector(`tree[id="${thisid}"]`)) {
    let n = 1;
    let newid = `${thisid}(${n})`;
    n = n + 1;
    while(alignment.xml.querySelector(`tree[id="${newid}"]`)) {
      newid = `${thisid}(${n})`;
      n = n + 1;
    }
    tree.setAttribute('id',newid);
    tree.setAttribute('label',`${tree.getAttribute('label')}(${n-1})`);
  }
  const xenoData = alignment.xml.querySelector('teiHeader > xenoData') || (() => {
    const header = alignment.xml.querySelector('teiHeader') || (() => {
      const h = alignment.xml.createElementNS(NS,'teiHeader');
      alignment.xml.documentElement.appendChild(h);
      return h;
    })();
    const newel = alignment.xml.createElementNS(NS,'xenoData');
    header.appendChild(newel);
    return newel;
  })();
  const stemmael = alignment.xml.createElementNS(NS,'stemma');
  stemmael.setAttribute('format','nexml');
  stemmael.id = 'stemma' + [...xenoData.querySelectorAll('stemma')].length;
  stemmael.appendChild(nexml.firstChild.cloneNode(true));
  xenoData.appendChild(stemmael);

  const out = (new XMLSerializer()).serializeToString(alignment.xml);
  const handle = _state.alignments.get(alignment.path).handle;
  const writable = await handle.createWritable();
  await writable.write(out);
  await writable.close();
};

const toIsh = (arr,lang) => {
  for(const text of arr) {
    if(text.remove) continue;
    const transliterated = lang === 'bo' ? 
      Sanscript.t(text.text,'wylie','wylish') :
      Sanscript.t(text.text,'iast','slpish');
    text.text = transliterated.replaceAll(/\s+/g,' ');
  }
};

const preProcess = async (shadow,alltexts) => {
  const res = alignPreflight(shadow, alltexts, true);
  const lang = res.meta.lang.split('-')[0];
  const splitfunc = findSplitfunc(res.meta.tokenization);

  for(const todo of res.todo) {
    const filepath = document.querySelector(`#alignlist li[data-blockid='${todo.block}']`)?.dataset.path;
    const alignfile = _state.alignments.get(filepath);
    if(alignfile) {
      const xml = await handleToXML(alignfile.handle);
      checkAlignment(xml,todo); // mutates workerdata
      if(todo.skip) {
        todo.workerdata[0] = [];
        continue;
      }
      todo.alignment = {path: filepath, xml: xml};
      todo.workerdata[0] = todo.workerdata[0].filter(el => !el.skip);
    }

    toIsh(todo.workerdata[0],lang);
    filterTexts(todo.workerdata[0],splitfunc,res.meta.filtersindices);
  }
  return res;
};

const align = async (shadow, alltexts, e) =>  {
  
  const res = await preProcess(shadow,alltexts);
  // TODO: save prefs

  const alignworker = new Worker('../lib/multialignworker.mjs',{type: 'module'});

  const messagediv = document.createElement('div');
  messagediv.id = 'alignmessage';
  const spinnerdiv = document.createElement('div');
  spinnerdiv.dataset.max = res.todo.length;
  spinnerdiv.dataset.cur = 0;
  spinnerdiv.id = 'alignspinner';
  spinnerdiv.className = 'spinner';
  spinnerdiv.style.display = 'block';
  shadow.querySelector('#alignsubmit').replaceWith(spinnerdiv, messagediv);

  const doOne = async (arr, num) => {
    if(num === arr.length) {
      // TODO: close popup, open alignments sidebar
      spinnerdiv.style.display = 'none';
      messagediv.textContent = `Done.`;
      sidebar.update('alignments');
      fsObserver.apause(false);
      setTimeout(() => shadow.querySelector('#aligner-popup .closeicon').click(),300);
      return;
    }

    const obj = arr[num];

    if(obj.skip === true) {
      messagediv.textContent = `Skipping ${obj.block}...`;
      doOne(arr, num + 1);
    }

    else if(obj.hasOwnProperty('alignment')) {

      messagediv.textContent = `Updating ${obj.block}...`;

      if(obj.workerdata[0].length === 0) {
        if(obj.remove.length === 0) console.log('something went wrong here');
        for(const id of obj.remove) {
          obj.alignment.xml.querySelector(`TEI[n="${id}"]`).remove();
        }
        const out = (new XMLSerializer()).serializeToString(obj.alignment.xml);
        const handle = _state.alignments.get(obj.alignment.path).handle;
        const writable = await handle.createWritable();
        await writable.write(out);
        await writable.close();

        doOne(arr, num + 1);
        return;
      }

      Realigner.init({xml: obj.alignment.xml, textsinfo: res.meta.alltexts});
      const bc = new BroadcastChannel('realigner');
      let ret;
      bc.onmessage = async e => { 
        if(e.data !== 'done') return;
        await updateAlignment(obj.alignment, ret);
        messagediv.textContent = `Wrote to ${obj.alignment.path}.`;
        doOne(arr,num + 1);
        bc.close();
      };
      const opts = {
        tokenization: res.meta.tokenization,
        recursive: res.meta.scoring.recursive, 
        targeted: res.meta.targetedition, 
        scores: {...res.meta.scoring, prop: 'norm' },
        lang: obj.workerdata[0][0].lang.split('-')[0]
      };
      const toremove = new Set(obj.toremove || []);
      ret = Realigner.realign(obj.workerdata[0],toremove,opts);
    }

    else {
      messagediv.textContent = `Aligning ${obj.block}...`;
      alignworker.onmessage = async e => {
        if(e.data.hasOwnProperty('progress')) {
          if(e.data.hasOwnProperty('message')) messagediv.textContent = e.data.message;
          return;
        }
        const filtersmap = new Map(obj.workerdata[0].map(t => [t.siglum,t.filters]));
        const newmeta = {block: obj.block};
        Object.assign(newmeta,res.meta);
        const finished = postProcess(e.data,filtersmap,newmeta);
        const fname = obj.block + '.xml';
        const handle = await _state.alignmentsdirHandle.getFileHandle(fname, {create: true});
        const writable = await handle.createWritable();
        await writable.write(finished);
        await writable.close();
        await maybeAddTo(handle,_state.alignmentsdir + '/',_state.alignments,'teiCorpus');
        doOne(arr, num + 1);
      }
      alignworker.postMessage(obj.workerdata);
    }
  };
  fsObserver.apause(true);
  doOne(res.todo,0);
};

const collate = async (xmlDoc,e) => {
  const popup = e.target.closest('#variants-popup');
  const shadow = popup.getRootNode().host.getRootNode();
  const filename = shadow.host.dataset.path;
  //const doc = await handleToXML(_state.editions.get(filename).handle);
  const alignments = new Map([..._state.alignments].map(el => {
      return [el[1].blockid, {
        filename: el[1].filename,
        path: el[0],
        handle: el[1].handle
      }];
    })
  );
  const opts = {
    mode: 'filesystem',
    witnesses: new Map([..._state.witnesses,..._state.editions])
  };
  const blocklist = await doCollate(xmlDoc,shadow,alignments,popup,opts);
  addEditButtons(shadow,blocklist,xmlDoc);
};

const checkAlignment = (alignfile, todo) => {
  let skipall = true;
  const toremove = [];
  for(const text of todo.workerdata[0]) {
    const alignblock = alignfile.querySelector(`TEI[n='${text.siglum}']`);
    if(!alignblock) {
      skipall = false;
      continue;
    }
    const ws = [...alignblock.querySelectorAll('w')];
    const aligntext = ws.reduce((a,c) => a + c.textContent,'');
    if(aligntext === text.text) text.skip = true;
    else skipall = false;
  }
  for(const block of alignfile.querySelectorAll('TEI')) {
    const siglum = block.getAttribute('n');
    const text = todo.workerdata[0].find(el => el.siglum === siglum);
    if(!text) {
      toremove.push(siglum);
      skipall = false;
    }
  }
  if(skipall) todo.skip = true;
  if(toremove.length > 0) todo.remove = toremove;
};

const editApp = (opts,e) => {
  const blackout = opts.par.querySelector('#editblackout');
  blackout.style.display = 'flex';
  const shadow = blackout.shadowRoot;
  shadow.querySelector('#variants-popup').style.display = 'flex';
  const alignlist = document.getElementById('alignlist');
  shadow.querySelector('#blocklist input[name="selectall"]').checked = false;
  if(opts.block) {
    const targblock = shadow.querySelector(`#blocklist input[value="${opts.block}"]`);
    const path = alignlist.querySelector(`[data-blockid="${targblock.value}"]`)?.dataset.path;
    if(path && _state.alignments.has(path)) {
      targblock.dataset.path = path;
      targblock.checked = true;
    }
    else 
     targblock.disabled = true; 

    targblock.scrollIntoView({behavior: 'smooth', block: 'center'});
  }

  // then do the rest in order
  for(const input of shadow.querySelectorAll('#blocklist input[type="checkbox"][value]')) {
    if(input.value === opts.block) continue;
    input.checked = false;
    const path = alignlist.querySelector(`[data-blockid="${input.value}"]`)?.dataset.path;
    if(path && _state.alignments.has(path))
      input.dataset.path = path;
    else 
      input.disabled = true; 
  }
};

const hijackLinks = par => {
  const aViewer = new AlignmentViewer(par);

  par.addEventListener('click', async e => {
    const msid = e.target.closest('a.msid');
    if(msid) {
      e.preventDefault();
      const url = new URL(msid.href,'http://localhost');
      const path = url.pathname.replace(/^\//,'');
      const lis = [...document.querySelectorAll('#filelist-content li[data-path]')].sort((a,b) => b.dataset.path.length - a.dataset.path.length);
      for(const li of lis) {
        if(path.endsWith(li.dataset.path)) {
            const search = new URLSearchParams(url.search);
            sidebar.click({target: li},search);
            return;
        }
      }
    }
    const apointer = e.target.closest('.alignment-pointer');
    if(apointer) {
      e.preventDefault();
      const url = new URL(apointer.href,'http://localhost');
      const path = url.pathname.replace(/^\//,'');
      const lis = [...document.querySelectorAll('#alignlist li[data-path]')].sort((a,b) => b.dataset.path.length - a.dataset.path.length);
      for(const li of lis) {
        if(path.endsWith(li.dataset.path)) {
            const handle = _state.alignments.get(li.dataset.path).handle;
            const xml = await handleToXML(handle);
            aViewer.showXML(xml);
            return;
        }
      }
    }
  });
};

const isXML = async (handle,opts) => {
  const parel = opts.type || 'TEI';
  if(!handle.name.endsWith('.xml')) return false;

  const xml = await handleToXML(handle);
  if(xml.documentElement.nodeName === parel)
    return xml;
  else return false;
};

const maybeAddTo = async (entry, path, filemap, type = 'TEI') => {
  if(entry.kind === 'file') {
    const teiFile = await isXML(entry,{type: type});
    if(teiFile) {
      const obj = {
        filename: entry.name,
        handle: entry
      };
      const title = teiFile.querySelector('titleStmt > title')?.textContent;
      if(title) obj.title = title;
      if(type === 'teiCorpus') {
        const blockid = teiFile.querySelector('ab[type="blockid"]')?.textContent || 
          entry.name.replace(/\.xml$/,'');
        obj.blockid = blockid;
      }
      filemap.set(path + entry.name,obj);
      return obj;
    }
  }
};

const insertListItem = (path, li, listid, objmap) => {
  const keys = [...objmap].sort((a, b) => natSort(a[1].filename,b[1].filename)).map(e => e[0]); 
  const index = keys.indexOf(path);
  const list = document.getElementById(listid);
  if(index === 0)
    list.prepend(li);
  else {
    const prepath = keys[index - 1];
    list.querySelector(`li[data-path="${prepath}"]`).insertAdjacentElement('afterend',li);
  }
};

const fsObserver = {
  aobserver: null,
  apause: state => state === true ? 
    fsObserver.aobserver.disconnect(): 
    fsObserver.aobserver.observe(_state.alignmentsdirHandle),
  eobserver: null,
  epause: state => state === true ?
    fsObserver.eobserver.disconnect(): 
    fsObserver.eobserver.observe(_state.dirHandle),
  wobservers: [],
  wpause: state => {
    if(state === true)
      for(const obs of fsObserver.wobservers)
        obs[0].disconnect();
    else
      for(const obs of fsObserver.wobservers)
        obs[0].observe(obs[1]);
  }
};
fsObserver.editions = async (records, _) => {
  for(const record of records) {
    if(!record.relativePathComponents[0].endsWith('.xml')) continue;

    if(record.type === 'modified') {
      if(_state.editionfiles.length > 0 && !_state.editionfiles.includes(record.changedHandle.name))
        continue;
      const path = record.changedHandle.name;
      const existing = _state.editions.get(path);
      if(existing) {
        const li = document.querySelector(`#edlist li[data-path="${path}"]`);
        if(li) {
          if(li.classList.contains('loaded'))
            li.classList.add('modified'); 
          if(li.classList.contains('active')) {
            warnModified(path);
          }
        }
      }
      else { // make new item
        const obj = await maybeAddTo(record.changedHandle,'',_state.editions);
        const li = sidebar.makeListItem(path,obj);
        insertListItem(path, li, 'edlist', _state.editions);
      }
    }
    if(record.type === 'disappeared') {
      //if(!record.relativePathComponents[0].endsWith('.xml')) continue;
      if(_state.editionfiles.length > 0 && !_state.editionfiles.includes(record.relativePathComponents[0]))
        continue;
      const key = record.relativePathComponents[0];
      _state.editions.delete(key);
      document.querySelector(`#edlist > li[data-path="${key}"]`).remove();
      // TODO: warn about deletion
    }
  }
};
fsObserver.witnesses = async (records, _) => {
  for(const record of records) {
    if(!record.relativePathComponents[0].endsWith('.xml')) continue;

    const dirname = record.root.name + '/';

    if(record.type === 'modified') {
      if(_state.editionfiles.length > 0 && _state.editionfiles.includes(record.changedHandle.name))
        continue;
      const path = dirname + record.changedHandle.name;
      const existing = _state.witnesses.get(path);
      if(existing) {
        const li = document.querySelector(`#witlist li[data-path="${path}"]`);
        if(li) {
          if(li.classList.contains('loaded'))
            li.classList.add('modified'); 
          if(li.classList.contains('active')) {
            warnModified(path);
          }
        }
      }
      else { // maye new item
        const obj = await maybeAddTo(record.changedHandle,dirname,_state.witnesses);
        const li = sidebar.makeListItem(path,obj);
        insertListItem(path, li, 'witlist', _state.witnesses);
      }
    }

    if(record.type === 'disappeared') {
      if(_state.editionfiles.length > 0 && _state.editionfiles.includes(record.relativePathComponents[0]))
        continue;
      const key = dirname + record.relativePathComponents[0];
      _state.witnesses.delete(key);
      document.querySelector(`#witlist > li[data-path="${key}"]`).remove();
      // TODO: warn about deletion
    }
  }
};
fsObserver.alignments = async (records, _) => {
  for(const record of records) {
    if(!record.relativePathComponents[0].endsWith('.xml')) continue;

    if(record.type === 'modified') {
      //if(!record.changedHandle.name.endsWith('.xml')) continue;

      const path = _state.alignmentsdir + '/' + record.changedHandle.name;
      const existing = _state.alignments.get(path);
      if(existing) {
        const li = document.querySelector(`#alignlist li[data-path="${path}"]`);
        if(li) {
          if(li.classList.contains('loaded'))
            li.classList.add('modified'); 
          if(li.classList.contains('active')) {
            warnModified(path);
          }
        }
      }
      else { // make new item
        const obj = await maybeAddTo(record.changedHandle,_state.alignmentsdir + '/',_state.alignments,'teiCorpus');
        const li = sidebar.makeListItem(path,obj);
        insertListItem(path, li, 'alignlist', _state.alignments);
      }
    }
    if(record.type === 'disappeared') {
      //if(!record.relativePathComponents[0].endsWith('.xml')) continue;
      const key = _state.alignmentsdir + '/' + record.relativePathComponents[0];
      _state.alignments.delete(key);
      document.querySelector(`#alignlist > li[data-path="${key}"]`).remove();
    }
  }
};

const warnModified = filename => {
  document.getElementById('blackout').style.display = 'block';
  if(!filename) filename = document.querySelector('li.active').dataset.path;
  document.getElementById('modified_filename').textContent = filename;
};

const warnModifiedActions = async e => {
  const blackout = document.getElementById('blackout');
  const ignore = e.target.closest('#modified_ignore');
  if(ignore) {
    blackout.style.display = 'none';
    return;
  }

  const filename = blackout.querySelector('#modified_filename').textContent;
  const li =  document.querySelector('li.active');
  closeBox(li,false);
  openBox(li);
  li.classList.remove('modified');
  blackout.style.display = 'none';
};

const loadPrefs = async handle => {
  const file = await handle.getFile();
  const text = await file.text();
  const json = parseJson(text);
  if(!json) {
    // save default prefs
    const prefsobj = {};
    prefsobj.editionfiles = _state.editionfiles;
    prefsobj.witnessesdirs = _state.witnessesdirs;
    prefsobj.alignmentsdir = _state.alignmentsdir;
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(prefsobj));
    await writable.close();
  }
  else {
    if(json.editionfiles) _state.editionfiles = json.editionfiles;
    if(json.witnessesdirs) _state.witnessesdirs = json.witnessesdirs;
    if(json.alignmentsdir) _state.alignmentsdir = json.alignmentsdir;
  }
};

const parseJson = str => {
  let ret;
  try {
    ret = JSON.parse(str);
  }
  catch(e) {
    return null;
  }
  return ret;
};

const loadDir = async () => {
    _state.dirHandle = await window.showDirectoryPicker({mode: 'readwrite'});

    const confighandle = await _state.dirHandle.getFileHandle('saktumiva.config.json',{create: true});
    await loadPrefs(confighandle);

    if(_state.witnessesdirs.includes('.')) _state.witnessesdirHandles.push(_state.dirHandle);
    // TODO: switch to Promise.all

    for await(const entry of _state.dirHandle.values()) {

      if(entry.kind === 'file') {
        if(_state.editionfiles.length > 0) {
          if(_state.editionfiles.includes(entry.name))
            await maybeAddTo(entry,'',_state.editions);
          else if(_state.witnessesdirs.includes('.')) {
            await maybeAddTo(entry,'',_state.witnesses);
          }
        }
        else
          await maybeAddTo(entry,'',_state.editions);
      }

      if(entry.kind === 'directory' && _state.witnessesdirs.includes(entry.name)) {
        _state.witnessesdirHandles.push(entry);
        for await(const witness of entry.values())
          await maybeAddTo(witness,entry.name + '/',_state.witnesses);
      }
      if(entry.kind === 'directory' && entry.name === _state.alignmentsdir) {
        _state.alignmentsdirHandle = entry;
        for await(const alignment of entry.values())
          await maybeAddTo(alignment,_state.alignmentsdir + '/',_state.alignments,'teiCorpus');
      }
    }
    sidebar.update();
    sidebar.show();

    fsObserver.eobserver = new FileSystemObserver(fsObserver.editions);
    fsObserver.eobserver.observe(_state.dirHandle);
    for(const handle of _state.witnessesdirHandles) {
      const obs = new FileSystemObserver(fsObserver.witnesses);
      obs.observe(handle);
      fsObserver.wobservers.push([obs,handle]);
    }
    fsObserver.aobserver = new FileSystemObserver(fsObserver.alignments);
    fsObserver.aobserver.observe(_state.alignmentsdirHandle);

    document.getElementById('loader').style.display = 'none';
};

const init = () => {
  document.getElementById('startbutton').addEventListener('click', loadDir);
  sidebar.el = document.getElementById('filelist-content');
  document.getElementById('filelist').addEventListener('click',sidebar.click);
  document.getElementById('modified_warning').addEventListener('click',warnModifiedActions);
  const bc = new BroadcastChannel('matrix-editor');
  bc.onmessage = e => {
    if(e.data.state === 'saving')  {
      fsObserver.apause(true);
    }
    if(e.data.state === 'saved') {
      fsObserver.apause(false);
    }
  }
};

window.addEventListener('load',init);
