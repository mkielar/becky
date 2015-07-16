import Log4js from 'log4js';
import Path from 'path';

import { Runtime } from './Runtime';

let initialize = function() {
	
	const LOG_PATH = Path.join(Runtime.installationDirectory, 'logs/becky.log');

	Log4js.configure({
		appenders: [
			{ type: 'console' },
			{ type: 'file', filename: LOG_PATH }
		]
	});

};

let Logger = {

	get : function(name) {
		return Log4js.getLogger(name);
	}

};

initialize();

export { Logger };