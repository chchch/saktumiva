import { filterAll, unfilterAll } from './normalize.mjs';
import { iast, wylie } from './split.mjs';
import Sanscript from './sanscript.mjs';
import EwtsConverter from './EwtsConverter.mjs';

const processTags = (text,tagstodelete) => {
    for(const todel of text.querySelectorAll(tagstodelete.join(',')))
        todel.remove();
    
    for(const gap of [...text.querySelectorAll('gap')]) {
        const reason = gap.getAttribute('reason');
        if(reason && reason === 'ellipsis') continue;
        gap.replaceWith('‡'.repeat(gap.getAttribute('quantity') || 1));
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
const scriptandfilter = (el,type,filters,langsel) => {
    const clone = el.cloneNode(true);
    if(type === 'ac') {
        for(const add of clone.querySelectorAll('add'))
            add.remove();
        for(const rdg of clone.querySelectorAll('rdg'))
            rdg.remove();
    }
    else if(type === 'pc') {
        for(const del of clone.querySelectorAll('del'))
            del.remove();
        for(const rdg of clone.querySelectorAll('rdg'))
            rdg.remove();
    }
    else if(type === 'lem') {
        for(const del of clone.querySelectorAll('del'))
            del.remove();
        for(const rdg of clone.querySelectorAll('rdg'))
            rdg.remove();
    }
    else if(type !== undefined) {
        for(const lem of clone.querySelectorAll('lem'))
            lem.remove();
        for(const del of clone.querySelectorAll('del'))
            del.remove();
        for(const rdg of clone.querySelectorAll('rdg'))
            if(!rdg.getAttribute('wit')?.split(/\s+/).includes(type))
                rdg.remove();
    }
    const str = clone.textContent;

    const script = detectScript(str);
    
    const lang = clone.closest(`[${langsel}]`)?.getAttribute('xml:lang');
    const charset = lang === 'bo' || lang === 'bo-Tibt' ? wylie : iast;
    
    let transliterated;
    if(script === 'tibetan') {
        const ewts = new EwtsConverter({fix_spacing: true, pass_through: true,fix_sloppy: false});
        transliterated = ewts.to_ewts(text.toLowerCase()
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

    return [...filterAll(transliterated.replaceAll(/[\n\s]+/g,' '),filters),charset];
};

const preProcess = (block, texts, opts) => {
    const selectedfilters = opts.selectedfilters;
    const splitfunc = opts.splitfunc;
    const idsel = opts.idsel || '*|id';
    const langsel = opts.langsel || '*|lang';
    const ignoretags = opts.ignoretags || [];

    const ret = [];
    for(const text of texts) {
        const {textel, type, par} = text.text;
        const siglum = text.siglum;
        let blockel = textel.querySelector(`*[${idsel}="${block}"], *[corresp="#${block}"]`);
        if(!blockel) continue;

        // TODO: is there a better way
        blockel = blockel.querySelector('*[type="edition"]') || blockel;

        processTags(blockel,ignoretags);
        if(type) {
            if( (type === 'ac' || type == 'pc') ) {
                const acpc = blockel.querySelector('add, del');
                if(!acpc) {
                    if(type === 'ac') {
                        const [clean,filters,charset] = scriptandfilter(blockel,'lem',selectedfilters,langsel);
                        ret.push({siglum: par, text: splitfunc(clean,charset), filters: filters});
                    }
                    continue;
                }
            }
            else if(type !== 'lem') {
               const rdg = blockel.querySelector(`rdg[wit~="${type}"]`);
               if(!rdg) continue;
            }
        }

        const [clean,filters,charset] = scriptandfilter(blockel,type,selectedfilters,langsel);
        ret.push({siglum: siglum, text: splitfunc(clean,charset), filters: filters});
    }
    return ret;
};

const toXML = (objs,tree,filters,alltexts,tagfilters) => {
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
    const witList = makeWitList(alltexts/*,objs.map(o => o.siglum)*/);
    let ret = `<?xml version="1.0" encoding="UTF-8"?>
<teiCorpus xmlns="http://www.tei-c.org/ns/1.0" xml:lang="ta">
  <teiHeader>
${witList}
    <encodingDesc>
      <editorialDecl>
        <normalization method="markup">
${filters.map(f => `<ab>${sanStr(f)}</ab>`).join('\n')}
        </normalization>
        <ab type="tagfilters">
${tagfilters.map(f => `<tag subtype="ignore">${f}</tag>`).join('\n')}
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
        ret = ret + `<witness xml:id="${witid}" source="${witlist[0][1].filename}"><abbr type="siglum">${witid}</abbr><expan>${witlist[0][1].title}</expan>`;

        if(witlist.length > 1)
            ret = ret + '<listWit>';

        if(witlist[0][1].type && witlist[0][1].type !== 'lem') 
            // this means there was only ac/pc, no parent
            ret = ret + `<witness xml:id="${witlist[0][0]}" n="${witlist[0][1].type}"><abbr type="siglum">${witlist[0][0]}</abbr><expan>${witlist[0][1].title} [${witlist[0][1].type === 'ac' ? 'ante' : 'post'} correctionem]</expan></witness>`;

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

            ret = ret + `<witness xml:id="${witlist[n][0]}"${typestr}><abbr type="siglum">${witlist[n][0]}</abbr><expan>${witlist[n][1].title}${poststr}</expan></witness>`;
        }

        if(witlist.length > 1)
            ret = ret + '</listWit>';

        ret = ret + '</witness>';
    }
    return ret + '</listWit>';
};

const postProcess = (alignment,prealign,filternames,alltexts,tagfilters) => {
    const block = prealign.block;
    const filtersmap = prealign.filtersmap;
    const clean = alignment.alignment.map(arr => arr.map(a => Array.isArray(a) ? a.join('') : a));
    const newclean = [];
    for(const row of clean) {
        const id = alignment.sigla.shift();
        const f = filtersmap.get(id);
        const unfiltered = unfilterAll([...row],f);
        const ret = new Array(unfiltered.length);
        for(let n=0;n<unfiltered.length;n++) {
            if(unfiltered[n] === row[n])
                ret[n] = unfiltered[n];
            else
                ret[n] = [unfiltered[n],row[n]];
        }
        newclean.push({siglum: id, text: ret});
    }
    return [block,toXML(newclean,alignment.tree,filternames,alltexts,tagfilters)];
};

const processFile = (teixml, filename, state, idsel = '*|id') => {
   
    const warnings = [];
    const texts = [...teixml.querySelectorAll('text')];
    const title = teixml.querySelector('titleStmt > title').innerHTML.trim();

    for(const text of texts) {
        const id = text.getAttribute('corresp')?.replace(/^#/,'') || teixml.querySelector('idno[type="siglum"]')?.textContent || teixml.documentElement.getAttribute('n');
        
        if(!id) {
            warnings.push(`No siglum for ${filename}.`);
            continue;
        }

        if(state.alltexts.has(id) ||
           state.alltexts.has(`${id}ac`))
            warnings.push(`Warning: ${id} used more than once.`);
        
        const acpc = text.querySelector('add, del');

        const rdgs = [...text.querySelectorAll('rdg')];
        if(rdgs.length !== 0) {
            if(acpc) {
                state.alltexts.set(`${id}ac`,{textel: text, filename: filename, title: title, type: 'ac', par: id});
                state.alltexts.set(`${id}pc`,{textel: text, filename: filename, title: title, type: 'pc', par: id});
            }
            else
                state.alltexts.set(id,{textel: text, filename: filename, title: title, type: 'lem'});

            const wits = rdgs.reduce((acc,cur) => {
                const w = cur.getAttribute('wit');
                if(!w) return acc;
                for(const ww of w.split(/\s+/))
                    acc.add(ww);
                return acc;
            },new Set());
            for(const wit of wits) {
                const witid = wit.replace(/^#/,'');
                state.alltexts.set(`${id}-${witid}`,{textel: text, filename: filename, title: title, type: wit, par: id});
            }
        }
        else if(acpc) {
            state.alltexts.set(`${id}ac`,{textel: text, filename: filename, title: title, type: 'ac', par: id});
            state.alltexts.set(`${id}pc`,{textel: text, filename: filename, title: title, type: 'pc', par: id});
        }
        else
            state.alltexts.set(id,{textel: text, filename: filename, title: title});
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
        }

        if(spaced / total >= 0.5 && (!editiontext || editionspace)) {
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
