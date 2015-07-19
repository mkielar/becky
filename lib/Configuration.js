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
		
		this._defaults = {
			
			adbDistributionPackageUrl  : 'http://adbshell.com/upload/adb.zip',
			adbExecutablePath          : Path.join(Runtime.installationDirectory, 'adb', 'adb.exe')

		};

		this._jsonConfiguration = this._load_jsonConfiguration(path);
	}

	default(name) {
		return this._defaults[name];
	}

	setting(name) {

		if (!this._jsonConfiguration.settings)
			return null;

		if (!this._jsonConfiguration.settings.hasOwnProperty(name))
			return this._defaults[name];

		return this._jsonConfiguration.settings[name];

	}

	forDevice(deviceId) {

		if (!this._jsonConfiguration.backup)
			return null;

		return this._jsonConfiguration.backup[deviceId];

	}

	_load_jsonConfiguration(configurationFilePath) {

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