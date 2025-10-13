import { filterAll, unfilterAll } from './normalize.mjs';
import { iast, wylie } from './split.mjs';
import Sanscript from './sanscript.mjs';
import EwtsConverter from './EwtsConverter.mjs';

const processTags = (text,tagstodelete,missingchar) => {
    for(const todel of text.querySelectorAll(tagstodelete.join(',')))
        todel.remove();
    
    for(const gap of [...text.querySelectorAll('gap')]) {
        const reason = gap.getAttribute('reason');
        if(reason && reason === 'ellipsis') continue;
        gap.replaceWith(missingchar.repeat(gap.getAttribute('quantity') || 1));
    }

	for(const nobreak of text.querySelectorAll('lb[break="no"]')) {
		const prev = nobreak.previousSibling;
		if(!prev || prev.nodeType !== 3) continue;
		prev.data = prev.data.trimRight();
	}

};
const detectScript = str => {
    const ranges = new Map([
        ['tamil', /[\u0b80-\u0bff]/u],
        ['devanagari', /[\u0900-\u097f]/u],
        ['bengali', /[\u0980-\u09ff]/u],
        ['telugu', /[\u0c00-\u0c7f]/u],
        ['malayalam',/[\u0d00-\u0d7f]/u],
        ['sarada',/[𑆃-𑆲]/u],
        ['grantha',/[𑌅-𑌹]/u],
        ['newa',/[𑐀-𑐴]/u],
        ['tibetan',/[ༀ-࿚]/u]
    ]);

    for(const [name,range] of ranges)
        if(range.test(str)) return name;

    return 'iast';
};
const scriptandfilter = (el,type,filters,lang) => {
    const clone = el.cloneNode(true);
    const dels = clone.querySelectorAll('del');
    const adds = clone.querySelectorAll('add');
    const rdgs = clone.querySelectorAll('rdg');
    if(type === 'ac') {
        for(const add of adds) add.remove();
        for(const rdg of rdgs) rdg.remove();
    }
    else if(type === 'pc') {
        for(const del of dels) del.remove();
        for(const rdg of rdgs) rdg.remove();
    }
    else if(type === 'lem') { // pc lemma reading
        for(const del of dels) del.remove();
        for(const rdg of rdgs) rdg.remove();
    }
    else if(type !== undefined) {
        for(const del of dels) del.remove(); // pc variant reading
        for(const app of clone.querySelectorAll('app')) {
            const lem = app.querySelector('lem');
            const rdgs = app.querySelectorAll('rdg');
            let foundreading = false;
            for(const rdg of rdgs) {
                if(rdg.getAttribute('wit')?.split(/\s+/).includes(type))
                    foundreading = true;
                else
                    rdg.remove();
            }
            if(foundreading) lem.remove();
        }
    }
    const str = clone.textContent;

    const script = detectScript(str);
    
    const charset = lang === 'bo' || lang === 'bo-Tibt' ? wylie : iast;
    
    let transliterated;
    if(script === 'tibetan') {
        const ewts = new EwtsConverter({fix_spacing: true, pass_through: true,fix_sloppy: false});
        transliterated = ewts.to_ewts(str.toLowerCase()
                   .replaceAll('ༀ','om̐'))
                   .replaceAll(/[rl]-[iI]/g,(m) => {
                        switch (m) {
                            case 'r-i':
                                return 'ṛ';
                            case 'r-I':
                                return 'ṝ';
                            case 'l-i': 
                                return 'l̥';
                            default:
                                return 'l̥̄';
                        }
                   }).replaceAll(/([gṭḍbd])\+h/g,'$1h');
    }
    else
        transliterated = script !== 'iast' ? Sanscript.t(str,script,'iast') : str;
    
    return [...filterAll(transliterated.replaceAll(/\s+/g,' '),filters),charset];
};

const preProcess = (block, texts, opts) => {
    const selectedfilters = opts.selectedfilters;
    const splitfunc = opts.splitfunc;
    const idsel = opts.idsel || '*|id';
    const langsel = opts.langsel || '*|lang';
    const ignoretags = opts.ignoretags || [];
    const missingchar = opts.missingchar || '‡';

    const ret = [];
    for(const text of texts) {
        const {textel, type, par} = text.text;
        const siglum = text.siglum;
        let blockel = textel.querySelector(`*[${idsel}="${block}"], *[corresp="#${block}"]`);
        if(!blockel) continue;

        const lang = blockel.closest(`[${langsel}]`)?.getAttribute('xml:lang');

        // TODO: is there a better way
        blockel = (blockel.querySelector('*[type="edition"]') || blockel).cloneNode(true);

        processTags(blockel,ignoretags,missingchar);
        if(type) {
            if( (type === 'ac' || type == 'pc') ) {
                const acpc = blockel.querySelector('add, del');
                if(!acpc) {
                    if(type === 'ac') {
                        const [clean,filters,charset] = scriptandfilter(blockel,'lem',selectedfilters,lang);
                        ret.push({siglum: par, text: splitfunc(clean,charset), filters: filters, lang: lang});
                    }
                    continue;
                }
            }
            else if(type !== 'lem') {
                let rdg;
                if(text.text.collectives) {
                    for(const t of [type,...text.text.collectives]) {
                        rdg = blockel.querySelector(`rdg[wit~="${t}"]`);
                        if(rdg) break;
                    }
                }
                else
                    rdg = blockel.querySelector(`rdg[wit~="${type}"]`);
                if(!rdg) continue;
            }
        }

        const [clean,filters,charset] = scriptandfilter(blockel,type,selectedfilters,lang);
        ret.push({siglum: siglum, text: splitfunc(clean,charset), filters: filters, lang: lang});
    }
    return ret;
};

const toXML = (objs,tree,meta) => {
    const sanStr = str => {
        return str.replaceAll(/[<>&]/g,m => {
            if(m === '&') return '&amp;';
            else if(m === '<') return '&lt;';
            else if(m === '>') return '&gt;';
        });
    };
    const sanAttr = str => {
        return str.replaceAll(/[<>&"]/g,m => {
            if(m === '"') return '&quot;';
            if(m === '&') return '&amp;';
            else if(m === '<') return '&lt;';
            else if(m === '>') return '&gt;';
        });
    };
    const witList = makeWitList(meta.alltexts/*,objs.map(o => o.siglum)*/);
    let ret = `<?xml version="1.0" encoding="UTF-8"?>
<teiCorpus xmlns="http://www.tei-c.org/ns/1.0" xml:lang="${meta.lang}">
  <teiHeader>
${witList}
    <encodingDesc>
      <editorialDecl>
        <normalization method="markup">
${meta.filtersnames.map(f => `<ab>${sanStr(f)}</ab>`).join('\n')}
        </normalization>
        <ab type="tagfilters">
${meta.tagfilters.map(f => `<tag subtype="ignore">${f}</tag>`).join('\n')}
        </ab>
      </editorialDecl>
    </encodingDesc>
    <xenoData>
      <stemma format="nexml" id="stemma0">${tree}</stemma>
    </xenoData>
  </teiHeader>
`;
    for(const obj of objs) {
        ret = ret + `<TEI n="${sanAttr(obj.siglum)}"><text>`;
        const text = obj.text.map((t,i) => Array.isArray(t) ? `<w n="${i}" lemma="${sanAttr(t[1])}">${sanStr(t[0])}</w>` : `<w n="${i}">${sanStr(t)}</w>`).join('');
        ret = ret + text + '</text></TEI>';
    }
    return ret + '</teiCorpus>';
};

const makeWitList = (alltexts/*,sigla*/) => {
    const newlist = new Map();
    for(const [witid, deets] of alltexts) {
        if(deets.par) {
            const witlist = newlist.get(deets.par) || [];
            witlist.push([witid,deets]);
            newlist.set(deets.par,witlist);
        }
        else {
            const witlist = newlist.get(witid) || [];
            witlist.unshift([witid,deets]);
            newlist.set(witid,witlist);
        }
    }
    let ret = '<listWit>';
    for(const [witid, witlist] of newlist) {
        ret = ret + `\n<witness xml:id="${witid}" source="${witlist[0][1].filename}">\n<abbr>${witid}</abbr>\n<expan>${witlist[0][1].title}</expan>`;

        if(witlist.length > 1)
            ret = ret + '\n<listWit>';

        if(witlist[0][1].type && witlist[0][1].type !== 'lem') 
            // this means there was only ac/pc, no parent
            ret = ret + `\n<witness xml:id="${witlist[0][0]}" n="${witlist[0][1].type}">\n<abbr>${witlist[0][0]}</abbr>\n<expan>${witlist[0][1].title} [${witlist[0][1].type === 'ac' ? 'ante' : 'post'} correctionem]</expan>\n</witness>`;

        for(let n=1;n<witlist.length;n++) {
            const type = witlist[n][1].type !== 'lem' ? witlist[n][1].type : null;
            const typestr = type ?
                ['ac','pc'].includes(type) ?
                    ` n="${type}"` :
                    ` select="${type}"` :
                    '';
            
            const poststr = type ?
                type === 'ac' ? ' [ante correctionem]' :
                type === 'pc' ? ' [post correctionem]' :
                ` [witness ${type.replace(/^#/,'')}]` :
                '';

            ret = ret + `\n<witness xml:id="${witlist[n][0]}"${typestr}>\n<abbr type="siglum">${witlist[n][0]}</abbr>\n<expan>${witlist[n][1].title}${poststr}</expan>\n</witness>`;
        }

        if(witlist.length > 1)
            ret = ret + '\n</listWit>';

        ret = ret + '\n</witness>';
    }
    return ret + '\n</listWit>';
};

const semanticCleanup = arr => {
    // move open brackets and punctuation to the beginning of a cell
    const opening = /[\[(‘“]$/;
    for(let n=0;n<arr.length;n++) {
        const cell = arr[n];
        if(n < arr.length-1) {
            const endpunct = cell.search(opening);
            if(endpunct > -1) {
                arr[n+1] = cell.slice(endpunct) + arr[n+1];
                arr[n] = cell.slice(0,endpunct);
            }
        }
    }
    // TODO: check for doubled consonants separated by space, e.g.
    //       A: maṇakkum malai vs. B: maṇakku m_alai
    //       and shift the consonant in B one cell
    //       use full table for decision or just nearest neighbour(s)?
    // TODO: check for stuff that could be added to the end of a group, e.g.
    //      A: |bhutesu | vs. B: |bhutasm|iṃ |
    //      search a maximum 3? cells right for the next space
    //      then check if column consists of empty or ends with space
    return arr;
};

const postProcess = (alignment,filtersmap,meta) => {
    const clean = alignment.alignment.map(arr => arr.map(a => Array.isArray(a) ? a.join('') : a));
    const newclean = [];
    for(const row of clean) {
        const id = alignment.sigla.shift();
        const f = filtersmap.get(id);
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
    return toXML(newclean,alignment.tree,meta);
};

const setOrAppendText = (textmap, id, obj) => {
    const existing = textmap.get(id);
    if(existing)
        existing.textel = concatEls([existing.textel,obj.textel]);
    else
        textmap.set(id,obj);
};
const concatEls = els => {
    const first = els.shift().cloneNode(true);
    for(const el of els) {
        const clone = el.cloneNode(true);
        while(clone.firstChild)
            first.appendChild(clone.firstChild);
    }
    return first;
};

const getCollectives = wit => {
    const ret = [];
    let par = wit.closest('[n="collective"]');
    while(par) {
        ret.push(`#${par.getAttribute('xml:id')}`);
        par = par.parentNode.closest('[n="collective"]');
    }
    return ret;
};

const processFile = (teixml, filename, state, idsel = '*|id') => {
   
    const warnings = [];
    const texts = [...teixml.querySelectorAll('text')];
    const title = teixml.querySelector('titleStmt > title').innerHTML.trim();
    
    let overallsiglum = teixml.querySelector('idno[type="siglum"]')?.textContent || teixml.documentElement.getAttribute('n');
    const textsigla = texts.map(t => t.getAttribute('corresp')?.replace(/^#/,'')).filter(e => e);
    if(!overallsiglum && textsigla.length === 0) {
        warnings.push(`No siglum for ${filename}. Using filename as siglum.`);
        overallsiglum = filename;
    }

    for(const siglum of new Set([overallsiglum,...textsigla])) {
        if(state.alltexts.has(siglum) || state.alltexts.has(`${siglum}ac`))
            warnings.push(`Warning: ${siglum} used more than once.`);

    }
    const textmap = new Map();
    for(const text of texts) {
        const siglum = text.getAttribute('corresp')?.replace(/^#/,'') || overallsiglum;
        if(!textmap.has(siglum)) textmap.set(siglum,[text]);
        else textmap.set(siglum,[...textmap.get(siglum),text]);
    }
    for(const [id, texts] of textmap) {
        
        const text = texts.length === 1 ? texts[0] : concatEls(texts);

        const acpc = text.querySelector('add, del');

        const rdgs = [...text.querySelectorAll('rdg')];
        if(rdgs.length !== 0) {
            if(acpc) {
                setOrAppendText(
                    state.alltexts,
                    `${id}ac`,
                    {textel: text, filename: filename, title: title, type: 'ac', par: id});
                setOrAppendText(
                    state.alltexts,
                    `${id}ac`,
                    {textel: text, filename: filename, title: title, type: 'pc', par: id});
                //state.alltexts.set(`${id}ac`,{textel: text, filename: filename, title: title, type: 'ac', par: id});
                //state.alltexts.set(`${id}pc`,{textel: text, filename: filename, title: title, type: 'pc', par: id});
            }
            else {
                setOrAppendText(
                    state.alltexts,
                    id,
                    {textel: text, filename: filename, title: title, type: 'lem'});
                //state.alltexts.set(id,{textel: text, filename: filename, title: title, type: 'lem'});
            }

            const wits = rdgs.reduce((acc,cur) => {
                const w = cur.getAttribute('wit');
                if(!w) return acc;
                for(const ww of w.split(/\s+/))
                    acc.add(ww);
                return acc;
            },new Set());
            for(const wit of wits) {
                const witid = wit.replace(/^#/,'');
                const witel = teixml.querySelector(`[${idsel}="${witid}"]`);
                if(witel?.getAttribute('n') === 'collective') {
                    for(const subwit of witel.querySelectorAll('witness')) {
                        if(subwit.getAttribute('n') === 'collective') continue;
                        const subid = subwit.getAttribute('xml:id');
                        setOrAppendText(
                            state.alltexts,
                            `${id}-${subid}`,
                            {textel: text, filename: filename, title: title, type: `#${subid}`, par: id, collectives: getCollectives(subwit)});
                        //state.alltexts.set(`${id}-${subid}`,{textel: text, filename: filename, title: title, type: `#${subid}`, par: id, collectives: getCollectives(subwit)});
                    }
                }
                else
                    setOrAppendText(
                        state.alltexts,
                        `${id}-${witid}`,
                        {textel: text, filename: filename, title: title, type: wit, par: id});
                    //state.alltexts.set(`${id}-${witid}`,{textel: text, filename: filename, title: title, type: wit, par: id});
            }
        }
        else if(acpc) {
            setOrAppendText(
                state.alltexts,
                `${id}ac`,
                {textel: text, filename: filename, title: title, type: 'ac', par: id});
            setOrAppendText(
                state.alltexts,
                `${id}pc`,
                {textel: text, filename: filename, title: title, type: 'pc', par: id});
            //state.alltexts.set(`${id}ac`,{textel: text, filename: filename, title: title, type: 'ac', par: id});
            //state.alltexts.set(`${id}pc`,{textel: text, filename: filename, title: title, type: 'pc', par: id});
        }
        else
            setOrAppendText(
                state.alltexts,
                id,
                {textel: text, filename: filename, title: title});
            //state.alltexts.set(id,{textel: text, filename: filename, title: title});
    }
    const els = [...teixml.querySelectorAll(`p[${idsel}],p[corresp],lg[${idsel}],lg[corresp],l[${idsel}],l[corresp],div[${idsel}]`)];
    for(const el of els) {
        const id = el.getAttribute('xml:id');
        if(id) state.allblocks.add(id);
        const corresp =  el.getAttribute('corresp')?.replace(/^#/,'');
        if(corresp) state.allblocks.add(corresp);
    }

    return warnings;
};

const makeRange = (a,b) =>
    Array.from(Array(parseInt(b) - parseInt(a) + 1).keys(), x => x+a);

const groupBySpace = (doc,edsiglum) => {
    const nURI = doc.documentElement.namespaceURI;
    let groupstart = 0;
    const groups = [];
    const texts = doc.querySelectorAll('text');
    const emptyrows = new Set();
    let editiontext;

    for(const [n,text] of texts.entries()) {
        if(edsiglum && text.parentNode.getAttribute('n') === edsiglum)
            editiontext = text;
        if(text.textContent.trim() === '')
            emptyrows.add(n);
    }

    const maxlemma = [...texts[0].querySelectorAll('w[n]')].slice(-1)[0].getAttribute('n');
    for(let n=0; n< maxlemma; n++) {
        const ws = doc.querySelectorAll(`w[n='${n}']`);
        if(ws[0].parentNode.nodeName === 'cl') {
            groupstart = n+1;
            continue;
        }
        
        let total = ws.length - emptyrows.size;
        let spaced = 0;
        let empty = 0;
        let editionspace = false;

        for(let m=0;m<ws.length;m++) {
            if(emptyrows.has(m)) continue;
            
            const w = ws[m];
            const txt = w.textContent;
            if(/\s$/.test(txt.slice(-1))) {
                if(editiontext && editiontext.contains(w))
                    editionspace = true;
                spaced++;
            }
            else if(txt === '')
                empty++;
        }
        if(groupstart === n && empty + spaced === total && groups.length) {
            groups[groups.length-1].push(n);
            groupstart = n+1; 
        }
        else if(spaced / total >= 0.5 && (!editiontext || editionspace)) {
            if(groupstart === n) {
                groupstart++;
                continue;
            }
            else {
                groups.push(makeRange(groupstart, n));
                groupstart = n+1;
            }
        }
    }
    
    // deal with last column
    if(groupstart !== maxlemma) {
            groups.push(makeRange(groupstart, maxlemma));
    }

    for(const group of groups) {
        for(const text of texts) {
            const nums = [...group];
            const cl = doc.createElementNS(nURI,'cl');
            const firstw = text.querySelector(`w[n='${nums.shift()}']`);
            firstw.parentNode.insertBefore(cl,firstw);
            cl.appendChild(firstw);
            for(const num of nums)
                cl.appendChild(text.querySelector(`w[n='${num}']`));
        }
    }

    return doc;
};

export { processFile, preProcess, postProcess, groupBySpace, detectScript };
