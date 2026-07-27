import tagFilters from './tagfilters.mjs';
import { filters as normFilters } from './normalize.mjs';

const appendList = (par, els) => {
  par.innerHTML = '';
  const item1 = document.createElement('div');
  const input1 = document.createElement('input');
  input1.setAttribute('type','checkbox');
  input1.setAttribute('name','selectall');
  input1.id = `input_${crypto.randomUUID()}`;
  const label1 = document.createElement('label');
  label1.className = 'special';
  label1.textContent = 'Select all';
  label1.setAttribute('for',input1.id);
  item1.appendChild(input1);
  item1.appendChild(label1);
  par.appendChild(item1);
  for(const el of els) {
    const item = document.createElement('div');
    const input = document.createElement('input');
    input.id = `input_${Date.now() + Math.random()}`;
    input.setAttribute('type','checkbox');
    const label = document.createElement('label');
    label.setAttribute('for',input.id);
    if(typeof el === 'string') {
      input.value = el;
      label.textContent = el;
    }
    else {
      label.textContent = el.textContent;
      if(el.value) input.value = el.value;
      if(el.disabled) input.disabled = el.disabled;
      if(el.dataset)
        for(const key in el.dataset) {
          input.dataset[key] = el.dataset[key];
        }
    }
    item.appendChild(input);
    item.appendChild(label);
    par.appendChild(item);
  }
};

const uncheckType = (par,alltexts,acpc='ac') => {
  let indet = false;
  let parbox;
  for(const input of par.querySelectorAll('input')) {
    if(input.name === 'selectall') parbox = input;
    if(input.name === 'aconly' || input.name === 'pconly') continue;
    const siglum = input.nextElementSibling.textContent;
    const text = alltexts.get(siglum);
    if(text?.type === acpc) {
      input.checked = false;
      indet = true;
    }
  }
  if(indet && parbox.checked) parbox.indeterminate = true;
};

const updateCheckboxes = e => {
  if(e.target.tagName !== 'INPUT') return;
  const par = e.target.closest('.checklist');
  const parbox = par.querySelector('input[name="selectall"]');
  if(e.target === parbox) {
    for(const box of par.querySelectorAll('input')) {
      if(box.name === 'pconly' || box.name === 'aconly') continue;
      if(box.disabled)
        box.checked = false;
      else
        box.checked = parbox.checked;
    }
    return;
  }

  let checked = null;
  let unchecked = null;
  for(const box of par.querySelectorAll('input')) {
    if(box === parbox) continue;
    if(box.name === 'pconly' || box.name === 'aconly') continue;
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

const makeOption = (index,obj) => {
  const div = document.createElement('div');
  const box = document.createElement('input');
  box.setAttribute('type','checkbox');
  box.id = `checkbox_${Date.now() + Math.random()}`;
  box.value = index;
  if(obj.hasOwnProperty('checked')) {
    if(obj.checked === true) box.setAttribute('checked',true);
    else box.dataset.default = 'off';
  }
  const label = document.createElement('label');
  label.setAttribute('for',box.id);
  if(obj.search && obj.replace)
    label.title = `Search: ${obj.search} Replace: ${obj.replace.toString()}`;
  label.append(obj.name);
  div.appendChild(box);
  div.appendChild(label);
  return div;
};

const checkAll = e => {
  const details = e.target.parentNode.querySelector('details');
  details.open = true;
  const kids = details.querySelectorAll('input');
  for(const kid of kids) {
    if(kid.dataset.default === 'off')
      continue;
    else
      kid.checked = e.target.checked;
  }
};

const checkFilterBox = e => {
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

const populateFilters = par => {
  const normies = par.querySelector('#normalization');

  for(const checkbox of normies.querySelectorAll('input'))
    checkbox.addEventListener('click',checkAll);

  const langMap = new Map();
  for(const lang of ['tamil','sanskrit','pali','sinhalese']) {
    const deets = normies.querySelector(`details.${lang}`);
    deets.addEventListener('click',checkFilterBox);
    langMap.set(lang, deets);
  }
  for(const [i, filter] of normFilters.entries()) {
    if(filter.group === 'general')
      normies.insertBefore(makeOption(i,filter),langMap.get('tamil').parentNode);
    else if(filter.group) {
      const deets = langMap.get(filter.group);
      if(deets) deets.appendChild(makeOption(i,filter));
      else normies.insertBefore(makeOption(i,filter),langMap.get('tamil').parentNode); // catch typos
    }
    else langMap.get('sanskrit').appendChild(makeOption(i,filter));
  }

  const xmltags = par.querySelector('#xmltags');
  for(const tag of tagFilters) {
    const opt = makeOption(tag,{name: `Ignore <${tag}>`,checked: true});
    xmltags.appendChild(opt);
  }
};

const languageSpecificOptions = (textel, par=document) => {
  const langcode = textel.getAttribute('xml:lang') || textel.querySelector('[*|lang]')?.getAttribute('xml:lang');
  if(!langcode) return;
  
  const lang = langcode === 'ta' || langcode.startsWith('ta-') ? 'tamil' :
               langcode === 'sa' || langcode.startsWith('sa-') ? 'sanskrit' :
               langcode === 'pi' || langcode.startsWith('pi-') ? 'pali' :
               langcode === 'si' || langcode.startsWith('si-') ? 'sinhalese' :
               langcode === 'bo' || langcode.startsWith('bo-') ? 'tibetan' :
               null;
  if(!lang) return;

  const toks = par.querySelectorAll('input[name="tokenization"]');
  for(const tok of toks) {
    if(tok.value === 'grapheme' && lang === 'tamil')
      tok.checked = true;
    else if(tok.value === 'character' && ['sanskrit','pali','sinhalese'].includes(lang))
      tok.checked = true;
    else if (tok.value === 'whitespace' && lang === 'tibetan')
      tok.checked = true;
    else
      tok.checked = false;
  }

  const normies = par.querySelector('#normalization');
  normies.querySelector('input').checked = true; // ignore punctuation
  if(lang === 'pali') 
    normies.querySelector('input[value="1"').checked = true; // ignore case
  if(['sanskrit','tamil','pali','sinhalese'].includes(lang))
    normies.querySelector(`label[title="Search: \\\\s Replace: () => ''"]`).previousElementSibling.checked = true; // remove spaces

  const filterhead = lang ? normies.querySelector(`.${lang}`) : null;
  if(filterhead) {
    const input = filterhead.parentNode.querySelector('input');
    if(!input.checked) {
      input.click();
      filterhead.open = false;
    }
    if(lang === 'tamil') { // don't turn on all sandhi by default
      const arr = [5,6,7,8,9,10];
      for(const n of arr)
        filterhead.parentNode.querySelector(`input[value="${n}"]`).click();
    }
  }
};

const acPcButtons = (par,alltexts) => {
  const pcdiv = document.createElement('div');
  const pcinput = document.createElement('input');
  pcinput.setAttribute('type','radio');
  pcinput.name = 'pconly';
  pcinput.id = `input_${crypto.randomUUID()}`;
  const pclabel = document.createElement('label');
  pclabel.textContent = 'Deselect ac witnesses';
  pclabel.className = 'special';
  pclabel.setAttribute('for',pcinput.id);
  pcdiv.append(pcinput,pclabel);
  pcdiv.addEventListener('click',() => { uncheckType(par,alltexts,'ac'); pcinput.checked = false; }); 

  const acdiv = document.createElement('div');
  const acinput = document.createElement('input');
  acinput.setAttribute('type','radio');
  acinput.name = 'aconly';
  acinput.id = `input_${crypto.randomUUID()}`;
  const aclabel = document.createElement('label');
  aclabel.textContent = 'Deselect pc witnesses';
  aclabel.className = 'special';
  aclabel.setAttribute('for',acinput.id);
  acdiv.append(acinput,aclabel);
  acdiv.addEventListener('click',() => { uncheckType(par,alltexts,'pc'); acinput.checked = false;} ); 

  par.firstElementChild.after(acdiv);
  par.firstElementChild.after(pcdiv);
};

export { appendList, acPcButtons, updateCheckboxes, uncheckType, populateFilters, languageSpecificOptions };
