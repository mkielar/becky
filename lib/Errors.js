import Logger from './Logger';

let logger = Logger.get('Errors');

export default {
	error : (err) => { logger.error('Something went really wrong: ', err.stack || err); },
	fatal : (err) => { logger.fatal('Something went really wrong: ', err.stack || err); process.exit(1) }
}