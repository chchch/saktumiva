const loadDoc = async (fn,cache='no-cache') => {
    let res;
    try {
        res = await fetch(fn, {cache: cache});
    }
    catch(err) {
        console.log(err);
        return null;
    }
    const xmltext = await res.text();
    return (new DOMParser()).parseFromString(xmltext, 'text/xml');
};

export { loadDoc };
