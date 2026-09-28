import Fs from 'fs';
import Jsdom from 'jsdom';
import Serialize from 'w3c-xmlserializer';

var document;
const TEINS = 'http://www.tei-c.org/ns/1.0';

const go = async () => {
    const fname = process.argv[2];
    const f = Fs.readFileSync(fname,{encoding: 'utf-8'});
    const dom = new Jsdom.JSDOM('');
    const parser = new dom.window.DOMParser();

    document = parser.parseFromString(f,'text/xml');
    convert(document);
    
    const preamble = '<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="tei-to-html.xsl" ?>\n';
    const out = preamble + Serialize(document);
    const newfname = fname.replace(/\.txt$/,'.xml');
    Fs.writeFileSync(newfname,out,{encoding: 'utf-8'});
};

const convertLang = document => {
  const scriptcodes = new Map([
    ['Deva','devanagari'],
    ['Mlym','malayalam'],
    ['Telu','telugu'],
    ['Newa','newa']
  ]);
  const textLang = document.querySelector('textLang');
  if(!textLang) return;
  const mainLang = textLang.getAttribute('mainLang');
  if(!mainLang) return;
  const [lang,script] = mainLang.split('-');
  if(lang === 'sa') textLang.setAttribute('mainLang','san');
  else textLang.setAttribute('mainLang',lang);
  const newscript = scriptcodes.get(script);
  if(!newscript) return;
  const physDesc = document.querySelector('physDesc');
  if(!physDesc) return;
  const handNote = document.querySelector('handNote') || document.createElementNS(TEINS,'handNote');
  const handDesc = document.querySelector('handDesc') || document.createElementNS(TEINS,'handDesc');
  handNote.setAttribute('script',newscript);
  handDesc.appendChild(handNote);
  physDesc.appendChild(handDesc);
  const text = document.querySelector('text');
  if(text) text.setAttribute('xml:lang',lang);
};

const addLbs = document => {
  for(const pb of document.querySelectorAll('pb')) {
    const sib = pb.nextSibling;
    if(sib.nodeType !== 1 || sib.nodeName !== 'lb') {
      const lb = document.createElementNS(TEINS,'lb');
      lb.setAttribute('n','1');
      pb.after(lb);
    }
  }
};

const convertNotes = document => {
  const notetype = new Map([
    ['sources','notes1'],
    ['parallels','notes2'],
    ['testimonia','notes3'],
    ['notes','notes4']
  ]);
  const abs = new Set();
  const tei = document.querySelector('TEI');
  for(const anchor of document.querySelectorAll('anchor')) {
    const n = anchor.getAttribute('n');
    if(!n) continue;
    const par = anchor.closest('[*|id]');
    const parid = par.getAttribute('xml:id');
    const ab = document.querySelector(`ab[corresp="#${parid}"]`);
    if(!ab) continue;
    abs.add(ab);
    anchor.setAttribute('xml:id',n);
    anchor.removeAttribute('n');
  }
  for(const ab of abs) {
    for(const list of ab.querySelectorAll('list')) {
      const standOff = document.createElementNS(TEINS,'standOff');
      const type = notetype.get(list.getAttribute('type')) || 'notes4';
      standOff.setAttribute('type',type);
      standOff.setAttribute('corresp',ab.getAttribute('corresp'));
      for(const item of list.querySelectorAll('item')) {
        const note = document.createElementNS(TEINS,'note');
        note.setAttribute('xml:lang','en');
        note.setAttribute('target',item.getAttribute('corresp'));
        note.innerHTML = item.innerHTML;
        standOff.appendChild(note);
      }
      tei.appendChild(standOff); 
    }
    ab.remove();
  }
};

const convertQuotes = document => {
  for(const lg of document.querySelectorAll('lg[type="quote"]')) {
    const q = document.createElementNS(TEINS,'q');
    q.setAttribute('rend','block');
    lg.after(q);
    q.appendChild(lg);
    lg.removeAttribute('type');
  }
};

const convertTranspositions = document => {
  for(const ptr of document.querySelector('text').querySelectorAll('ptr[target]')) {
    const id = ptr.getAttribute('target').replace(/^#/,'');
    const supplied = document.querySelector(`supplied[id="${id}"]`);
    const surplus = document.createElementNS(TEINS,'surplus');
    while(supplied.firstChild)
      surplus.appendChild(supplied.firstChild);
    ptr.after(surplus);
    ptr.remove();
    const ptrid = ptr.getAttribute('id');
    surplus.setAttribute('xml:id',ptrid);
    surplus.setAttribute('reason','interpolated');
    supplied.removeAttribute('id');
    supplied.setAttribute('corresp','#' + ptrid);
    supplied.setAttribute('reason','interpolated');
  }
};

const convert = document => {
    const TEI = document.querySelector('TEI');
    const scripttag = document.createElementNS('http://www.w3.org/1999/xhtml','script');
    scripttag.setAttribute('src','../lib/js/xslt-polyfill.min.js');
    TEI.prepend(scripttag);
    
    convertLang(document);
    addLbs(document);
    convertNotes(document);
    convertQuotes(document);
    convertTranspositions(document);

    for(const lg of document.querySelectorAll('lg')) {
      if(lg.getAttribute('type') === 'verse')
        lg.removeAttribute('type');
      if(lg.hasAttribute('xml:id') && lg.hasAttribute('id'))
        lg.removeAttribute('id');
    }
};
go();
