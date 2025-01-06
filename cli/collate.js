import Fs from 'node:fs';
import Path from 'node:path';
import Process from 'node:process';
import Glob from 'glob-fs';
import Jsdom from 'jsdom';
import { processFile, preProcess, postProcess, groupBySpace } from '../lib/collate.mjs';
import { spaceSplit, aksaraSplit, charSplit, graphemeSplit } from '../lib/split.mjs';
import { filters as allFilters } from '../lib/normalize.mjs';
import MultiAlign from '../lib/multialign.mjs';
import { readConfig } from './lib.mjs';

const DOM = new Jsdom.JSDOM('');

const parseString = (str,fname) => {
    const parser = new DOM.window.DOMParser();
    const newd = parser.parseFromString(str,'text/xml');
    if(newd.documentElement.nodeName === 'parsererror')
        console.log(`${fname} could not be loaded. Error: ${newd.documentElement.textContent}`);
    else
        return newd;
};
const serializeXML = doc => {
    const serializer = new DOM.window.XMLSerializer();
    return serializer.serializeToString(doc);
};

const getFiles = config => {
    const glob = Glob();
    const filenames = (config => {
        if(typeof config.files === 'string') {
            return glob.readdirSync(Path.join(config.dirname,config.files));
        }
        else if(Array.isArray(config.files))
            return config.files.reduce((acc,cur) => {
                const fullpath = Path.join(config.dirname, cur);
                if(Fs.existsSync(fullpath))
                    return [...acc, fullpath];

                return [...acc,...glob.readdirSync(fullpath)];
            },[]);
    })(config);
    
    const reference = {
        alltexts: new Map(),
        allblocks: new Set()
    };

    for(const fn of filenames) {
        const relativepath = Path.relative(config.dirname,fn);
        const teixml = parseString(Fs.readFileSync(fn,{encoding: 'utf-8'}));
        const texts = [...teixml.querySelectorAll('text')];
        const title = teixml.querySelector('titleStmt > title').innerHTML.trim();
        const warnings = processFile(teixml, relativepath, reference, 'xml:id');
        if(warnings.length !== 0)
            for(const warning of warnings)
                console.log(warning);
                    
    }

    return reference;
};

const getFilterIndices = (config) => {
    const ret = [];
    if(!config.filtergroups && !config.filters) return [[],[]];

    for(const [i,filter] of allFilters.entries()) {
        if(config.filtergroups && config.filtergroups.includes(filter.group))
            ret.push([i,filter.name]);
        else if(config.filters && config.filters.includes(filter.name))
            ret.push([i,filter.name]);
    }
    return ret.reduce((acc,cur) => {
        acc[0].push(cur[0]);
        acc[1].push(cur[1]);
        return acc;
    },[[],[]]);
};

const saveFile = (data, path) => {
    try {
        Fs.writeFileSync(path, data[1]);
        console.log(`saved to ${path}.`);
    } catch (err) {
        console.log(`failed to save ${path}: ${err}.`);
    }
};

const main = () => {
    const arg = Process.argv[2];
    const config = readConfig(arg);
    if(!config) return;

    const {alltexts, allblocks} = getFiles(config);

    const tok = config.tokenization || 'character';

    const splitfunc = ((tok) => {
        switch(tok) {
            case 'whitespace': return spaceSplit;
            case 'aksara': return aksaraSplit;
            case 'grapheme': return graphemeSplit;
            default: return charSplit;
        }
    })(tok);

    const scores = [config.scoring.match, 
                    config.scoring.mismatch, 
                    config.scoring.gapopen, 
                    config.scoring.gapextension, 
                    config.scoring.realignmentdepth].map(s => parseFloat(s));

    const configfunc = tok === 'character' ? 'character' : 
        config.scoring.recursive ? 'arr' : 'arr_simple';
    
    const [filterindices,filternames] = getFilterIndices(config);

    const selectedsigla = config.hasOwnProperty('sigla') && config.sigla.length !== 0 ? 
        config.sigla : [...alltexts.keys()];
    const selectedblocks = config.hasOwnProperty('blocks') && config.blocks.length !== 0 ? 
        config.blocks : [...allblocks];
    
    const selectedtexts = selectedsigla.map(s => {
        return {siglum: s, text: alltexts.get(s)};
    });

    for(const block of selectedblocks) {
        Process.stdout.write(`Aligning ${block}... `);
        const texts = preProcess(block, selectedtexts, {splitfunc: splitfunc, selectedfilters: filterindices, ignoretags: config.ignoretags, idsel: 'xml:id', langsel: 'xml:lang'});
        if(texts.length === 1) {
            console.log('Nothing to align.');
            continue;
        }
        const filtersmap = new Map(texts.map(t => [t.siglum, t.filters]));
        const aligned = MultiAlign(texts, configfunc, scores);
        const postaligned = postProcess(
            aligned,
            {block: block, filtersmap: filtersmap},
            filternames, 
            alltexts,
            config.ignoretags
         );
        if(!config.hasOwnProperty('lemmagroups') || config.lemmagroups === true) {
            const grouped = groupBySpace(parseString(postaligned[1],`${block}.xml`),config.edition?.siglum);
            postaligned[1] = serializeXML(grouped);
        }
        saveFile(postaligned,Path.join(config.dirname,config.alignmentdir,`${block}.xml`));
    }
};

main();
