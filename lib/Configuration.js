import Path from 'path';
import JSONFile from 'jsonfile';

import Runtime from './Runtime';
import Logger from './Logger';
import Errors from './Errors';

let logger = Logger.get('Configuration');
let instance = null;

class ConfigurationInstance {

	constructor(path)  {
		this.jsonConfiguration = loadJsonConfiguration(path);
	}

	setting(name) {

		if (!this.jsonConfiguration.settings)
			return null;

		return this.jsonConfiguration.settings[name];

	}

	forDevice(deviceId) {

		if (!this.jsonConfiguration.backup)
			return null;

		return this.jsonConfiguration.backup[deviceId];

	}

}

function loadJsonConfiguration(configurationFilePath) {

	logger.info('Loading configuration from', configurationFilePath);

	let configuration = JSONFile.readFileSync(configurationFilePath);
	logger.info("Read configuration file", configuration);

	return configuration;

}

function provideInstance(path) {

	if (path)
		instance = new ConfigurationInstance(path);	

	if (!instance)
		instance = new ConfigurationInstance(Runtime.configurationFilePath);		

	return instance;

}

export default {
	
	reload     : (path)      => provideInstance(path),

	get        : (name)      => provideInstance().setting(name),
	forDevice  : (deviceId)  => provideInstance().forDevice(deviceId)

}