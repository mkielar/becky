import RawTmp from 'tmp'; 
import Promise from 'bluebird';

let Tmp = Promise.promisifyAll(RawTmp);

export default Tmp;