import RawFs from 'fs'; 
import Promise from 'bluebird';

let Fs = Promise.promisifyAll(RawFs);

// Fix for exists
Fs.existsAsync = function(path) {
	return new Promise((resolve, reject) => {
		RawFs.exists(path, (exists) => resolve(exists));
	});
};

export default Fs;