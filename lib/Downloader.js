import EventEmitter from 'events';
import Logger       from './Logger';

import request      from 'request';

let logger = Logger.get('Downloader');

export default class Downloader {

	constructor(url) {

		console.dir(EventEmitter);

		this._url = url;
		this._eventEmitter = new EventEmitter();

		console.log('ttttttt');

		this._receivedSize = 0;
		this._totalSize = undefined;
		
		console.dir(this._eventEmitter);

	}

	pipe(outputStream) {

		logger.debug('Downloading from [%s]', this._url);

		let req = request(this._url)

			.on('request',  () =>         this._resetCounters())
			.on('response', (response) => this._registerTotalSize(response))
			.on('data',     (data) =>     this._registerProgress(data.length))

			.on('error',    (err) =>      this._notify('error', err))
			.on('end',      () =>         this._notify('end'))

			.pipe(outputStream);

	}

	on(event, callback) {
		this._eventEmitter.on(event, callback);
		return this;
	}

	_resetCounters() {
		this._receivedSize = 0;
		this._totalSize = undefined;
		this._notifyProgress();
	}

	_registerTotalSize(response) {
		this._totalSize = Number(response.headers['content-length']) || null;
		this._notifyProgress();
	}

	_registerProgress(incrementSize) {
		this._receivedSize = (this._receivedSize || 0) + incrementSize;
		this._notifyProgress();
	}

	_notifyProgress() {
		this._notify('progress', this._totalSize, this._receivedSize);
	}

	_notify() {
		this._eventEmitter.emit.apply(this._eventEmitter, arguments);
	}

}