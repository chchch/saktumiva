import { affineAlign, charConfig, arrConfig, simpleArrConfig } from './lib/affine-align.mjs';
import { filters, filterAll, unfilterAll } from './lib/normalize.mjs';
import { detectScript } from './lib/collate.mjs';
import { aksaraSplit, charSplit, graphemeSplit, iast, wylie } from './lib/split.mjs';
import Sanscript from './lib/sanscript.mjs';
import JSONCrush from './lib/JSONCrush.min.js';

const align = () => {

    const fis = getFilterIndices();
    const strs = [...document.querySelectorAll('.input-box input')].map(b => b.value);
    
    const iasted = strs.map(s => {
        const script = detectScript(s);
        return script !== 'iast' ? Sanscript.t(s,script,'iast') : s;
    });

    const mainscript = detectScript(strs[0]);

    const filtered = iasted.map(s => filterAll(s,fis));

    const tok = document.querySelector('input[name="tokenization"]:checked').value;

    const splitfunc = ((tok) => {
        switch(tok) {
            case 'whitespace': return (str) => str.split(/\s+/g).map((s,i,arr) => i > 0 ? ' ' + s : s);
            case 'aksara': return aksaraSplit;
            case 'grapheme': return graphemeSplit;
            default: return charSplit;
        }
    })(tok);
    
    const charset = mainscript === 'tibetan' ? wylie : iast;

    const split = filtered.map(f => splitfunc(f[0],charset));

    const scores = getScores();
    const configfunc = tok === 'char' ? charConfig : 
        scores.recursive ? arrConfig : simpleArrConfig;
    const res = affineAlign(...split,new configfunc(...scores.scores,false), {alignment: true, matrix: true});

    const path = res.pop();
    const matrix = res.pop();
    const score = res.pop();

    const unfiltered = res.map((r,i) => {
        const u = unfilterAll(
            r.map(b => Array.isArray(b) ? b.join('') : b),
            filtered[i][1]
        );
        return mainscript !== 'iast' ? u.map(uu => Sanscript.t(uu,'iast',mainscript)) : u;
    });

    const filteredseqs = res.map(f => f.map(b => {
        const ret = Array.isArray(b) ? b.join('') : b;
        return mainscript !== 'iast' ? Sanscript.t(ret,'iast',mainscript) : ret;
    }));

    const longest = Math.max(split[0].length,split[1].length);
    showResults(unfiltered,filteredseqs,score,score/longest);
    showMatrix(split.map(f => f.map(b => Array.isArray(b) ? b.join('') : b)),matrix,path);
    addQueryString(strs);
};

const getFilterIndices = () => {
    const ret = [];
    const par = document.getElementById('normalization');
    for(const box of par.querySelectorAll('input:checked')) {
        const i = parseInt(box.value);
        if(isNaN(i)) continue;
        ret.push(i);
    }
    ret.sort((a,b) => a - b);
    return ret;
};

const getScores = () => {
    const par = document.getElementById('scoring');
    const nums = [...document.querySelectorAll('#scoring input[type="number"]')].map(i => parseFloat(i.value));
    const recursive = par.querySelector('input[type="checkbox"]').checked;
    return {scores: nums, recursive: recursive};
};

const makeRuby = (base, anno) => {
    const ruby = document.createElement('ruby');
    const rt = document.createElement('rt');
    rt.append(anno);
    ruby.append(base);
    ruby.append(rt);
    return ruby;
};

const showResults = (arr,arr2,score,scaled) => {
    const scorebox = document.getElementById('score');
    scorebox.textContent = '';
    scorebox.append(`Score: ${score} (scaled: ${scaled})`);

    const body = document.getElementById('results').firstElementChild;
    body.innerHTML = '';
    const trs = [];
    for(const [n,seq] of arr.entries()) {
        const tr = document.createElement('tr');
        const seq2 = arr2[n];
        for(const [m,cell] of seq.entries()) {
            const td = document.createElement('td');

            const filtered = seq2[m];
            if(filtered.trim() !== cell.trim())
                td.append(makeRuby(cell,filtered));
            else
                td.append(cell);
            tr.appendChild(td);
        }
        trs.push(tr);
    }
    for(const [i,td0] of [...trs[0].childNodes].entries()) {
        const val0 = td0.querySelector('rt')?.textContent || td0.textContent; 
        const td1 = trs[1].children[i];
        const val1 = td1.querySelector('rt')?.textContent || td1.textContent;
        if(val0 !== '' && val1 !== '' && val0 !== val1) {
            td0.style.background = 'lightgray';
            td1.style.background = 'lightgray';
        }
    }
    for(const tr of trs)
        body.appendChild(tr);
};

const showMatrix = (seqs,matrix,path) => {
    const table = document.getElementById('matrix');
    table.closest('details').style.display = 'unset';
    const body = table.firstElementChild;

    body.innerHTML = '';
    const firsttr = document.createElement('tr');
    firsttr.appendChild(document.createElement('td'));
    firsttr.appendChild(document.createElement('td'));
    for(const cell of seqs[1]) {
        const td = document.createElement('td');
        td.append(cell);
        firsttr.appendChild(td);
    }
    body.appendChild(firsttr);
    for(const [x,row] of matrix.entries()) {
        const tr = document.createElement('tr');
        const firsttd = document.createElement('td');
        if(x > 0)
            firsttd.append(seqs[0][x-1]);
        tr.append(firsttd);
        for(const [y,cell] of row.entries()) {
            if(y > seqs[1].length) break; // GridMixin pads rows with 0's
            const td = document.createElement('td');
            td.append(parseFloat(cell.toFixed(2)));
            if(path.has(`${x},${y}`))
                td.className = 'highlit';
            tr.append(td);
        }
        body.append(tr);
    }
};

const makeOption = (index,obj) => {
    const div = document.createElement('div');
    const box = document.createElement('input');
    box.setAttribute('type','checkbox');
    box.value = index;
    const label = document.createElement('label');
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

const addQueryString = strs => {
    const options = [...document.querySelectorAll('fieldset.options input')];
    const os = options.map(o => o.type === 'number' ? o.value : o.checked);
    const qs = encodeURIComponent(
        JSONCrush.crush(
            JSON.stringify({str_a: strs[0], str_b: strs[1],options: os})
            )
        );
    window.history.replaceState(null,null,window.location.pathname+`?q=${qs}`);
};

const fillFromQueryString = () => {
    const searchParams = new URLSearchParams(window.location.search);
    if(!searchParams.has('q')) return;

    const boxes = document.querySelectorAll('.input-box input');
    const data = JSON.parse(
        JSONCrush.uncrush(
            decodeURIComponent(searchParams.get('q'))
        )
    );
    if(data.hasOwnProperty('str_a'))
        boxes[0].value = data.str_a;
    if(data.hasOwnProperty('str_b'))
        boxes[1].value = data.str_b;
    if(data.hasOwnProperty('options')) {
        const options = document.querySelectorAll('fieldset.options input');
        for(let n=0;n < options.length;n++) {
            if(options[n].type === 'number')
                options[n].value = data.options[n];    
            else
                options[n].checked = data.options[n];
        }
    }
};

window.addEventListener('load',() => {

    const normies = document.getElementById('normalization');
    
    for(const checkbox of normies.querySelectorAll('input'))
        checkbox.addEventListener('click',checkAll);

    const tamil = normies.querySelector('details.tamil');
    tamil.addEventListener('click',updateBoxes);

    const sanskrit = normies.querySelector('details.sanskrit');
    sanskrit.addEventListener('click',updateBoxes);
    for(const [i, filter] of filters.entries()) {
        if(filter.group === 'other')
            normies.insertBefore(makeOption(i,filter),tamil.parentNode);
        else if(filter.group === 'tamil')
            tamil.appendChild(makeOption(i,filter));
        else
            sanskrit.appendChild(makeOption(i,filter));
    }

    fillFromQueryString();

    document.getElementById('alignsubmit').addEventListener('click', align);
});
