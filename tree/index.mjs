import { showSaveFilePicker } from '../lib/native-file-system-adapter/es6.js';
import { filters as allFilters } from '../lib/normalize.mjs';
import tagsToIgnore from '../lib/tagfilters.mjs';
import JSZip from '../lib/jszip.mjs';
import { processFile, preProcess, groupBySpace, findSplitfunc } from '../lib/collate.mjs';
import { parseString, readOne } from '../lib/browserutils.mjs';
import guideTree from '../lib/tree.mjs';

const _state = {
    alltexts: new Map(),
    allblocks: new Set()
};

const natSort = (new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'})).compare;

const serializeXML = doc => {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
};

/*
const upload = async (arr) => {
    const files = arr.map(file => {
        return readOne(file);
    });
    return await Promise.all(files);
};
*/

const languageSpecificOptions = textel => {
    const langcode = textel.getAttribute('xml:lang') || textel.querySelector('[*|lang]')?.getAttribute('xml:lang');
    if(!langcode) return;
    
    const lang = langcode === 'ta' || langcode.startsWith('ta-Taml') ? 'tamil' :
                 langcode === 'sa' || langcode.startsWith('sa-Latn') ? 'sanskrit' :
                 langcode === 'pi' || langcode.startsWith('pi-Latn') ? 'pali' :
                 langcode === 'bo' || langcode.startsWith('bo-') ? 'tibetan' :
                 null;
    if(!lang) return;

    const normies = document.getElementById('normalization');
    normies.querySelector('input').checked = true; // ignore punctuation
    if(lang === 'pali') 
        normies.querySelector('input[value="1"').checked = true; // ignore case
    if(lang === 'sanskrit' || lang === 'tamil' || lang === 'pali')
        normies.querySelector(`label[title="Search: \\\\s Replace: () => ''"]`).previousElementSibling.checked = true; // remove spaces

    const filterhead = lang === 'sanskrit' ? normies.querySelector('.sanskrit') :
                    lang === 'tamil' ? normies.querySelector('.tamil') :
                    lang === 'pali' ? normies.querySelector('.pali') :
                    null;
    if(filterhead) {
        const input = filterhead.parentNode.querySelector('input');
        if(!input.checked) {
            input.click();
            filterhead.open = false;
        }
        if(lang === 'tamil') {
            const arr = [5,6,7,8,9,10];
            for(const n of arr)
                filterhead.parentNode.querySelector(`input[value="${n}"]`).click();
        }
    }
};

const updatePreview = async () => {
    const preview = document.getElementById('file-input-box');
    const input = document.getElementById('teifiles');

    const files = [...input.files];
    if(files.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No files selected.';
        preview.querySelector('.checklist').appendChild(p);
        return;
    }

    for(const file of files) {
        const text = await readOne(file);
        const teixml = parseString(text,file.name);
        const warnings = processFile(teixml, file.name, _state);
        if(warnings.length !== 0)
            for(const warning of warnings)
                alert(warning);
    }
    
    const sigla = [..._state.alltexts.keys()].sort(natSort);
    appendList(preview.querySelector('.checklist'), sigla);
        
    document.getElementById('treesubmit').style.display = 'block';
    document.querySelector('.options').style.display = 'flex';
    
    preview.querySelector('legend').style.display = 'block';
    const buttonlabel = preview.querySelector('label[for="teifiles"]');
    buttonlabel.textContent = 'Add more TEI XML files';
    preview.style.border = '1px solid grey';
    document.getElementById('button_noac').style.display = 'block';
    document.getElementById('button_nopc').style.display = 'block';
    languageSpecificOptions(_state.alltexts.entries().next().value[1].textel);

};

const appendList = (par, els) => {
    par.innerHTML = '';
    const item1 = document.createElement('div');
    const input1 = document.createElement('input');
    input1.setAttribute('type','checkbox');
    input1.setAttribute('name','selectall');
    input1.id = `input_${Date.now() + Math.random()}`;
    const label1 = document.createElement('label');
    label1.textContent = 'Select all';
    label1.setAttribute('for',input1.id);
    item1.appendChild(input1);
    item1.appendChild(label1);
    par.appendChild(item1);
    for(const el of els) {
        const item = document.createElement('div');
        const input = document.createElement('input');
        input.id = `input_${Date.now() + Math.random()}`;
        input.setAttribute('type','checkbox');
        const label = document.createElement('label');
        label.setAttribute('for',input.id);
        label.textContent = el;
        item.appendChild(input);
        item.appendChild(label);
        par.appendChild(item);
    }
};

const getFilterIndices = () => {
    const ret = [];
    const par = document.getElementById('normalization');
    for(const box of par.querySelectorAll('input:checked')) {
        const i = parseInt(box.value);
        if(isNaN(i)) continue;
        ret.push([i,box.nextElementSibling.textContent]);
    }
    ret.sort((a,b) => a[0] - b[0]);
    //return [ret.map(r => r[0]), ret.map(r => r[1])];
    return ret.reduce((acc,cur) => {
        acc[0].push(cur[0]);
        acc[1].push(cur[1]);
        return acc;
    },[[],[]]);
};

const getTagFilters = () => {
    const ret = [];
    const par = document.getElementById('xmltags');
    for(const box of par.querySelectorAll('input:checked')) {
        ret.push(box.value);
    }
    return ret;
};

const getSelected = par => {
    const ret = [];
    for(const input of par.querySelectorAll('input')) {
        if(input.getAttribute('name') === 'selectall')
            continue;
        if(!input.checked)
            continue;
        ret.push(input.nextElementSibling.textContent);
    }
    return ret;
};

const getScores = () => {
    const nums = [...document.querySelectorAll('#scoring input.score')].map(i => parseFloat(i.value));
    const recursive = document.getElementById('check_recursive').checked;
    const scalegap = document.getElementById('input_scalegap').checked;
    const distancefunc = document.getElementById('treetype_ncd').checked ? 'ncd' : 'ngrams';
    const ngramsize = document.getElementById('tree_ngramsize').value;
    return {scores: nums, recursive: recursive, distancefunc: distancefunc, ngramsize: ngramsize, scalegap: scalegap};
};

const makeTree = () => {
    const tok = document.querySelector('input[name="tokenization"]:checked').value;
    const splitfunc = findSplitfunc(tok);

    const selectedsigla = getSelected(document.getElementById('file-input-box'));
    if(selectedsigla.length < 2) {
        alert('Select at least two texts.');
        return;
    }
    
    document.getElementById('blackout').style.display = 'flex';
    const popupmessage = document.getElementById('popupmessage');
    popupmessage.innerHTML = '';
    const spinner = document.getElementById('spinner');
    spinner.style.display = 'flex';
    spinner.style.background = 'linear-gradient(0deg, rgb(240,202,121) 50%, rgb(50,50,50,0.3) 100%';

    const [filtersindices, filtersnames] = getFilterIndices();
    const tagfilters = getTagFilters();

    const selectedtexts = selectedsigla.map(s => {return {siglum: s, text:_state.alltexts.get(s)};});
    const texts = preProcess(null, selectedtexts, {splitfunc: splitfunc, selectedfilters: filtersindices, ignoretags: tagfilters}); 
    const distancefunc = document.getElementById('treetype_ncd').checked ? 'ncd' : 'ngrams';
    const ngramsize = document.getElementById('tree_ngramsize').value;
    
    const textarr = texts.map(a => [a.siglum, a.text]).sort((a,b) => a[0].localeCompare(b[0]));
    //const guidetree = guideTree(textarr, distancefunc, ngramsize);
    const treeWorker = new Worker('./treeworker.mjs',{type: 'module'});
    treeWorker.onmessage = e => {
      const nexus = nexusExport(e.data);

      document.getElementById('spinner').style.display = 'none';
      popupmessage.innerHTML = `<button id="treesave">Save file</button></div>`;
      document.getElementById('treesave').addEventListener('click', saveAs.bind(null,nexus));
    }
    treeWorker.postMessage([textarr, distancefunc, ngramsize]);
};

const nexusExport = matrix => {
  const flatmatrix = matrix.matrix.map((row,n) => matrix.ids[n] + ' ' + row.join(' ')).join('\n');
  const str =
`#NEXUS

BEGIN TAXA;
  DIMENSIONS NTAX=${matrix.ids.length};
  TAXLABELS ${matrix.ids.join(' ')};
END;

BEGIN DISTANCES;
  FORMAT TRIANGLE=BOTH;
  MATRIX
${flatmatrix}
;
END;
`;
  return str;
};

const saveAs = async str => {
  document.getElementById('blackout').style.display = 'none';

  const fname = 'tree.nex';
  const file = new Blob([str], {type: 'text/nexus;charset=iso8859-1'});
  const fileHandle = await showSaveFilePicker({
    _preferPolyfill: false,
    suggestedName: fname,
    types: [ {description: 'NEXUS', accept: {'text/nexus': ['.nex']} } ],
  });
  const writer = await fileHandle.createWritable();
  writer.write(file);
  writer.close();

};

const updateCheckboxes = e => {
    if(e.target.tagName !== 'INPUT') return;
    const par = e.target.closest('.checklist');
    const parbox = par.querySelector('input[name="selectall"]');
    if(e.target === parbox) {
        for(const box of par.querySelectorAll('input')) {
            box.checked = parbox.checked;
        }
        return;
    }

    let checked = null;
    let unchecked = null;
    for(const box of par.querySelectorAll('input')) {
        if(box === parbox) continue;
        if(box.checked)
            checked = true;
        else unchecked = true;
        if(checked === true && unchecked === true) {
            parbox.indeterminate = true;
            return;
        }
    }
    if(checked) parbox.checked = true;
    else parbox.checked = false;
    parbox.indeterminate = false;
};

const makeOption = (index,obj) => {
    const div = document.createElement('div');
    const box = document.createElement('input');
    box.setAttribute('type','checkbox');
    box.id = `checkbox_${Date.now() + Math.random()}`;
    box.value = index;
    if(obj.hasOwnProperty('checked')) {
      if(obj.checked === true) box.setAttribute('checked',true);
      else box.dataset.default = 'off';
    }
    const label = document.createElement('label');
    label.setAttribute('for',box.id);
    if(obj.search && obj.replace)
        label.title = `Search: ${obj.search} Replace: ${obj.replace.toString()}`;
    label.append(obj.name);
    div.appendChild(box);
    div.appendChild(label);
    return div;
};

const checkAll = e => {
    const details = e.target.parentNode.querySelector('details');
    details.open = true;
    const kids = details.querySelectorAll('input');
    for(const kid of kids) {
        if(kid.dataset.default === 'off')
          continue;
        else
          kid.checked = e.target.checked;
    }
};

const uncheckAC = () => uncheckType('ac');
const uncheckPC = () => uncheckType('pc');
const uncheckType = acpc => {
  let indet = false;
  let parbox;
  for(const input of document.querySelectorAll('#file-input-box > .checklist input')) {
    if(input.name === 'selectall') parbox = input;
    const siglum = input.nextElementSibling.textContent;
    const text = _state.alltexts.get(siglum);
    if(text?.type === acpc) {
      input.checked = false;
      indet = true;
    }
  }
  if(indet && parbox.checked) parbox.indeterminate = true;
};

const updateBoxes = e => {
    if(e.target.tagName !== 'INPUT') return;
    const par = e.target.closest('details');
    const parbox = par.parentNode.querySelector('input');
    let checked = null;
    let unchecked = null;
    for(const box of par.querySelectorAll('input')) {
        if(box.checked)
            checked = true;
        else unchecked = true;
        if(checked === true && unchecked === true) {
            parbox.indeterminate = true;
            return;
        }
    }
    if(checked) parbox.checked = true;
    else parbox.checked = false;
    parbox.indeterminate = false;
};

const closeBlackout = e => {
	if(e.target.closest('#popup')) return;
    if(!document.querySelector('#popup button')) return;
	document.getElementById('blackout').style.display = 'none';
};

window.addEventListener('load', () => {
    document.getElementById('teifiles').addEventListener('change',updatePreview);
    for(const box of document.querySelectorAll('.checklist'))
        box.addEventListener('click',updateCheckboxes);
    
    document.getElementById('button_noac').addEventListener('click',uncheckAC);
    document.getElementById('button_nopc').addEventListener('click',uncheckPC);

    document.getElementById('treesubmit').addEventListener('click', makeTree);
	
    document.getElementById('blackout').addEventListener('click',closeBlackout);

    const normies = document.getElementById('normalization');
    
    for(const checkbox of normies.querySelectorAll('input'))
        checkbox.addEventListener('click',checkAll);

    const tamil = normies.querySelector('details.tamil');
    tamil.addEventListener('click',updateBoxes);
    const sanskrit = normies.querySelector('details.sanskrit');
    sanskrit.addEventListener('click',updateBoxes);
    const pali = normies.querySelector('details.pali');
    pali.addEventListener('click',updateBoxes);

    for(const [i, filter] of allFilters.entries()) {
        if(filter.group === 'general')
            normies.insertBefore(makeOption(i,filter),tamil.parentNode);
        else if(filter.group === 'tamil')
            tamil.appendChild(makeOption(i,filter));
        else if(filter.group === 'pali')
            pali.appendChild(makeOption(i,filter));
        else
            sanskrit.appendChild(makeOption(i,filter));
    }
    const xmltags = document.getElementById('xmltags');
    for(const tag of tagsToIgnore) {
        const opt = makeOption(tag,{name: `Ignore <${tag}>`,checked: true});
        xmltags.appendChild(opt);
    }
});

