import { makeApp, addWitnesses, addApparatus, getWits } from './apparatus.mjs';
import { loadDoc, handleToXML } from '../editmode/utils.mjs';
import previewDoc from '../editmode/preview.mjs';

const doCollate = async (xmldoc,htmldoc,alignments,popup,opts) => {
    //const cachefunc = opts.mode === 'serverless' ? cacheWitnesses : cacheWitnesses2;
    const checked = popup.querySelector('#blocklist input[value]:checked');
    if(!checked) {
        alert('No block selected.');
        return;
    }
    const button = popup.querySelector('#collatebutton');
    button.style.display = 'none';
    const spinner = popup.querySelector('.spinner');
    spinner.style.display = 'inline-block';
    const cachedwitnesses = new Map();
    const cachedfiles = new Map();
    //await cachefunc(xmldoc,cachedwitnesses,cachedfiles,opts);
    await cacheWitnesses(xmldoc,cachedwitnesses,cachedfiles,opts);
    const siglum = xmldoc.querySelector('idno[type="siglum"]')?.textContent || xmldoc.documentElement.getAttribute('n');
    const blocklist = [];
    for(const block of popup.querySelectorAll('#blocklist input[value]')) {
        if(!block.checked) continue;
        blocklist.push(block.value);

        const base = xmldoc.querySelector(`[*|id='${block.value}']`).closest('text').getAttribute('corresp')?.replace(/^#/,'') || siglum;
        const alignobj = alignments.get(block.value);
        if(!alignobj.doc) {
            if(opts.mode === 'serverless')
              alignobj.doc = await loadDoc(alignobj.filename);
            else
              alignobj.doc = await handleToXML(alignobj.handle);
        }
        //await cachefunc(alignobj.doc,cachedwitnesses,cachedfiles,opts);
        await cacheWitnesses(alignobj.doc,cachedwitnesses,cachedfiles,opts);
        const app = makeApp(alignobj.doc, xmldoc, {
            base: base,
            normlem: popup.querySelector('#normlem').checked,
            mergerdgs: popup.querySelector('#mergerdgs').checked,
            maxomlength: popup.querySelector('#maxom').checked ?
              popup.querySelector('#maxomlen').value : null,
            blockid: block.value,
            witnesses: cachedwitnesses
        });
        if(app.error) {
          alert(app.error);
          button.style.display = 'unset';
          spinner.style.display = 'none';
          popup.style.display = 'none';
          return;
        }
        addWitnesses(xmldoc,app.listwit);
        addApparatus(xmldoc,app.listapp,app.warnings,alignobj.doc,block.value,alignobj.path || alignobj.filename);
        
    }
    // TODO: only preview selected blocks
    const newDoc = opts.mode === 'serverless' ? 
        await previewDoc(xmldoc) :
        await previewDoc(xmldoc,'./edition.xsl');
    for(const id of blocklist) {
        const newblock = newDoc.getElementById(id);
        const newpar = newblock.closest('.wide');
        const newwide = newpar || newblock; // TODO: this is ugly

        const oldblock = htmldoc.querySelector(`*[id="${id}"]`);
        const oldpar = oldblock.closest('.wide');
        const oldwide = oldpar || oldblock;

        oldwide.parentNode.replaceChild(newwide,oldwide);
        //newblock.style.border = '1px dashed red';
        newwide.classList.add('edited');
        if(!newwide.id) newwide.id = `edited_${crypto.randomUUID()}`;
        const rc = htmldoc.querySelector('#recordcontainer');
        (new BroadcastChannel('apparatus')).postMessage({id: newwide.id, uuid: rc.dataset.appid});
        (new BroadcastChannel('transliterator')).postMessage({id: newwide.id, uuid: rc.dataset.transid});
    }
    htmldoc.querySelector('#editblackout').style.display = 'none';
    htmldoc.querySelector(`*[id="${blocklist[0]}"]`).scrollIntoView({behavior: 'smooth',block: 'center'}); 

    // keep clicking until the apparatus appears... pretty hacky solution
    const appbutton = htmldoc.querySelector('#apparatusbutton');
    appbutton.click();
    if(htmldoc.querySelector('.apparatus-block.hidden'))  {
        appbutton.click();
    }
    button.style.display = 'unset';
    spinner.style.display = 'none';
    popup.style.display = 'none';
    return blocklist;
};

const getFile = async (wit,opts) => {
    if(opts.witnesses) {
      const handle = opts.witnesses.get(wit.filename)?.handle;
      if(handle)
        return {file: await handleToXML(handle), newfilename: null};
      return {file: null, newfilename: null};
    }

    let file = await loadDoc(wit.filename);
    let newfilename;
    if(!file) {
      newfilename = `${opts.witnessDir}/${wit.filename}`;
      file = await loadDoc(newfilename);
    }
    return {file: file, newfilename: newfilename};
};

const cacheWitnesses = async (doc, witmap, filemap, opts) => {
  for(const wit of getWits(doc)) {
    if(!wit.filename) continue;
    if(!witmap.get(wit.name)) {
      let file = filemap.get(wit.filename);
      let newfilename;
      if(!file) {
        ({file: file, newfilename: newfilename} = await getFile(wit,opts));
        /*
        file = await loadDoc(wit.filename);
        if(!file) {
          newfilename = `${opts.witnessDir}/${wit.filename}`;
          file = await loadDoc(newfilename);
        }
        */
        if(file) filemap.set(wit.filename,file);
      }
      if(file) {
        witmap.set(wit.name, {
            name: wit.name,
            type: wit.type,
            select: wit.select,
            xml: file
        });
      if(newfilename)
        witmap.get(wit.name).updatedfilename = newfilename;
      }
    }
  }
};
/*
const cacheWitnesses2 = async (doc, witmap, filemap, optWitnesses => {
  for(const wit of getWits(doc)) {
    if(!wit.filename) continue;
    if(!witmap.get(wit.name)) {
      let file = filemap.get(wit.filename);
      let newfilename;
      if(!file) {
        const handle = opts.witnesses.get(wit.filename)?.handle;
        if(handle)
          file = await handleToXML(handle);
        if(file) filemap.set(wit.filename,file);
      }
      if(file) {
        witmap.set(wit.name, {
            name: wit.name,
            type: wit.type,
            select: wit.select,
            xml: file
        });
      if(newfilename)
        witmap.get(wit.name).updatedfilename = newfilename;
      }
    }
  }
};
*/
export default doCollate;
