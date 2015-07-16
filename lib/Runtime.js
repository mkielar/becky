import Path from 'path';

export default { 
	get installationDirectory() { return Path.dirname(process.argv[1]) },
	get configurationFilePath() { return Path.join(this.installationDirectory), 'becky.json' }
}