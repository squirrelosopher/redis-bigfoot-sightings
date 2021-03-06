import open from 'open';
import ConfigurationConstants from './src/constant/configuration_constants.js';

const url = `${ConfigurationConstants.SERVER_HOST}:${ConfigurationConstants.SERVER_PORT}`;

const openedUrlProcess = await open(url, {
    wait: false
});

openedUrlProcess.on('spawn', () => {
    console.log(`opened address ${url} [pid ${openedUrlProcess.pid}]`);
});

openedUrlProcess.on('error', (error) => {
    console.log(`unable to open address ${url}, reason: ${error.message}`);
});
