import ADBKit from 'adbkit';

import { Runtime } from './Runtime';
import { Configuration } from './Configuration';

import { Logger } from './Logger';
import { Backup } from './Backup';
import { Errors } from './Errors';

let logger = Logger.get('App');

let main = function() {

	// Globally initialize configuration singleton for the whole application.
	Configuration.initialize(Runtime.installationDirectory);

	let adbClient = ADBKit.createClient();
	let backup = new Backup(adbClient);

	let registerTrackerEvents = function(tracker) {
		tracker.on('add', (device) => new Backup(adbClient, device.id).run());	
	};

	logger.info("Starting device tracker");

	adbClient
		.trackDevices()
		.then(registerTrackerEvents)
		.then(() => logger.info("Device Tracker started."))
		.catch(Errors.fatal);

};

main();