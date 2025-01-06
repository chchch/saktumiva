import xmlFormat from './xml-formatter.mjs';

const mergeGroups = (doc) => {
    const els = doc.querySelectorAll('cl');
    for(const el of els) {
        const firstw = el.removeChild(el.firstElementChild);
        while(el.firstElementChild) {
            const norm1 = firstw.getAttribute('lemma') || firstw.textContent;
            const norm2 = el.firstElementChild.getAttribute('lemma') || el.firstElementChild.textContent;
            firstw.setAttribute('lemma',norm1 + norm2);
            while(el.firstElementChild.firstChild)
                firstw.appendChild(el.firstElementChild.firstChild);
            el.firstElementChild.remove();
        }
        if(firstw.getAttribute('lemma') === firstw.textContent)
            firstw.removeAttribute('lemma');
        el.parentNode.insertBefore(firstw,el);
        el.parentNode.removeChild(el);
    }
};

const makeSorter = order => {
    return (a,b) => {
        const aindex = order.indexOf(a);
        const bindex = order.indexOf(b);
        return aindex < bindex ? -1 : 1; 
    };
};

const getWitList = (doc, opts, arr) => {
    const sorter = opts.sorter;
    const idsel = opts.idsel;
    const noformat = opts.noformat || false;
    const attr = opts.attr || 'wit';
    const mustcontain = opts.mustcontain || new Set();
    const listWit = doc.querySelector('listWit');
    const wits = new Set(arr);
    const newwits = new Set();
    for(const wit of wits) {
        const witel = listWit.querySelector(`witness[${idsel}="${wit}"]`);
        const type = witel.getAttribute('n');
        const par = witel.parentNode.closest('witness');
        const parid = par?.getAttribute('xml:id');
        const ac = parid && par.querySelector('witness[n="ac"]')?.getAttribute('xml:id');
        const pc = parid && par.querySelector('witness[n="pc"]')?.getAttribute('xml:id');

        if(!type) {
            if( (parid && wits.has(parid)) && !mustcontain.has(wit) ) 
                continue;
            else newwits.add(wit);
        }
        else if(type === 'ac' && pc && wits.has(pc) && !mustcontain.has(wit) && !mustcontain.has(pc)) { 
                newwits.add(parid);
        }
        else if(type === 'pc' && ac && wits.has(ac) && !mustcontain.has(wit) && !mustcontain.has(ac)) {
                newwits.add(parid);
        }
        else newwits.add(wit);
    }
    if(noformat) {
        if(sorter)
            return [...newwits].sort(sorter);
        return [...newwits];
    }
    if(sorter)
        return `${attr}="${[...newwits].sort(sorter).map(w => '#' + w).join(' ')}"`;
    else
        return `${attr}="${[...newwits].map(w => '#' + w).join(' ')}"`;
};

const curry = f => {
    return a => {
        return b => {
            return c => {
                return f(a,b,c);
            };
        };
    };
};

/*
const fetchFile = async fn => {
    const response = await fetch(fn);
    const str = await response.text();
    return str;
};
const loadOtherTEI = async (listWit) => {
    const files = new Map();
    const wits = new Map();
    for(const witel of listWit.querySelectorAll('witness')) {
        const filename = witel.closest('[source]').getAttribute('source');
        if(!files.has(filename)) files.set(filename,parseString(await fetchFile(filename),filename));

        wits.set(witel.getAttribute('xml:id'), {
            file: files.get(filename),
            type: witel.getAttribute('type'),
            subtype: witel.getAttribute('subtype')
        });
    }

    return wits;
};

const getStart = (el, n) => {
    const ws = el.querySelectorAll('w');
    let ret = 0;
    for(const w of ws) {
       if(w.getAttribute('n') === 'n') break;
       ret = ret + w.textContent.length;
    }
    return ret;
};

const getTEIRdg = (witfile, blockid, positions) => {
    const block = witfile.file.querySelector(`[*|id="${blockid}"], [corresp="#${blockid}"]`);
    const type = witfile.type;
    const subtype = witfile.subtype;

    const walker = block.ownerDocument.createTreeWalker(block,NodeFilter.SHOW_ALL, { acceptNode() {return NodeFilter.FILTER_ACCEPT;}});
    let start = 0;
    let started = false;
    const range = new Range();

    while(walker.nextNode()) {
        const cur = walker.currentNode;

        if(cur.nodeType === 1) {
            if(cur.nodeName === 'lem' && type && type !== 'ac' && type !== 'pc') continue;
            if(cur.nodeName === 'add' && type === 'ac') continue;
            if(cur.nodeName === 'del' && type !== 'ac') continue;
            if(cur.nodeName === 'rdg' && !cur.getAttribute('wit').split(' ').includes(subtype)) continue;
        }
        
        else if(cur.nodeType === 3) {
            const nodecount = cur.data.length;
            const end = start + nodecount;
            if(!started && positions[0] <= end) {
                const realpos = positions[0]-start;
                range.setStart(cur,realpos);
                started = true;
            }
            if(positions[1] <= end) {
                const realpos = positions[1]-start;
                range.setEnd(cur,realpos);
                break;
            }
            start = end;
        }
    }
    const div = document.createElement('div');
    div.appendChild(range.cloneContents());
    return div.innerHTML.trim();
};

const getTEIRdgs = (rdgs,blockid,witdocs,alignment,dataN) => {
    const newrdgs = new Map();
    for(const [rdg,wits] of rdgs) {
        for(const wit of wits) {
            const witfile = witdocs.get(wit);
            const row = alignment.querySelector(`TEI[n="${wit}"] text`);
            const startcount = getStart(row,dataN);
            const endcount = startcount + rdg.length;
            console.log(`${wit}, ${rdg}`);
            const xmlrdg = getTEIRdg(witfile,blockid,[startcount,endcount]);
            
            const newentry = newrdgs.get(xmlrdg) || [];
            newentry.push(wit);
            newrdgs.set(xmlrdg,newentry);
        }
    }
    return newrdgs;
};
*/

const getWitOrder = el => {
    return [...el.querySelectorAll('witness')].map(w => w.getAttribute('xml:id'));
};

const formatReading = str => {
    return str.replace(/‡+/g,(match) => `<gap reason="lost" quantity="${match.length}"/>`);
    // TODO: deal with akṣaras, lines, etc.
};

const processReadings = (n,otherdocs,otherrdgs,lemma,opts,posapp,negapp) => {
    for(const otherdoc of otherdocs) {
        const id = otherdoc.getAttribute('n');
        const otherword = otherdoc.querySelectorAll('w')[n];
        const trimmed = otherword.textContent.trim();
        const normword = otherword.getAttribute('lemma');

        if(opts.normlem && (normword || trimmed) === lemma)
            posapp.add(id);
        else {
            const newstr = opts.normlem ? normword || trimmed : 
                    trimmed;
            const realrdg = opts.witnesses ? 
                otherrdgs.get(id)[n] :
                trimmed;
            const negwits = negapp.get(newstr) || new Map();
            const negrdg = negwits.get(realrdg) || [];
            negrdg.push(id);
            negwits.set(realrdg,negrdg);
            negapp.set(newstr,negwits);
        }
    }
};

const formatMinorReadings = (arr,doc,witlistopts) => {
    const curriedWitList = curry(getWitList)(doc)({...witlistopts, noformat: true });
    const allwits = new Set();
    const attr = witlistopts.attr || 'wit';
    let rdgstr = '';
    for(const e of arr) {
        const ret = curriedWitList(e[1]);
        for(const wit of ret) allwits.add(wit);
        const attrstr = `${attr}="${[...ret].map(w => '#' + w).join(' ')}"`;
        rdgstr = rdgstr +  `<rdg type="minor" ${attrstr}>${e[0]}</rdg>`;
    }
    return {wits: allwits, rdgstr: rdgstr};
};

const processNegApp = (negapp, doc, witlistopts) => {
    const curriedWitList = curry(getWitList)(doc)(witlistopts);
    let app = '';
    for(const rdg of negapp.values()) {
        /*
        const newrdgs = getTEIRdgs(rdg,opts.blockid,witdocs,doc,dataN);
        const rdgstr = newrdgs.keys().next().value;
        const negwits = curriedWitList([...newrdgs.values()].flat());
        const allwits = [...newrdgs];
        */
        const rdgarr = [...rdg];
        const mainrdg = rdgarr[0];
        const rdgstr = formatReading(mainrdg[0]);
        
        if(rdgarr.length === 1) {
            const negwits = curriedWitList(mainrdg[1].flat());
            app = app + `  <rdg ${negwits}>${rdgstr}</rdg>\n`;
        }
        else {
            const remainingrdgs = rdgarr.slice(1);
            const {wits: minorwits, rdgstr: minorrdgs} = formatMinorReadings(remainingrdgs,doc,witlistopts);
            
            const negwits = getWitList(doc,
                 {...witlistopts,
                 attr: 'select',
                 //mustcontain: remainingrdgs.reduce((acc,cur) => acc.concat(cur[1]),[])
                 mustcontain: minorwits,
                },
                [...rdg.values()].flat()
            );
            app = app + `  <rdgGrp ${negwits}><rdg type="main">${rdgstr}</rdg>${minorrdgs}</rdgGrp>\n`;
        }
    }
    return app;
};

const realNextSibling = walker => {
    let cur = walker.currentNode;
    while(cur) {
        const sib = walker.nextSibling();
        if(sib) return sib;
        cur = walker.parentNode();
    }
    return null;
};

const cleanBlock = (blockid,idsel,wit) => {
    const block = wit.xml.querySelector(`[corresp="#${blockid}"], [${idsel}="${blockid}"]`).cloneNode(true);
    for(const el of block.querySelectorAll('caesura, l, lg')) { // TODO: what if caesura isn't ignored?
        while(el.firstChild)
            el.parentNode.insertBefore(el.firstChild,el);
        el.remove();
    }
    if(wit.type || wit.select) {
        if(wit.type === 'pc')
            for(const del of block.querySelectorAll('del'))
                del.remove();
        if(wit.type === 'ac')
            for(const add of block.querySelectorAll('add'))
                add.remove();
        if(!wit.select)
            for(const rdg of block.querySelectorAll('rdg'))
                rdg.remove();
        else {
            for(const app of block.querySelectorAll('app')) {
                const lem = app.querySelector('lem');
                const rdgs = app.querySelector('rdg');
                let foundreading = false;
                for(const rdg of rdgs) {
                    if(rdg.getAttribute('wit').split(' ').includes(wit.select))
                        foundreading = true;
                    else
                        rdg.remove();
                }
                if(foundreading) lem.remove();
            }
        }
    }
    block.normalize();
    return block;
};

const getXMLRdgs = (blockid, alignment, wit, idsel = '*|id') => {
    const doc = wit.xml;
    const block = cleanBlock(blockid,idsel,wit);
    const words = [...alignment.querySelectorAll('w')];
    const ignoretags = ((par) => {
        const filters = par.querySelector('ab[type="tagfilters"]');
        if(!filters) return new Set();
        return new Set([...filters.querySelectorAll('tag[subtype="ignore"]')].map(f => f.textContent.trim()));
    })(alignment.parentNode);
    const ranges = [];

    let start = 0;
    let end = 0;
    let prevspace = false;
    let curword = words.shift();
    let wordend = curword.textContent.replaceAll('‡','').length;
    let currange = doc.createRange();
    const walker = doc.createTreeWalker(block,0xFFFFFFFF);
    let node = walker.nextNode();
    currange.setStart(block.firstChild,0);
    mainLoop: while(node) {
        if(node.nodeType === 1) {
            if(ignoretags.has(node.nodeName)) {
                node = realNextSibling(walker); 
                continue;
            }
        }
        if(node.nodeType === 3) {
            node.data = node.data.replaceAll(/\s+/g,' ');
            let nodecount = node.data.length;
            if(prevspace) {
                if(node.data.startsWith(' ')) {
                    start = start - 1;
                }
                prevspace = false;
            }
            if(node.data.endsWith(' '))
                prevspace = true;

            end = start + nodecount;
            while(wordend <= end) {
                currange.setEnd(node,wordend - start);
                const clone = currange.cloneContents();
                const temp = doc.createElement('temp');
                temp.appendChild(clone);
                ranges.push(temp.innerHTML.replaceAll(' xmlns="http://www.tei-c.org/ns/1.0"','').replaceAll(/\s+/g,' ').trim());

                currange = doc.createRange();
                currange.setStart(node,wordend - start);
                curword = words.shift();
                if(!curword) break mainLoop;
                wordend = curword.textContent.replaceAll('‡','').length + wordend;
            }
            start = end;
        }
        node = walker.nextNode();
    }
    return ranges;
};

const makeApp = (doc, ed, opts) =>  {
    const base = doc.querySelector(`TEI[n="${opts.base}"]`);
    if(!base) return {error: `${opts.base} not found in alignment file.`};
    if(opts.mergerdgs) mergeGroups(doc);
    
    const curListWit = ed.querySelector('listWit');
    
    const idsel = opts.idsel || '*|id';
    const sorter = opts.sort ? makeSorter(opts.sort) :
                   curListWit ? makeSorter(getWitOrder(curListWit)) : 
                   null;
    const witlistopts = {sorter: sorter, idsel: idsel};

    //const curriedWitList = curry(getWitList)(doc)(witlistopts);
    
    const words = doc.querySelector(`TEI[n="${opts.base}"]`).querySelectorAll('w');
    const otherdocs = doc.querySelectorAll(`TEI:not([n="${opts.base}"])`);
    const otherrdgs = new Map(
        [...otherdocs].map(d => {
            const docid = d.getAttribute('n');
            const rdgs = getXMLRdgs(opts.blockid,d,opts.witnesses.get(docid),idsel);
            return [docid, rdgs];
        }));

    let ret = '';
    let start = 0;
    for(let n=0; n<words.length;n++) {
        const word = words[n];

        const lemma = opts.normlem ? 
            (word.getAttribute('lemma') || word.textContent.trim()) :
            word.textContent.trim();
        const end = start + word.textContent.replaceAll(/\s/g,'').length;

        const posapp = new Set();
        const negapp = new Map();
        processReadings(n,otherdocs,otherrdgs,lemma,opts,posapp,negapp);

        if(negapp.size === 0) {
            start = end;
            continue;
        }

        let app = `<app corresp="${start},${end}">\n`;

        const poswits = getWitList(doc,witlistopts,posapp);
        app = app + `  <lem ${poswits}>${word.innerHTML.trim()}</lem>\n`;
        
        app = app + processNegApp(negapp,doc,witlistopts);

        app = app + '</app>\n';    

        ret = ret + app;

        start = end;
        
    }

    return {listwit: doc.querySelector('listWit'), listapp: ret};
};

const addWitnesses = (doc, listwit, idsel='*|id') => {
    const nURI = doc.documentElement.namespaceURI;
    const doclistwit = doc.querySelector('sourceDesc > listWit') ||
        (() => {
            const el = doc.createElementNS(nURI,'listWit');
            doc.querySelector('sourceDesc').appendChild(el);
            return el;
        })();
    for(const wit of listwit.querySelectorAll('witness')) {
        const witid = wit.getAttribute('xml:id');
        if(doclistwit.querySelector(`witness[${idsel}="${witid}"]`)) continue;
        
        const witclone = wit.cloneNode(true);

        const parwit = wit.closest('witness');
        if(!parwit)
            doclistwit.appendChild(witclone);
        else {
            const parwitid = parwit.getAttribute('xml:id');
            const docparwit = doclistwit.querySelector(`witness[${idsel}="${parwitid}"]`);
            if(docparwit) {
                let docparlistwit = docparwit.querySelector('listWit');
                if(!docparlistwit) {
                        docparlistwit = doc.createElementNS(nURI,'listWit');
                        docparwit.appendChild(el);
                }
                docparlistwit.appendChild(witclone);
            }
            else
                doclistwit.appendChild(witclone);
        }
    }
};

const addApparatus = (doc, listappstr, alignxml, block, alignmentfn) => {
    const nURI = doc.documentElement.namespaceURI;
    const docstandoff = doc.querySelector(`standOff[type="apparatus"][corresp="#${block}"]`) || (() => {
        const newstandoff = doc.createElementNS(nURI,'standOff');
        newstandoff.setAttribute('type','apparatus');
        newstandoff.setAttribute('corresp',`#${block}`);
        newstandoff.setAttribute('source',alignmentfn);
        doc.documentElement.appendChild(newstandoff);
        return newstandoff;
    })();
    const tagfilters = alignxml.querySelector('ab[type="tagfilters"]')?.innerHTML || '';
    const formatopts =  {
        indentation: '  ',
        collapseContent: true,
        lineSeparator: '\n'
    };
    docstandoff.innerHTML = xmlFormat(`<interp type="normalization"><desc type="tagfilters">${tagfilters}</desc></interp>`,formatopts) +
        xmlFormat(`<listApp>${listappstr}</listApp>`, formatopts);
};

const getWits = doc => {
    const wits = doc.querySelectorAll('witness');
    return [...wits].map(w => {
        return {
            name: w.getAttribute('xml:id'),
            filename: w.getAttribute('source') || w.closest('[source]').getAttribute('source'),
            type: w.getAttribute('n'),
            select: w.getAttribute('select')
        };
    });
};

export { makeApp, addWitnesses, addApparatus, getWits };
