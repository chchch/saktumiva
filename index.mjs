import { showSaveFilePicker } from './lib/native-file-system-adapter/es6.js';
import { filters as allFilters } from './lib/normalize.mjs';
import tagsToIgnore from './lib/tagfilters.mjs';
import JSZip from './lib/jszip.mjs';
import { processFile, preProcess, postProcess, groupBySpace, findSplitfunc } from './lib/collate.mjs';
import { parseString, readOne } from './lib/browserutils.mjs';
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
                 langcode === 'bo' || langcode.startsWith('bo-Tibt') ? 'tibetan' :
                 null;

    if(!lang) return;

    const toks = document.querySelectorAll('input[name="tokenization"]');
    for(const tok of toks) {
        if(tok.value === 'grapheme' && lang === 'tamil')
            tok.checked = true;
        else if(tok.value === 'character' && lang === 'sanskrit' || lang === 'pali')
            tok.checked = true;
        else if (tok.value === 'whitespace' && lang === 'tibetan')
            tok.checked = true;
        else
            tok.checked = false;
    }

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
    const idpreview = document.getElementById('xml-ids-box');
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
    updateTargetEd(sigla);
    appendList(preview.querySelector('.checklist'), sigla);
    appendList(idpreview.querySelector('.checklist'), [..._state.allblocks].sort(natSort));
        
    document.getElementById('alignsubmit').style.display = 'block';
    document.querySelector('.options').style.display = 'flex';
    
    idpreview.style.opacity = 1;
    idpreview.style.display = 'flex';

    preview.querySelector('legend').style.display = 'block';
    const buttonlabel = preview.querySelector('label[for="teifiles"]');
    buttonlabel.textContent = 'Add more TEI XML files';
    preview.style.border = '1px solid grey';
    preview.querySelector('legend').style.display = 'block';

    languageSpecificOptions(_state.alltexts.entries().next().value[1].textel);

};

const updateTargetEd = sigla => {
    const select = document.getElementById('targetedition');
    const selected = select.value || 'Ed';
    select.innerHTML = '';
    for(const siglum of sigla) {
        const option = document.createElement('option');
        option.setAttribute('value',siglum);
        option.textContent = siglum;
        if(selected === siglum)
            option.setAttribute('selected',true);
        select.appendChild(option);
    }
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

const getSelected = (par) => {
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
    const distancefunc = document.getElementById('treetype_ncd').checked ? 'ncd' : 'ngrams';
    const ngramsize = document.getElementById('tree_ngramsize').value;
    return {scores: nums, recursive: recursive, distancefunc: distancefunc, ngramsize: ngramsize};
};

const align = () => {
    const tok = document.querySelector('input[name="tokenization"]:checked').value;

    const splitfunc = findSplitfunc(tok);

    const scores = getScores();
    const scoring = {
        match: scores.scores[0],
        mismatch: scores.scores[1],
        gap_open: scores.scores[2],
        gap_extend: scores.scores[3],
        gap_skip_initial: true,
        scalegap: false,
        recursive: scores.recursive,
        realigndepth: scores.scores[4],
        distancefunc: scores.distancefunc,
        ngramsize: scores.ngramsize
    };
    const configfunc = tok === 'character' ? 'character' : 
        scores.recursive ? 'arr' : 'arr_simple';

    const selectedsigla = getSelected(document.getElementById('file-input-box'));
    const selectedblocks = getSelected(document.getElementById('xml-ids-box'));
    if(selectedblocks.length === 0 || selectedsigla.length === 0) {
        alert('Nothing selected to be aligned.');
        return;
    }
    
    const [filtersindices, filtersnames] = getFilterIndices();
    const tagfilters = getTagFilters();
    const targetedition = document.getElementById('targetedition').value;

    document.getElementById('blackout').style.display = 'flex';
    document.getElementById('popupmessage').innerHTML = '';
    document.getElementById('spinner').style.display = 'flex';

    
    const alignedblocks = new Map();
    const todo = [];
    const selectedtexts = selectedsigla.map(s => 
        { 
            return {siglum: s,text:_state.alltexts.get(s)};
        });
    for(const block of selectedblocks) {
        const texts = preProcess(block, selectedtexts, {splitfunc: splitfunc, selectedfilters: filtersindices, ignoretags: tagfilters}); 
        if(texts.length === 1) {
            alert(`Nothing to align in ${block}.`);
            continue;
        }

        todo.push({workerdata: [texts,configfunc,scoring], block: block});
    }

    const meta = {
        alltexts: _state.alltexts,
        filtersnames: filtersnames,
        tagfilters: tagfilters,
        lang: todo[0].workerdata[0][0].lang,
        tokenization: tok,
        scoring: scoring,
        targetedition: targetedition
    };

    const alignWorker = new Worker('./lib/multialignworker.mjs',{type: 'module'});
    let n = 0;
    document.getElementById('popupmessage').textContent = `Aligning ${todo[n].block}...`;
    alignWorker.postMessage(todo[n].workerdata);
    alignWorker.onmessage = e => {
        if(e.data.hasOwnProperty('progress')) {
            const p = e.data.progress * 100;
            document.getElementById('spinner').style.background = 
                `linear-gradient(0deg, rgb(240,202,121) ${p-5}%, rgb(50,50,50,0.3) ${p}%`;
            if(e.data.hasOwnProperty('message'))
                document.getElementById('popupmessage').textContent = e.data.message;
            return;
        }
        const filtersmap = new Map(todo[n].workerdata[0].map(t => [t.siglum,t.filters]));
        const newmeta = {block: todo[n].block};
        Object.assign(newmeta, meta);
        const finished = postProcess(e.data,filtersmap,newmeta);

        // TODO: add option here
        const grouped = groupBySpace(parseString(finished,todo[n].block),targetedition);
        const serialized = serializeXML(grouped);
        alignedblocks.set(todo[n].block,serialized);

        n = n + 1;

        if(n < todo.length) {
            document.getElementById('popupmessage').textContent = `Aligning ${todo[n].block}...`;
            alignWorker.postMessage(todo[n].workerdata);
        }
        else {
            document.getElementById('spinner').style.display = 'none';
            if(alignedblocks.size === 1)
                document.getElementById(`popupmessage`).innerHTML = `<div class="vertcentre"><button id="xmlopen">Open file</button><button id="xmlsave">Save file</button></div>`;
            else {
                document.getElementById('popupmessage').innerHTML = '<div class="vertcentre"><button id="xmlopen">Open files</button><button id="xmlsave">Save each file</button><button id="xmlsave2">Save ZIP</button>';
                document.getElementById('xmlsave2').addEventListener('click', saveAsZip.bind(null,alignedblocks));
            }

            document.getElementById('xmlopen').addEventListener('click',openInEditor.bind(null,alignedblocks));
            document.getElementById('xmlsave').addEventListener('click', saveAs.bind(null,alignedblocks));
        }
    };
};

const openInEditor = alignedblocks => {
	const blocks = [...alignedblocks];
    window.open('matrix-editor/index.html');
    const bc = new BroadcastChannel('matrix-editor');
    bc.onmessage = e => {
        if(e.data === 'ready') {
			const first = blocks.shift();
			const ret = {
				f: {name: first[0] + '.xml'}, 
				e: {target: {result: first[1]}}
			};
			if(blocks.length > 0)
				ret.fs = blocks.map(b => b[1]);
			else 
				ret.fs = [];
            bc.postMessage(ret);
            bc.close();
        }
    };
};

const saveAs = async blocks => {
    document.getElementById('blackout').style.display = 'none';

    const outtexts = [...blocks];

	for(const outtext of outtexts) {
		const fname = outtext[0] + '.xml';
		const fileHandle = await showSaveFilePicker({
			_preferPolyfill: false,
			suggestedName: fname,
			types: [ {description: 'TEI XML alignment', accept: {'application/xml': ['.xml']} } ],
		});
		const writer = await fileHandle.createWritable();
		writer.write(outtext[1]);
		writer.close();
	}

};

const saveAsZip = async blocks => {

    document.getElementById('blackout').style.display = 'none';

    const outtexts = [...blocks];
    const zip = new JSZip();
    for(const outtext of outtexts) zip.file(`${outtext[0]}.xml`, outtext[1]);
    zip.generateAsync({type: "blob"})
       .then(async (blob) => {
            const fileHandle = await showSaveFilePicker({
                _preferPolyfill: false,
                suggestedName: 'alignments.zip',
                types: [ {description: 'Zip archive', accept: {'application/zip': ['.zip']} } ],
            });
            const writer = await fileHandle.createWritable();
            writer.write(blob);
            writer.close();
       });
};

const updateCheckboxes = (e) => {
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

const checkAll = (e) => {
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

const updateBoxes = (e) => {
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
    /*
    const date = new Date();
    if(date.getHours() > 17 || date.getHours() < 5 || date.getDay() > 5) {
        const dialog = document.createElement('dialog');
        dialog.setAttribute('open',true);
        if(date.getDay() > 5) 
            dialog.innerHTML = "<p>Leo, it's the weekend, are you sure?</p><button>I guessssss</button>";
        else
            dialog.innerHTML = "<p>Leo, it's past 5 PM, are you sure?</p><button>Yessssssss</button>";
        document.getElementById('popup').style.display = 'none';
        dialog.querySelector('button').addEventListener('click',() => {
            dialog.remove();
            document.getElementById('blackout').style.display = 'none';
            document.getElementById('popup').style.display = 'flex';
        });
        const blackout = document.getElementById('blackout');
        document.getElementById('popup').style.display = 'none';
        blackout.appendChild(dialog);
        blackout.style.display = 'flex';
    }
    */
    document.getElementById('teifiles').addEventListener('change',updatePreview);
    for(const box of document.querySelectorAll('.checklist'))
        box.addEventListener('click',updateCheckboxes);

    document.getElementById('alignsubmit').addEventListener('click', align);
	
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

