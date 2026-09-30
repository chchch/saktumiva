import Sanscript from './sanscript.mjs';
import { graphemeSplit } from './split.mjs';
import { aksaraSplit } from './split.mjs';

const trans = Sanscript.t('poruḷiyal','iast','slpish');
console.log(graphemeSplit(trans));

const trans2 = Sanscript.t('hiṃgulākṣe','iast','slpish');
console.log(aksaraSplit(trans2));
