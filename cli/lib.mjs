import Fs from 'node:fs';
import Path from 'node:path';

const readConfig = (arg) => {
    if(!arg) { console.log('No config file selected.'); return; }
    
    if(!Fs.existsSync(arg)) { console.log('Config file doesn\'t exist.'); return; }

    const configtxt = Fs.readFileSync(arg,{encoding: 'utf-8'});
    if(!configtxt) { console.log('Can\'t read config file.'); return; }
    
    let config;
    try { config = JSON.parse(configtxt); }
    catch { console.log('Can\'t read config file.'); return; }
    
    config.dirname = Path.dirname(arg);

    for(const key of ['ignoretags','blocks','filtergroups'])
        if(config[key]) config[key] = splitIfString(config[key]);
    if(config.edition)
        for(const key of ['sort'])
            if(config.edition[key]) config.edition[key] = splitIfString(config.edition[key]);


    return config;
};

const splitIfString = e => {
    if(Array.isArray(e)) return e;
    else return e.split(/\s+/g);
};
export { readConfig };
