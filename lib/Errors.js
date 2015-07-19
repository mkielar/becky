import ExtendableError from 'es6-error';
import Util from 'util';
import Logger from './Logger';


let logger = Logger.get('Errors');

export class FileNotFoundError extends ExtendableError {
	
	constructor (message) {
		super(message)
	}
	
}

export default {

	throw : (err) => { throw err },

	error : (err) => { logger.error('Something went really wrong:\n%s\n ', Util.inspect(err), (err.stack || err)); },
	fatal : (err) => { logger.fatal('Something went really wrong:\n%s\n ', Util.inspect(err), (err.stack || err)); process.exit(1) }
}