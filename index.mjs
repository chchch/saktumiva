import { showSaveFilePicker } from './lib/native-file-system-adapter/es6.js';
import tagsToIgnore from './lib/tagfilters.mjs';
import JSZip from './lib/jszip.mjs';
import { processFile, preProcess, postProcess, groupBySpace, findSplitfunc } from './lib/collate.mjs';
import { parseString, readOne } from './lib/browserutils.mjs';
import { appendList, acPcButtons, updateCheckboxes, populateFilters, languageSpecificOptions } from './lib/uiutils.mjs';
import { alignPreflight } from './lib/alignui.mjs';

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
    acPcButtons(preview.querySelector('.checklist'), _state.alltexts);
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

const align = () => {
    const ret = alignPreflight(document, _state.alltexts);
    if(!ret) return;
    const {todo: todo, meta: meta} = ret;

    const alignedblocks = new Map();

    document.getElementById('blackout').style.display = 'flex';
    const popupmessage = document.getElementById('popupmessage');
    popupmessage.innerHTML = '';
    document.getElementById('spinner').style.display = 'flex';

    const alignWorker = new Worker('./lib/multialignworker.mjs',{type: 'module'});
    let n = 0;
    popupmessage.textContent = `Aligning ${todo[n].block}...`;
    alignWorker.postMessage(todo[n].workerdata);
    alignWorker.onmessage = e => {
        if(e.data.hasOwnProperty('progress')) {
            const p = e.data.progress * 100;
            document.getElementById('spinner').style.background = 
                `linear-gradient(0deg, rgb(240,202,121) ${p-5}%, rgb(50,50,50,0.3) ${p}%`;
            if(e.data.hasOwnProperty('message'))
                popupmessage.textContent = e.data.message;
            return;
        }
        const filtersmap = new Map(todo[n].workerdata[0].map(t => [t.siglum,t.filters]));
        const newmeta = {block: todo[n].block};
        Object.assign(newmeta, meta);
        const finished = postProcess(e.data,filtersmap,newmeta);

        // TODO: add option here
        // const grouped = groupBySpace(parseString(finished,todo[n].block),targetedition);
        //const serialized = serializeXML(grouped);
        //alignedblocks.set(todo[n].block,serialized);
        alignedblocks.set(todo[n].block,finished);

        n = n + 1;

        if(n < todo.length) {
            popupmessage.textContent = `Aligning ${todo[n].block}...`;
            alignWorker.postMessage(todo[n].workerdata);
        }
        else {
            document.getElementById('spinner').style.display = 'none';
            if(alignedblocks.size === 1)
                popupmessage.innerHTML = `<div class="vertcentre"><button id="xmlopen">Open file</button><button id="xmlsave">Save file</button></div>`;
            else {
                popupmessage.innerHTML = '<div class="vertcentre"><button id="xmlopen">Open files</button><button id="xmlsave">Save each file</button><button id="xmlsave2">Save ZIP</button>';
                document.getElementById('xmlsave2').addEventListener('click', saveAsZip.bind(null,alignedblocks));
            }
            if(meta.notdone.length > 0) {
              const warnings = document.createElement('div');
              warnings.textContent = `Not aligned: ${meta.notdone.join(', ')}.`;
              popupmessage.firstElementChild.appendChild(warnings);
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
  
    populateFilters(document);
});

