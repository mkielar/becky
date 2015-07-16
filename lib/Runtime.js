import Path from 'path';

let Runtime = {};

let addProperty = function(name, value) {
	Object.defineProperty(Runtime, name, { value: value, writable: false });
}

let initialize = function() {
	addProperty('installationDirectory', Path.dirname(process.argv[1]));
}

initialize();

export { Runtime };