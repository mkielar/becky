import ADBKit from 'adbkit';

import Logger from './Logger';
import Backup from './Backup';
import Errors from './Errors';

let logger = Logger.get('App');

let main = function() {
 
	let adbClient = ADBKit.createClient();
	let backup = new Backup(adbClient);

	let registerTrackerEvents = function(tracker) {
		
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
	};

	logger.info('Starting device tracker');

	adbClient
		.trackDevices()
		.then(registerTrackerEvents)
		.catch(Errors.fatal);

};

main();