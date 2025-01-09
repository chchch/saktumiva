import Fs from 'node:fs';
import Path from 'node:path';
import Process from 'node:process';
import Jsdom from 'jsdom';
import { readConfig } from './lib.mjs';
import { makeApp, addWitnesses, addApparatus, getWits } from '../lib/apparatus.mjs';

const DOM = new Jsdom.JSDOM('');

const parseString = (str, fname) => {
    const parser = new DOM.window.DOMParser();
    const newd = parser.parseFromString(str,'text/xml');
    if(newd.documentElement.nodeName === 'parseerror')
        console.log(`${fname} could not be loaded. Error: ${newd.documentElement.textContent}`);
    else
        return newd;
};

const getAllBlocks = teixml => {
    const els = teixml.querySelectorAll('p[xml:id],p[corresp],lg[xml:id],lg[corresp],l[xml:id],l[corresp],div[xmlid]');
    const allblocks = new Set();
    for(const el of els) {
        const id = el.getAttribute('xml:id');
        if(id) allblocks.add(id);
        const corresp = el.getAttribute('corresp')?.replace(/^#/,'');
        if(corresp) allblocks.add(corresp);
    }
    return allblocks;
};

const main = () => {
    const arg = Process.argv[2];
    const config = readConfig(arg);
    const fullpath = Path.join(config.dirname,config.edition.file);
    const teixml = parseString(Fs.readFileSync(fullpath,{encoding: 'utf-8'}));
    const newdoc = teixml.cloneNode(true);
    
    const cachedwitnesses = new Map();
    const cachedfiles = new Map();

    const selectedblocks = config.hasOwnProperty('blocks') && config.blocks.length !== 0 ?
        config.blocks: [...getAllBlocks];

    for(const block of selectedblocks) {

        const alignfn = Path.join(config.dirname, config.alignmentdir, block + '.xml');
        const alignxml = parseString(Fs.readFileSync(alignfn,{encoding: 'utf-8'}));
        if(config.edition.readingsfromfiles) {
            for(const wit of getWits(teixml,alignxml)) {
                if(!cachedwitnesses.get(wit.name)) {
                    let file = cachedfiles.get(wit.name);
                    if(!file) {
                        const witfn = Path.join(config.dirname, wit.filename);
                        file = parseString(Fs.readFileSync(witfn,{encoding: 'utf-8'}));
                        cachedfiles.set(wit.name,file);
                    }
                    cachedwitnesses.set(wit.name,{
                        type: wit.type,
                        select: wit.select,
                        xml: file
                    });
                }
            }
        }

        const app = makeApp(alignxml, newdoc, {
            base: config.edition.siglum,
            normlem: config.edition.usenormalized, 
            mergerdgs: config.edition.mergegroups,
            sort: config.edition.sort,
            blockid: block,
            witnesses: config.edition.readingsfromfiles ? cachedwitnesses : null,
            idsel: 'xml:id'
        });
        if(app.error)
            console.log(`Error creating apparatus for ${block}!`);
        else {
            addWitnesses(newdoc, app.listwit, 'xml:id');
            addApparatus(newdoc, app.listapp, alignxml, block, Path.join(config.alignmentdir,`${block}.xml`));
            console.log(`Created apparatus for ${block}.`);
        }

    }

    const serialized = (new DOM.window.XMLSerializer()).serializeToString(newdoc);
    Fs.writeFileSync(fullpath,serialized);
    console.log(`Wrote to ${fullpath}.`);
};

main();
