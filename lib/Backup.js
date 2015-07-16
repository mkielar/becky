import ADBKit from 'adbkit';
import Promise from 'bluebird';
import Path from 'path';
import Fs from 'fs'; Promise.promisifyAll(Fs);

import Logger from './Logger';
import Errors from './Errors';
import Configuration from './Configuration';

let logger = Logger.get('Backup');

class Scanner {

	constructor(sync, folderConfiguration) {
		this._sync = sync;
		this._folderConfiguration = folderConfiguration;
	}

	scan() {

		let relativePath = arguments.length > 0 ? arguments[0] : '';
		let scanPath = Path.posix.join(this._folderConfiguration.source, relativePath);

		logger.info("Scanning in [%s]", scanPath);
			
		return this._sync.readdir(scanPath)
			.reduce((total, stat) => this._processStat(relativePath, total, stat), []);
	}

	_processStat(relativePath, total, stat) {
		
		let sourceStat = this._enrichSource(stat, relativePath);
		logger.debug("Processing [%s]", sourceStat.sourcePath);

		if (stat.isFile()) {

			// Single file, just add it to the results array.

			return this._shouldSynchronize(sourceStat) 
				.then((should) => { 
					
					if (should) 
						total.push(sourceStat); 
					else
						logger.debug('File %s did not change, skipping.', sourceStat.sourcePath);

					return total;

				});

		} else {
			
			// A Folder. We need to recursively scan it, and add all it's contents to the result array.

			let newRelativePath = Path.posix.join(relativePath, stat.name);

			return this.scan(newRelativePath)
				.then((subtotal) => { 
					
					let hasFiles = subtotal.length > 0;
					if (hasFiles || this._folderConfiguration.synchronizeEmptyFolders) 
						total.push(sourceStat); 

					return total.concat(subtotal);

				});
		}
		
	}

	_enrichSource(stat, relativePath) {
		
		stat.relativePath = relativePath;
		stat.sourcePath = Path.posix.join(this._folderConfiguration.source, relativePath, stat.name);
		stat.destinationPath = Path.join(this._folderConfiguration.destination, relativePath, stat.name);

		return stat;

	}

	_shouldSynchronize(sourceStat) {
		
		// Should synchronize if:
		// 1. file does not exist in destination
		// 2. file timestamp / size differs in destination
		// 3. on error (since we cannot tell, we'll try to synchronize)
		return this._missingOrModified(sourceStat)
			.catch((err) => { Errors.error(err); return true });

	}

	_missingOrModified(sourceStat) {

		return Fs.statAsync(sourceStat.destinationPath)
		
			.then((destinationStat) => this._differ(sourceStat, destinationStat))
			
			.catch((err) => {

				// If it's ENOENT, then the file does not exist in destination, and 				
				if (err.code && err.code === 'ENOENT')
					return true;

				throw err;

			});
	}

	_differ(one, two) {
		let differ = one.size !== two.size || one.mtime.getTime() !== two.mtime.getTime();
		return differ;
	}

}

export default class Backup {

	constructor(adbClient, deviceId) {
		this.adbClient = adbClient;
		this.deviceId = deviceId;
	}	

	run() {
		
		let backupConfiguration = Configuration.forDevice(this.deviceId);
		if (!backupConfiguration) {
			logger.info("Unknown device [%s], skipping.", this.deviceId);
			return;
		}

		logger.info("Starting backup for device [%s]", this.deviceId);

		// We want this to be synchroneous. And it's not since adbClient is not.
		// We don't really want all devices/folders to synchronize in parallel, so we limit the concurrency of processing folders here.
		Promise.map(backupConfiguration, (folderConfiguration) => this._runBackupFor(folderConfiguration), { "concurrency" : 1 });

	}

	_runBackupFor(folderConfiguration) {

		logger.info("Starting backup for device [%s] from [%s] to [%s].", this.deviceId, folderConfiguration.source, folderConfiguration.destination);

		return this.adbClient.syncService(this.deviceId)
			.then((sync) => {

				logger.debug("Reading root directory [%s] on device [%s]", folderConfiguration.source, this.deviceId);

				// Recursively scan all folders, and merge file stats into a single collection
				return new Scanner(sync, folderConfiguration).scan()
					.map((sourceStat) => logger.debug("Entry [%s], isFile: [%s]", sourceStat.sourcePath, sourceStat.isFile()));

			})
			.catch(Errors.error)
			.finally(() => logger.info("Synchronization for device [%s] from [%s] to [%s] finished.", this.deviceId, folderConfiguration.source, folderConfiguration.destination));

	}

}
