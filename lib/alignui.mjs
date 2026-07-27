import { processFile, preProcess, postProcess, groupBySpace, findSplitfunc } from './collate.mjs';

const getScores = par => {
    const nums = [...par.querySelectorAll('#scoring input.score')].map(i => parseFloat(i.value));
    const recursive = par.querySelector('#check_recursive').checked;
    const scalegap = par.querySelector('#input_scalegap').checked;
    const distancefunc = par.querySelector('#treetype_ncd').checked ? 'ncd' : 'ngrams';
    const ngramsize = par.querySelector('#tree_ngramsize').value;
    return {scores: nums, recursive: recursive, distancefunc: distancefunc, ngramsize: ngramsize, scalegap: scalegap};
};

const getFilterIndices = norm => {
    const ret = [];
    const par = norm.querySelector('#normalization');
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

const getTagFilters = topel => {
    const ret = [];
    const par = topel.querySelector('#xmltags');
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

const alignPreflight = (par,alltexts, testonly=false) => {
    const tok = par.querySelector('input[name="tokenization"]:checked').value;

    const splitfunc = findSplitfunc(tok);

    const scores = getScores(par);
    const scoring = {
        match: scores.scores[0],
        mismatch: scores.scores[1],
        gap_open: scores.scores[2],
        gap_extend: scores.scores[3],
        gap_skip_initial: true,
        scalegap: scores.scalegap,
        recursive: scores.recursive,
        realigndepth: scores.scores[4],
        distancefunc: scores.distancefunc,
        ngramsize: scores.ngramsize
    };
    const configfunc = tok === 'character' ? 'character' : 
        scores.recursive ? 'arr' : 'arr_simple';

    const selectedsigla = getSelected(par.querySelector('#file-input-box'));
    const selectedblocks = getSelected(par.querySelector('#xml-ids-box'));
    if(selectedblocks.length === 0 || selectedsigla.length === 0) {
        alert('Nothing selected to be aligned.');
        return;
    }

    const [filtersindices, filtersnames] = getFilterIndices(par);
    const tagfilters = getTagFilters(par);
    const targetedition = par.querySelector('#targetedition').value;

    const todo = [];
    const selectedtexts = selectedsigla.map(s => {return {siglum: s, text: alltexts.get(s)};});
    const notdone = [];
    for(const block of selectedblocks) {
        const texts = preProcess(block, selectedtexts, {splitfunc: splitfunc, selectedfilters: filtersindices, ignoretags: tagfilters, testonly: testonly}); 
        if(texts.length === 1) {
            notdone.push(block);
            alert(`Nothing to align in ${block}.`);
            continue;
        }

        todo.push({workerdata: [texts,configfunc,scoring], block: block});
    }

    if(todo.length === 0) return;

    const meta = {
        alltexts: alltexts,
        filtersnames: filtersnames,
        filtersindices: filtersindices,
        tagfilters: tagfilters,
        lang: todo[0].workerdata[0][0].lang,
        tokenization: tok,
        scoring: scoring,
        notdone: notdone,
        targetedition: targetedition
    };
    
    return {todo: todo, meta: meta};
};
/*
const alignFlight = obj => {
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
            if(notdone.length > 0) {
              const warnings = document.createElement('div');
              warnings.textContent = `Not aligned: ${notdone.join(', ')}.`;
              popupmessage.firstElementChild.appendChild(warnings);
            }
            document.getElementById('xmlopen').addEventListener('click',openInEditor.bind(null,alignedblocks));
            document.getElementById('xmlsave').addEventListener('click', saveAs.bind(null,alignedblocks));
        }
    };
};
*/

export { alignPreflight };
