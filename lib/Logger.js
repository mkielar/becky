import Log4js from 'log4js';
import Path from 'path';

import Runtime from './Runtime';

(() => {
	
	const LOG_PATH = Path.join(Runtime.installationDirectory, 'logs/becky.log');

	Log4js.configure({
		appenders: [
			{ type: 'console' },
			{ type: 'file', filename: LOG_PATH }
		]
	});

})();

export default {
	get : (name) => Log4js.getLogger(name)
};