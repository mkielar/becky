import ADBKit from 'adbkit';
import Promise from 'bluebird';
import Path from 'path';

import Logger from './Logger';
import Errors from './Errors';
import Configuration from './Configuration';


let logger = Logger.get('Backup');

export default class Backup {

	constructor(adbClient, deviceId) {
		this.adbClient = adbClient;
		this.deviceId = deviceId;
	}	

	run() {
		
		let backupConfiguration = Configuration.forDevice(this.deviceId);
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

		logger.info("Starting backup for device [%s] from [%s] to [%s].", this.deviceId, folderConfiguration.source, folderConfiguration.destination);

		return this.adbClient.syncService(this.deviceId)
			.then(function(sync) {

				logger.info("Reading directory [%s] on device [%s]", folderConfiguration.sourceFolder, self.deviceId);

				let enrich = function(stat, relativePath) {
					stat.relativePath = relativePath;
					return stat;
				};

				let processStat = function(root, relativePath, total, stat) {
					
					logger.info("Processing [%s]", stat.name);

					if (stat.isFile()) {

						// Single file, just add it to the results array.

						total.push(enrich(stat, relativePath));
						return total;

					} else {
						
						// A Folder. We need to recursively scan it, and add all it's contents to the result array.

						let newRelativePath = Path.posix.join(relativePath, stat.name);

						return scan(root, newRelativePath)
							.then((subtotal) => total.concat(subtotal));
					}
					
				}

				let scan = function(root, relativePath) {

					let scanPath = Path.posix.join(root, relativePath);

					logger.info("Scanning in [%s]", scanPath);
						
					return sync.readdir(scanPath)
						.reduce((total, stat) => processStat(root, relativePath, total, stat), []);
				}

				// Recursively scan all folders, and merge file stats into a single collection
				return scan(folderConfiguration.source, '')
					.map((stat) => logger.info("Entry [%s], isFile: [%s]", Path.posix.join(folderConfiguration.source, stat.relativePath, stat.name), stat.isFile()));

			})
			.catch(Errors.error)
			.finally(() => logger.info("Synchronization for device [%s] from [%s] to [%s] finished.", this.deviceId, folderConfiguration.source, folderConfiguration.destination));

	}

}
