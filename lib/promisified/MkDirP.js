import RawMkdirP from 'mkdirp';
import Promise from 'bluebird';

let MkDirP = Promise.promisify(RawMkdirP);

export default MkDirP;