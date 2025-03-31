import popupHTML from './editmode.html.mjs';
import { makeApp, addWitnesses, addApparatus, getWits } from '../lib/apparatus.mjs';
import { showSaveFilePicker } from './native-file-system-adapter/es6.js';
import { loadDoc } from './utils.mjs';
import previewDoc from './preview.mjs';

const _state = {
    curDoc: null,
    shadowRoot: null,
    alignments: new Map(),
    doneFindAlignments: false
};
const alignmentDir = 'alignments';

const init = async () => {
    const searchparams = new URLSearchParams(window.location.search);
    const islocal = ['localhost','127.0.0.1'].includes(window.location.hostname);
    if(searchparams.get('noedit') !== null) return;
    if(searchparams.get('edit') !== null && !islocal) return;

    _state.curDoc = await loadDoc(window.location.pathname);

    injectCSS();
    injectHTML();

};

const injectCSS = () => {
    const style = document.createElement('style');
    style.append(
`
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
    margin: 0.3em 0 0.3em 0.5em;
    background-color: rgb(240,202,121);
    border-color: rgb(240,202,121);
    border-radius: 0.3rem;
    color: black;
    height: fit-content;
    font-size: 1.1rem;
    padding: 0.2rem 0.4rem 0.2rem 0.4rem;
}
button.important {
    background-color: rgb(255, 73, 73);
    color: white;
    font-weight: bold;
}
button:hover {
    background-color: #eeee99;
    border-color: #eeee00;
    color: black;
}
#topbar {
    background: linear-gradient(rgb(255,255,248) 60%, rgba(255,255,255,0));
    height: auto;
    top: 0;
    padding-top: 1em;
    padding-bottom: 2em;
    z-index: 3;
    backdrop-filter: blur(1px);
}
#buttoncontainer {
    top: auto;
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
}
.editbutton svg {
    height: 0.7rem;
    width: 0.7rem;
    position: relative;
    top: -0.1rem;
    left: -0.05rem;
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
`
    );
    document.head.appendChild(style);
};

const injectHTML = async () => {
    const blackout = document.createElement('div');
    blackout.id = 'editblackout';
    const shadow = blackout.attachShadow({mode: 'open'});
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.id = 'variants-popup';
    shadow.appendChild(popup);
    popup.innerHTML = popupHTML;

    document.body.appendChild(blackout);
    shadow.querySelector('.closeicon').addEventListener('click', _ => blackout.style.display = 'none');
    shadow.getElementById('collatebutton').addEventListener('click',collate);
    _state.shadowRoot = shadow;
    const blocks = _state.curDoc.querySelectorAll('text lg[*|id],text p[*|id],text div[*|id]');
    fillBlocks(blocks);
    addEditButtons(blocks);

    const topbar = document.getElementById('topbar');
    const editbutton = document.createElement('button');
    editbutton.id = 'button_editbutton';
    editbutton.append('Add/edit apparatus');
    topbar.appendChild(editbutton);
    editbutton.addEventListener('click',editApp);
    const savebutton = document.createElement('button');
    savebutton.className = 'important';
    savebutton.id = 'button_savebutton';
    savebutton.append('Save as...');
    topbar.appendChild(savebutton);
    savebutton.addEventListener('click',saveAs);
};

const updateChecklist = e => {
    if(e.target.tagName !== 'INPUT') return;

    const par = e.target.closest('.checklist');
    const parbox = par.querySelector('input[name="selectall"]');
    if(e.target === parbox) {
        for(const box of par.querySelectorAll('input:not([disabled])'))
            box.checked = e.target.checked;
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

const addEditButtons = blocks => {for(const block of blocks) addEditButton(block);};

const addEditButton = blockel => {
    const xmlid = typeof blockel === 'string' ? blockel : blockel.getAttribute('xml:id');
    const block = document.getElementById(xmlid);
    const minieditbutton = document.createElement('button');
    minieditbutton.className = 'editbutton';
    const appsvg = document.getElementById('apparatussvg').cloneNode(true);
    delete appsvg.dataset.anno;
    minieditbutton.appendChild(appsvg);
    minieditbutton.dataset.anno = `Edit apparatus for ${xmlid}`;
    minieditbutton.addEventListener('click',editApp.bind(null,{block: xmlid}));
    block.prepend(minieditbutton);
};

const fillBlocks = (blocks) => {
    const blocklist = _state.shadowRoot.getElementById('blocklist');
    blocklist.classList.add('checklist');
    blocklist.addEventListener('click',updateChecklist);
    const div1 = document.createElement('div');
    const input1 = document.createElement('input');
    input1.setAttribute('type','checkbox');
    input1.setAttribute('name','selectall');
    input1.id = `checkbox_${Date.now() + Math.random()}`;
    const label1 = document.createElement('label');
    label1.setAttribute('for',input1.id);
    label1.append('Select all');
    div1.appendChild(input1);
    div1.appendChild(label1);
    blocklist.appendChild(div1);
    for(const block of blocks) {
        const xmlid = block.getAttribute('xml:id');
        const div = document.createElement('div');
        const input = document.createElement('input');
        input.setAttribute('type','checkbox');
        input.id = `checkbox_${Date.now() + Math.random()}`;
        input.value = xmlid;
        input.disabled = true;
        const label = document.createElement('label');
        label.setAttribute('for',input.id);
        label.append(xmlid);
        const fileinput = document.createElement('input');
        fileinput.type = 'file';
        fileinput.autocomplete = 'off';
        fileinput.accept = '.xml';
        fileinput.addEventListener('change',getAlignmentFile);
        div.appendChild(input);
        div.appendChild(label);
        div.appendChild(fileinput);
        blocklist.appendChild(div);
    }
};

const readOne = async file => {
    const reader = new FileReader();
    return new Promise(res => {
        reader.onload = () => res(reader.result);
        reader.readAsText(file,'utf-8');
    });
};

const getAlignmentFile = async e => {
    const checkbox = e.target.parentNode.querySelector('input[type="checkbox"]');
    const fname = e.target.files[0].name;
    const text = await readOne(e.target.files[0]);
    const parser = new DOMParser();
    const newd = parser.parseFromString(text,'text/xml');
    if(newd.documentElement.nodeName === 'parsererror') {
        alert(`${fname} could not be parsed as valid XML.`);
        e.target.value = null;
        return;
    }
    const blockid = checkbox.value;
    _state.alignments.set(blockid, {filename: fname, doc: newd});
    checkbox.disabled = false;
    checkbox.parentNode.querySelector('.foundlabel')?.remove();
};

const editApp = (opts,e) => {
    const blackout = document.getElementById('editblackout');
    blackout.style.display = 'flex';
    if(!_state.doneFindAlignments) {
        findAlignments(opts);
        return;
    }
    if(!opts.block)
        return;
    // else clear other checkboxes 
    for(const input of _state.shadowRoot.querySelectorAll('#blocklist input[type="checkbox"][value]')) {
        if(opts.block === input.value && !input.disabled)
           input.checked = true;
        else 
            input.checked = false;
    }
};

const findAlignments = async opts => {
    for(const input of _state.shadowRoot.querySelectorAll('#blocklist input[type="checkbox"][value]')) {
        const blockid = input.value;
        const srcname = `${alignmentDir}/${blockid}.xml`;
        const res = await fetch(srcname,{method: 'HEAD'});
        if(!res.ok)  {
            continue;
        }
        else {
            _state.alignments.set(blockid,{filename: srcname});
            const span = document.createElement('span');
            span.className = 'foundlabel';
            span.innerHTML = `Found <strong>${srcname}.</strong>`;
            input.parentNode.appendChild(span);
            input.disabled = false;
            if(opts?.block === blockid)
               input.checked = true;
        }
    }
    _state.doneFindAlignments = true;
};

const collate = async () => {
    const cachedwitnesses = new Map();
    const cachedfiles = new Map();
    await cacheWitnesses(_state.curDoc,cachedwitnesses,cachedfiles);
    const siglum = _state.curDoc.querySelector('idno[type="siglum"]')?.textContent || _state.curDoc.documentElement.getAttribute('n');
    const blocklist = [];
    for(const block of _state.shadowRoot.querySelectorAll('#blocklist input[value]')) {
        if(!block.checked) continue;
        blocklist.push(block.value);

        const base = _state.curDoc.querySelector(`[*|id='${block.value}']`).closest('text').getAttribute('corresp')?.replace(/^#/,'') || siglum;
        const alignobj = _state.alignments.get(block.value);
        if(!alignobj.doc)
            alignobj.doc = await loadDoc(alignobj.filename);
        await cacheWitnesses(alignobj.doc,cachedwitnesses,cachedfiles);
        const app = makeApp(alignobj.doc, _state.curDoc, {
            base: base,
            normlem: _state.shadowRoot.getElementById('normlem').checked,
            mergerdgs: _state.shadowRoot.getElementById('mergerdgs').checked,
            blockid: block.value,
            witnesses: cachedwitnesses
        });
        addWitnesses(_state.curDoc,app.listwit);
        addApparatus(_state.curDoc,app.listapp,alignobj.doc,block.value,alignobj.filename);
        
    }

    const newDoc = await previewDoc(_state.curDoc);
    for(const id of blocklist) {
        const newblock = newDoc.getElementById(id);
        const newpar = newblock.closest('.wide');
        const newwide = newpar || newblock; // TODO: this is ugly

        const oldblock = document.getElementById(id);
        const oldpar = oldblock.closest('.wide');
        const oldwide = oldpar || oldblock;

        oldwide.parentNode.replaceChild(newwide,oldwide);
        //newblock.style.border = '1px dashed red';
        newwide.classList.add('edited');
    }
    document.getElementById('editblackout').style.display = 'none';
    document.getElementById(blocklist[0]).scrollIntoView({behavior: 'smooth',block: 'center'}); 
    addEditButtons(blocklist);

    // keep clicking until the apparatus appears... pretty hacky solution
    const appbutton = document.getElementById('apparatusbutton');
    appbutton.click();
    if(document.querySelector('.apparatus-block.hidden'))  {
        appbutton.click();
    }
};

const cacheWitnesses = async (doc, witmap, filemap) => {
    for(const wit of getWits(doc)) {
        if(!witmap.get(wit.name)) {
            let file = filemap.get(wit.filename);
            if(!file) {
                file = await loadDoc(wit.filename);
                filemap.set(wit.filename,file);
            }
            if(file) {
                witmap.set(wit.name, {
                    name: wit.name,
                    type: wit.type,
                    select: wit.select,
                    xml: file
                });
            }
        }
    }
};

const saveAs = async () => {
    const thisFilename = window.location.pathname.split('/').pop();
    const fileHandle = await showSaveFilePicker({
        suggestedName: thisFilename,
        types: [
            { description: 'TEI XML', accept: { 'text/xml': [ '.xml'] } }
        ],
    });
    const serialized = (new XMLSerializer()).serializeToString(_state.curDoc);
    const file = new Blob([serialized], {type: 'text/xml;charset=utf-8'});
    const writer = await fileHandle.createWritable();
    writer.write(file);
    writer.close();
    
};

window.addEventListener('load',init);
