import { loadDoc, compileImports, XSLTransform } from './utils.mjs';

const getXSLTSheet = async doc => {
    for(const n of doc.childNodes) {
        if(n.nodeName === 'xml-stylesheet') {
            const temp = doc.createElement('outer');
            temp.innerHTML = `<inner ${n.data}/>`;
            const href = temp.firstChild.getAttribute('href');
            return loadDoc(href,'default');
        }
    }
};

const loadXSLT = async fn => {
  const doc = await loadDoc(fn);
  return await compileImports(doc);
};

const previewDoc = async (doc,xsltpath) => {
    const sheet = xsltpath ?
      await loadXSLT(xsltpath) : await getXSLTSheet(doc);
    return await XSLTransform(sheet, doc);
};

export default previewDoc;
