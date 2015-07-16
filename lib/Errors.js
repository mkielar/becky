import { Logger } from './Logger';

let logger = Logger.get('Errors');

let Errors = {
	fatal : function(err) {
		console.log('Fatal' || err);
		logger.error('Something went really wrong: ', err.stack || err);
	}
}

export { Errors };