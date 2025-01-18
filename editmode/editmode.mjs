import popupHTML from './editmode.html.mjs';
import { makeApp, addWitnesses, addApparatus, getWits } from '../lib/apparatus.mjs';
import { showSaveFilePicker } from './native-file-system-adapter/es6.js';

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
#topbar button {
    margin: 0.3em 0 0.3em 0.5em;
    background-color: rgb(240,202,121);
    border-color: rgb(240,202,121);
    border-radius: 0.3rem;
    color: black;
    height: fit-content;
    font-size: 1.1rem;
    padding: 0.2rem 0.4rem 0.2rem 0.4rem;
}
#topbar #button_savebutton {
    background-color: rgb(255, 73, 73);
    color: white;
    font-weight: bold;
}
#topbar button:hover, #topbar #button_savebutton:hover {
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
    z-index: 2;
    backdrop-filter: blur(1px);
}
#buttoncontainer {
    top: auto;
}
.editbutton {
    position: relative;
    left: -1rem;
    top: 0;
    height: 0;
}
.editbutton:hover svg {
    fill:  rgb(168,81,16);
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
    const blocks = _state.curDoc.querySelectorAll('lg[*|id],p[*|id],div[*|id],div[*|id]');
    fillBlocks(blocks);
    addEditButtons(blocks);

    const topbar = document.getElementById('topbar');
    const editbutton = document.createElement('button');
    editbutton.id = 'button_editbutton';
    editbutton.append('Add/edit apparatus');
    topbar.appendChild(editbutton);
    editbutton.addEventListener('click',editApp);
    const savebutton = document.createElement('button');
    savebutton.id = 'button_savebutton';
    savebutton.append('Save as...');
    topbar.appendChild(savebutton);
    savebutton.addEventListener('click',saveAs);
};

const loadDoc = async (fn,cache='no-cache') => {
    const res = await fetch(fn, {cache: cache});
    const xmltext = await res.text();
    return (new DOMParser()).parseFromString(xmltext, 'text/xml');
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
    const xmlid = blockel.getAttribute('xml:id');
    const block = document.getElementById(xmlid);
    const editbutton = document.createElement('div');
    editbutton.className = 'editbutton';
    editbutton.innerHTML = '<svg version="1.1" width="11" height="11" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"> <path d="M77.926,94.924H8.217C6.441,94.924,5,93.484,5,91.706V21.997c0-1.777,1.441-3.217,3.217-3.217h34.854 c1.777,0,3.217,1.441,3.217,3.217s-1.441,3.217-3.217,3.217H11.435v63.275h63.274V56.851c0-1.777,1.441-3.217,3.217-3.217 c1.777,0,3.217,1.441,3.217,3.217v34.855C81.144,93.484,79.703,94.924,77.926,94.924z"/> <path d="M94.059,16.034L84.032,6.017c-1.255-1.255-3.292-1.255-4.547,0l-9.062,9.073L35.396,50.116 c-0.29,0.29-0.525,0.633-0.686,1.008l-7.496,17.513c-0.526,1.212-0.247,2.617,0.676,3.539c0.622,0.622,1.437,0.944,2.274,0.944 c0.429,0,0.858-0.086,1.276-0.257l17.513-7.496c0.375-0.161,0.719-0.397,1.008-0.686l35.026-35.026l9.073-9.062 C95.314,19.326,95.314,17.289,94.059,16.034z M36.286,63.79l2.928-6.821l3.893,3.893L36.286,63.79z M46.925,58.621l-5.469-5.469 L73.007,21.6l5.47,5.469L46.925,58.621z M81.511,24.034l-5.469-5.469l5.716-5.716l5.469,5.459L81.511,24.034z"/> </svg>';
    editbutton.dataset.anno = `Edit apparatus for ${xmlid}`;
    editbutton.addEventListener('click',editApp.bind(null,{block: xmlid}));
    block.prepend(editbutton);
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
    const siglum = _state.curDoc.querySelector('idno[type="siglum"]')?.textContent;
    for(const block of _state.shadowRoot.querySelectorAll('#blocklist input[value]')) {
        if(!block.checked) continue;
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
    const sheet = await getXSLTSheet(_state.curDoc);
    const newDoc = await XSLTransform(sheet, _state.curDoc);
    const curarticle = document.querySelector('article');
    curarticle.parentNode.replaceChild(newDoc.querySelector('article'), curarticle);
    document.getElementById('editblackout').style.display = 'none';
    
    const blocks = _state.curDoc.querySelectorAll('lg[*|id],p[*|id],div[*|id],div[*|id]');
    addEditButtons(blocks);

    // keep clicking until the apparatus appears... pretty hacky solution
    const appbutton = document.getElementById('apparatusbutton');
    appbutton.click();
    if(document.querySelector('.apparatus-block.hidden'))  {
        appbutton.click();
    }
};

const getXSLTSheet = async doc => {
    for(const n of doc.childNodes) {
        if(n.nodeName === 'xml-stylesheet') {
            const temp = doc.createElement('outer');
            temp.innerHTML = `<inner ${n.data}/>`;
            const href = temp.firstChild.getAttribute('href');
            return loadDoc(href,'default');
        }
    }
};

const compileImports = async (xsltsheet,prefix='') => {
    const imports = xsltsheet.querySelectorAll('import');
    if(!imports) return xsltsheet;
    for(const x of imports) {
        const href = prefix + x.getAttribute('href');
        const split = href.split('/');
        split.pop();
        const newprefix = split.join('/') + '/';
        const i = await loadDoc(href,'default');
        while(i.documentElement.firstChild) {

            if(i.documentElement.firstChild.nodeName === 'xsl:param') {
                if(xsltsheet.querySelector(`variable[name="${i.documentElement.firstChild.getAttribute('name')}"]`)) { 
                    i.documentElement.firstChild.remove();
                    continue;
                }
            }
            if(i.documentElement.firstChild.nodeName === 'xsl:import') {
                const ii = await loadDoc(newprefix + i.documentElement.firstChild.getAttribute('href'),'default');
                const embed = await compileImports(ii,newprefix);
                while(embed.documentElement.firstChild)
                        x.before(embed.documentElement.firstChild);
                i.documentElement.firstChild.remove();
                continue;
            }

            x.before(i.documentElement.firstChild);
        }
        x.remove();
    }
    return xsltsheet;
};

const XSLTransform = async (xsltsheet, doc) => {
    const xproc = new XSLTProcessor();
    const compiled = await compileImports(xsltsheet);
    xproc.importStylesheet(compiled);
    return xproc.transformToDocument(doc);
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
