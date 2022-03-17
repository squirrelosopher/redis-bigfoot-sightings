import 'dotenv/config';

export default class ConfigurationConstants {
    //////////////////////////////////////////////////////////////
    /////////////////////// Redis constants //////////////////////
    //////////////////////////////////////////////////////////////
    static REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1'; 
    static REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
    static REDIS_USER = process.env.REDIS_USER || 'default';
    static REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
    static REDIS_DB_INDEX = parseInt(process.env.REDIS_DB_INDEX || '0');
    
    //////////////////////////////////////////////////////////////
    /////////////////////// Server constants /////////////////////
    //////////////////////////////////////////////////////////////
    static SERVER_HOST = process.env.SERVER_HOST || 'http://127.0.0.1';
    static SERVER_PORT = parseInt(process.env.SERVER_PORT || '8080');
}