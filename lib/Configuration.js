import Path from 'path';
import JSONFile from 'jsonfile';

import Runtime from './Runtime';
import Logger from './Logger';
import Errors from './Errors';

import extend from 'extend';

let logger = Logger.get('Configuration');
let instance = null;

const DEFAULTS = {
	backup : {
		anyDeviceId : {
			synchronizeEmptyFolders : true
		}
	}
}

class ConfigurationInstance {

	constructor(path)  {
		this.jsonConfiguration = this._loadJsonConfiguration(path);
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

	_loadJsonConfiguration(configurationFilePath) {

		logger.info('Loading configuration from', configurationFilePath);

		let rawConfiguration = JSONFile.readFileSync(configurationFilePath);
		let stdConfiguration = this._applyDefaults(rawConfiguration);

		return stdConfiguration;

	}

	_applyDefaults(configuration) {

		if (configuration.backup) {

			for (let deviceId in configuration.backup) {
				
				if (configuration.backup.hasOwnProperty(deviceId)) {

					let deviceBackupConfiguration = configuration.backup[deviceId];
					for (let i = 0; i < deviceBackupConfiguration.length; i++) {

						let rawFolderBackupConfiguration = deviceBackupConfiguration[i];
						let stdFolderBackupConfiguration = extend({}, DEFAULTS.backup.anyDeviceId, rawFolderBackupConfiguration);

						deviceBackupConfiguration[i] = stdFolderBackupConfiguration;

					}
				}
			}
		}

		return configuration;

	}

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