import ADBKit        from 'adbkit';
import Path          from 'path';

import Unzip         from 'unzip';

import Fs            from './promisified/Fs';
import mkdirp        from './promisified/MkDirP';
import Tmp           from './promisified/Tmp';

import Logger        from './Logger';
import Errors        from './Errors';
import Downloader    from './Downloader';

import Configuration from './Configuration';
import Backup        from './Backup';

import { FileNotFoundError } from './Errors';


let logger = Logger.get('App');

class App {


	constructor() {}

	run() {

		this._establishAdbClient()
			.then((adbClient) => {
		
				logger.info('Starting device tracker');

				adbClient
					.trackDevices()
					.then((tracker) => this._registerTrackerEvents(tracker))
					.catch(Errors.fatal);

			})
			.catch(FileNotFoundError, Errors.fatal)
			.catch(Errors.fatal);

	}


	_establishAdbClient() {
		
		logger.info('Creating ADB Client #1 try. See if ADB already running.');
		return this._tryCreateClient()
			.catch((err) => {

				if (err.code === 'ENOENT')
					logger.warn('Creating ADB Client on #1 try failed. Trying to download adbshell.');
				
				let adbExecutable = Configuration.get('adbExecutablePath');
				logger.info('Checking if ADB Client exists in expected path [%s]', adbExecutable);
				
				return Fs.existsAsync(adbExecutable)

					.then((exists) => exists || this._downloadAdbClient())
					// Download finished, check again, just to be sure
					.then(() => Fs.existsAsync(adbExecutable))
					.then((exists) => {

						logger.info('123');

						if (!exists)
							throw new FileNotFoundError('Couldn\'t find adb executable');

						logger.info('Creating ADB Client #2 try. Pointing to downloaded ADB distribution.');
						return this._tryCreateClient({ bin : adbExecutable });
 
					});
			});
	}

	_tryCreateClient(options) {

		logger.info('Trying to create client with options:', options);

		let adbClient = ADBKit.createClient(options);
		return adbClient.connection()
			.then(() => adbClient);
	}

	_downloadAdbClient() {

		logger.debug('Downloading adb...');

		return new Promise((resolve, reject) => {

			let destinationPath = Path.dirname(Configuration.get('adbExecutablePath'));
			mkdirp(destinationPath)
				.then(() => {

					let distributionUrl = Configuration.get('adbDistributionPackageUrl');
					let extractor = Unzip.Extract({ path : destinationPath });

					// Resolve promise only when the Unzip Extractor finishes, not when the Downloader ends.
					extractor.on('close', () => {
						logger.debug('Archive extracted.');
						return resolve();
					})
				
					logger.debug('Downloading from [%s]', distributionUrl);

					new Downloader(distributionUrl)
						.on('progress', (total, progress) => logger.info('Downloaded %d / %d', progress, total))
						.on('error', (err) => reject(err))
						.pipe(extractor);


				});
		});
	}

	_registerTrackerEvents(tracker) {
		
		// TODO: What if we get more than one device in parallel?

		tracker.on('add', (device) => {

			logger.info('Device added', device);

			if (device.type === 'device')
				new Backup(adbClient, device.id).run();
			
		});	

		tracker.on('change', (device) => {

			logger.info('Device changed', device);

			if (device.type === 'device')
				new Backup(adbClient, device.id).run();

		});

		logger.info('Device Tracker events registered.');
	}

}

(() => new App().run())();
