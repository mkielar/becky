import Path from 'path';
import JSONFile from 'jsonfile';

import { Logger } from './Logger';
import { Errors } from './Errors';

let logger = Logger.get('Configuration');

let loadJsonConfiguration = function(installationDirectory) {

	let configurationFile = Path.join(installationDirectory, 'becky.json');
	logger.info('Loading configuration from', configurationFile);

	let configuration = JSONFile.readFileSync(configurationFile);
	logger.info("Read configuration file", configuration);

	return configuration;

}

let Configuration = {

	initialize : function(installationDirectory) {
		this.installationDirectory = installationDirectory;
		this.jsonConfiguration = loadJsonConfiguration(installationDirectory);
	},

	getInstallationDirectory : function() { return this.installationDirectory },

	getBackupConfigurationFor : function(deviceId) {

		this._check();
		
		if (!this.jsonConfiguration.backup)
			return null;

		return this.jsonConfiguration.backup[deviceId];

	},

	_check : function() {
		if (!this.jsonConfiguration)
			throw new Error("Configuration not initialized!");
	}

}

export { Configuration };