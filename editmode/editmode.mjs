import popupHTML from './editmode.html.mjs';
import { makeApp, addWitnesses, addApparatus, getWits } from '../lib/apparatus.mjs';

const _state = {
    curDoc: null,
    shadowRoot: null,
    alignments: new Map(),
    doneFindAlignments: false
};
const alignmentDir = 'alignments';

const init = async () => {
    const searchparams = new URLSearchParams(window.location.saerch);
    const islocal = ['localhost','127.0.0.1'].includes(window.location.hostname);
    if(!searchparams.get('edit') && !islocal) return;

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
    fillBlocks();

    const topbar = document.getElementById('topbar');
    const editbutton = document.createElement('button');
    editbutton.id = 'button_editbutton';
    editbutton.append('Add/edit apparatus');
    topbar.appendChild(editbutton);
    editbutton.addEventListener('click',editApp);
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

const fillBlocks = () => {
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
    for(const block of _state.curDoc.querySelectorAll('lg[*|id],p[*|id],div[*|id],div[*|id]')) {
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

const editApp = (e,opts) => {
    const blackout = document.getElementById('editblackout');
    blackout.style.display = 'flex';
    if(!_state.doneFindAlignments) findAlignments(opts);
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
    if(document.querySelector('.apparatus-block.hidden'))
        document.getElementById('apparatusbutton').click();
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
    xproc.importStylesheet(xsltsheet);
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

window.addEventListener('load',init);
