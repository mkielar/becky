import ADBKit from 'adbkit';
import Promise from 'bluebird';
import Path from 'path';
import Fs from './promisified/Fs';
import mkdirp from './promisified/MkDirP';

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

		logger.info('Scanning in [%s]', scanPath);
		
		return this._sync.readdir(scanPath)
			.reduce((total, stat) => this._processStat(relativePath, total, stat), []);
	}

	_processStat(relativePath, total, stat) {
		
		let sourceStat = this._enrichSource(stat, relativePath);
		logger.debug('Processing [%s]', sourceStat.sourcePath);

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
					
					// The actual folder is added to the array as a last entry (after all it's contents are added).
					// This is to make sure, its entry is processed last, so we could properly set last modification date on it.
					// Otherwise, the date would change every time new files are added to it.

					let newTotal = total.concat(subtotal);

					let hasFiles = subtotal.length > 0;
					if (hasFiles || this._folderConfiguration.synchronizeEmptyFolders) 
						newTotal.push(sourceStat); 

					return newTotal;

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
		logger.debug(one.name, one.size, two.size, one.mtime.getTime(), two.mtime.getTime());
		let differ = one.size !== two.size || one.mtime.getTime() !== two.mtime.getTime();
		return differ;
	}

}

class Synchronizer {
	
	constructor(sync, stat) {

		this._sync = sync;
		this._stat = stat

		logger.debug('Instantiated Synchronizer for %s, %s, %s', this._stat.sourcePath, this._stat.destinationPath, this._stat.isFile());

	}

	run() {

		let directoryCreated = this._ensureDestinationDirectory();
		let transferPromise;

		if (this._stat.isFile()) {

			logger.debug('Running file synchronization from [%s] to [%s]', this._stat.sourcePath, this._stat.destinationPath);

			transferPromise = directoryCreated
				.then(() => this._sync.pull(this._stat.sourcePath))
				.then((transfer) => this._transfer(transfer))

		} else {

			transferPromise = directoryCreated;

		}

		return transferPromise
			.then(() => this._touch())

			.then(() => this._markAsTransferredAndReturn())
			.catch((err) => this._markAsFailedAndReturn(err));

	}

	_ensureDestinationDirectory() {

		let directory = this._stat.isFile() ? Path.dirname(this._stat.destinationPath) : this._stat.destinationPath;
		logger.debug('Ensuring destination directory for entry: %s = %s', this._stat.destinationPath, directory);

		return mkdirp(directory);

	}

	_transfer(transfer) {

		logger.debug('Transferring file [%s]', this._stat.sourcePath);

		return new Promise((resolve, reject) => {

			let output = Fs.createWriteStream(this._stat.destinationPath);
			
			// transfer.on('progress', (progress) => logger.debug('[%s] Pulled %d bytes so far', this._stat.sourcePath, progress.bytesTransferred));
			
			transfer.on('end', () => {
			 	logger.debug('[%s] Finished', this._stat.sourcePath);
			 	return resolve(this._stat.sourcePath);
			});

			transfer.on('error', (err) => {
				logger.debug('[%s] Failed', this._stat.sourcePath, err);
				reject();
			});

			logger.debug('Piping transfer to destination path [%s]', this._stat.destinationPath);
			
			transfer.pipe(output);

		});
	}

	_touch() {

		let time = this._stat.mtime.getTime() / 1000;

		logger.debug('Touching file %s setting mtime to %s', this._stat.destinationPath, this._stat.mtime.getTime(), this._stat.mtime, this._stat.mtime.constructor.name);
		return Fs.openAsync(this._stat.destinationPath, 'r+')
			.then((fd) => Fs.futimesAsync(fd, time, time).finally(() => Fs.closeAsync(fd)));

	}

	_markAsTransferredAndReturn() {
		this._stat.transferred = true;
		return this._stat;
	}

	_markAsFailedAndReturn(err) {
		this._stat.transferred = false;
		this._stat.transferError = err;
		return this._stat;
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
			logger.info('Unknown device [%s], skipping.', this.deviceId);
			return;
		}

		logger.info('Starting backup for device [%s]', this.deviceId);

		// We want this to be synchroneous. And it's not since adbClient is not.
		// We don't really want all devices/folders to synchronize in parallel, so we limit the concurrency of processing folders here.
		Promise.each(backupConfiguration, (folderConfiguration) => this._runBackupFor(folderConfiguration));

	}

	_runBackupFor(folderConfiguration) {

		logger.info('Starting backup for device [%s] from [%s] to [%s].', this.deviceId, folderConfiguration.source, folderConfiguration.destination);

		return this.adbClient.syncService(this.deviceId)
			
			.then((sync) => {

				logger.debug('Reading root directory [%s] on device [%s]', folderConfiguration.source, this.deviceId);

				// Recursively scan all folders, and merge file stats into a single collection
				return new Scanner(sync, folderConfiguration).scan()
					.then((sourceStats) => { this._notifyTotalWork(sourceStats); return sourceStats })
					.each((sourceStat) => logger.info('In order %s', sourceStat.sourcePath))
					.each((sourceStat) => new Synchronizer(sync, sourceStat).run())
					.each((transferredStat) => logger.info('Transfer status for [%s]: transferred: %s, err:', transferredStat.sourcePath, transferredStat.transferred, transferredStat.err || 'none'))
					.finally(() => sync.end());
							
			})

			.catch(Errors.error)
			.finally(() => logger.info('Synchronization for device [%s] from [%s] to [%s] finished.', this.deviceId, folderConfiguration.source, folderConfiguration.destination));

	}

	_notifyTotalWork(sourceStats) {

		logger.debug(sourceStats);

		let totalSize = 0;

		for (let sourceStat of sourceStats) {
			totalSize = totalSize + (sourceStat.isFile() ? (sourceStat.size || 0) : 0);
		}

		logger.info('Total estimated work: %d', totalSize);
	}

}
