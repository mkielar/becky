import ADBKit from 'adbkit';
import Promise from 'bluebird';
import Path from 'path';

import { Logger } from './Logger';
import { Errors } from './Errors';
import { Configuration } from './Configuration';

let logger = Logger.get('Backup');


export class Backup {

	constructor(adbClient, deviceId) {
		this.adbClient = adbClient;
		this.deviceId = deviceId;
	}	

	run() {
		
		let backupConfiguration = Configuration.getBackupConfigurationFor(this.deviceId);
		if (!backupConfiguration) {
			logger.info("Unknown device, skipping.");
			return;
		}

		logger.info("Starting backup for device [%s]", this.deviceId);

		// We want this to be synchroneous. And it's not since adbClient is not.
		// We don't really want all devices/folders to synchronize in parallel, so we limit the concurrency of processing folders here.
		Promise.map(backupConfiguration, (folderConfiguration) => this._runBackupFor(folderConfiguration), { "concurrency" : 1 });

	}

	_runBackupFor(folderConfiguration) {

		let self = this;

		logger.info("Starting backup for device [%s] from [%s] to [%s].", this.deviceId, folderConfiguration.sourceFolder, folderConfiguration.destinationFolder);

		return this.adbClient.syncService(this.deviceId)
			.then(function(sync) {

				logger.info("Reading directory [%s] on device [%s]", folderConfiguration.sourceFolder, self.deviceId);

				let enrich = function(stat, currentPath) {
					stat.path = currentPath;
					return stat;
				};

				let processStat = function(total, stat, currentPath) {
					
					logger.info("Processing [%s]", stat.name);

					if (stat.isFile()) {
						total.push(enrich(stat, currentPath));
						return total;
					} else {
						let newPath = currentPath + '/' + stat.name;
						return scan(newPath) // Path.join converts slashes on Windows, breaking Android paths!!!
							.then((subtotal) => { 
													logger.info('Processing subtotal for', newPath);
													if (subtotal && total) 
														subtotal.forEach((item) => total.push(enrich(item, newPath))); 
													
													return total;
												});
							
					}
					
				}

				let scan = function(currentPath) {
					logger.info("Scanning in [%s]", currentPath);
						
					return sync.readdir(currentPath)
						.reduce((total, stat) => processStat(total, stat, currentPath), []);
				}

				// Recursively scan all folders, and merge file stats into a single collection
				return scan(folderConfiguration.sourceFolder)
					.map((stat) => logger.info("Entry [%s], isFile: [%s]", stat.path + '/' + stat.name, stat.isFile()));

			})
			.catch(Errors.fatal);

	}

}
